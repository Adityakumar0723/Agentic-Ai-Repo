const Parser = require("rss-parser");
const SOURCES = require("./sources");

const parser = new Parser({ timeout: 6000 });
const MAX_SEARCH_MS = 20000;
const BATCH_SIZE = 50;

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

async function fetchWithRetry(url, retries = 1) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await parser.parseURL(url);
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
}

function fetchOneSource(source) {
  const feedUrl = SOURCES[source];
  if (!feedUrl) return Promise.resolve({ source, items: [], ok: false });
  return fetchWithRetry(feedUrl)
    .then((feed) => ({ source, feed, ok: true }))
    .catch((err) => ({ source, ok: false, error: err.message }));
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
    return { source, error: err.message, skipped: true };
  }
}

async function fetchSourcesBatch(keys, limitPerSource, deadlineMs) {
  const articles = [];
  const failed = [];
  const searched = [];

  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    if (deadlineMs && Date.now() >= deadlineMs) break;

    const batch = keys.slice(i, i + BATCH_SIZE);
    const timeLeft = deadlineMs ? deadlineMs - Date.now() : 30000;
    if (timeLeft <= 0) break;

    const batchPromises = batch.map((source) => fetchOneSource(source));
    const timer = new Promise((resolve) => setTimeout(() => resolve("timeout"), Math.min(timeLeft, 10000)));
    const raceResult = await Promise.race([Promise.allSettled(batchPromises), timer]);

    if (raceResult === "timeout") {
      const settled = await Promise.allSettled(batchPromises.map((p) =>
        Promise.race([p, new Promise((r) => setTimeout(() => r({ ok: false, source: "timeout" }), 500))])
      ));
      settled.forEach((result, idx) => {
        const source = batch[idx];
        searched.push(source);
        if (result.status === "fulfilled" && result.value.ok && result.value.feed) {
          const items = result.value.feed.items
            .slice(0, limitPerSource)
            .map((item) => normalizeItem(item, source, result.value.feed.title));
          articles.push(...items);
        } else {
          failed.push({ source, error: "timeout" });
        }
      });
      break;
    }

    raceResult.forEach((result, idx) => {
      const source = batch[idx];
      searched.push(source);
      if (result.status === "fulfilled" && result.value.ok && result.value.feed) {
        const items = result.value.feed.items
          .slice(0, limitPerSource)
          .map((item) => normalizeItem(item, source, result.value.feed.title));
        articles.push(...items);
      } else {
        const errMsg = result.status === "fulfilled" ? result.value.error : result.reason?.message;
        failed.push({ source, error: errMsg || "unknown" });
      }
    });
  }

  return { articles, failed, searched };
}

async function fetchAllSources(limitPerSource = 10) {
  const keys = Object.keys(SOURCES);
  const deadline = Date.now() + MAX_SEARCH_MS;
  const { articles, failed, searched } = await fetchSourcesBatch(keys, limitPerSource, deadline);
  return { articles, failed, searched };
}

async function fetchMultipleSources(keys, limitPerSource = 10) {
  const deadline = Date.now() + MAX_SEARCH_MS;
  return fetchSourcesBatch(keys, limitPerSource, deadline);
}

async function searchArticles(query, limitPerSource = 15) {
  const { articles, failed, searched } = await fetchAllSources(limitPerSource);
  const q = query.toLowerCase();

  const matched = articles.filter(
    (item) =>
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.summary && item.summary.toLowerCase().includes(q))
  );

  return { results: matched, failed, searched };
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
