const Parser = require("rss-parser");
const SOURCES = require("./sources");

const parser = new Parser({ timeout: 10000 });

function normalizeItem(item, source) {
  return {
    source,
    title: item.title || null,
    link: item.link || null,
    summary: item.contentSnippet || item.summary || null,
    publishedAt: item.isoDate || item.pubDate || null,
    author: item.creator || item.author || null,
  };
}

async function fetchSource(source) {
  const feedUrl = SOURCES[source];
  if (!feedUrl) {
    const error = new Error(`Unknown news source "${source}"`);
    error.status = 404;
    throw error;
  }

  const feed = await parser.parseURL(feedUrl);
  return feed.items.map((item) => normalizeItem(item, source));
}

async function fetchAllSources(limitPerSource = 10) {
  const results = await Promise.allSettled(
    Object.keys(SOURCES).map((source) => fetchSource(source))
  );

  const articles = [];
  results.forEach((result, idx) => {
    const source = Object.keys(SOURCES)[idx];
    if (result.status === "fulfilled") {
      articles.push(...result.value.slice(0, limitPerSource));
    } else {
      articles.push({ source, error: result.reason.message });
    }
  });

  return articles;
}

async function searchArticles(query, limitPerSource = 15) {
  const all = await fetchAllSources(limitPerSource);
  const q = query.toLowerCase();

  return all.filter(
    (item) =>
      !item.error &&
      ((item.title && item.title.toLowerCase().includes(q)) ||
        (item.summary && item.summary.toLowerCase().includes(q)))
  );
}

function listSources() {
  return Object.keys(SOURCES);
}

module.exports = {
  fetchSource,
  fetchAllSources,
  searchArticles,
  listSources,
};
