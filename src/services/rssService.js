const Parser = require("rss-parser");
const SOURCES = require("./sources");

const parser = new Parser({ timeout: 8000 });

function normalizeItem(item, source, feedTitle) {
  return {
    source,
    sourceUrl: SOURCES[source] || null,
    sourceFeed: feedTitle || source,
    title: item.title || null,
    link: item.link || null,
    summary: item.contentSnippet || item.summary || null,
    publishedAt: item.isoDate || item.pubDate || null,
    author: item.creator || item.author || null,
  };
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await parser.parseURL(url);
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
}

async function fetchSource(source) {
  const feedUrl = SOURCES[source];
  if (!feedUrl) {
    return { source, error: `Unknown news source "${source}"`, status: 404 };
  }

  try {
    const feed = await fetchWithRetry(feedUrl);
    return feed.items.map((item) => normalizeItem(item, source, feed.title));
  } catch (err) {
    return {
      source,
      error: err.message,
      skipped: true,
    };
  }
}

async function fetchAllSources(limitPerSource = 10) {
  const keys = Object.keys(SOURCES);
  const batchSize = 20;
  const articles = [];
  const failed = [];

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (source) => {
        const feed = await fetchWithRetry(SOURCES[source]);
        return { source, feed };
      })
    );

    results.forEach((result, idx) => {
      const source = batch[idx];
      if (result.status === "fulfilled") {
        const items = result.value.feed.items
          .slice(0, limitPerSource)
          .map((item) => normalizeItem(item, source, result.value.feed.title));
        articles.push(...items);
      } else {
        failed.push({ source, error: result.reason.message });
      }
    });
  }

  return { articles, failed };
}

async function fetchMultipleSources(keys, limitPerSource = 10) {
  const batchSize = 20;
  const articles = [];
  const failed = [];

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (source) => {
        const feedUrl = SOURCES[source];
        if (!feedUrl) return { source, items: [] };
        const feed = await fetchWithRetry(feedUrl);
        return { source, feed };
      })
    );

    results.forEach((result, idx) => {
      const source = batch[idx];
      if (result.status === "fulfilled" && result.value.feed) {
        const items = result.value.feed.items
          .slice(0, limitPerSource)
          .map((item) => normalizeItem(item, source, result.value.feed.title));
        articles.push(...items);
      } else if (result.status === "rejected") {
        failed.push({ source, error: result.reason.message });
      }
    });
  }

  return { articles, failed };
}

async function searchArticles(query, limitPerSource = 15) {
  const { articles, failed } = await fetchAllSources(limitPerSource);
  const q = query.toLowerCase();

  const matched = articles.filter(
    (item) =>
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.summary && item.summary.toLowerCase().includes(q))
  );

  return { results: matched, failed };
}

function listSources() {
  return Object.entries(SOURCES).map(([key, url]) => ({ key, url }));
}

function listSourceKeys() {
  return Object.keys(SOURCES);
}

module.exports = {
  fetchSource,
  fetchAllSources,
  fetchMultipleSources,
  searchArticles,
  listSources,
  listSourceKeys,
};
