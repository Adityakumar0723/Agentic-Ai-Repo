const Parser = require("rss-parser");
const SOURCES = require("./sources");

const parser = new Parser({ timeout: 4000 });
const MAX_SEARCH_MS = 25000;
const BATCH_SIZE = 150;

function stripHtml(html) {
  if (!html) return null;
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeItem(item, source, feedTitle) {
  const fullContent = item["content:encoded"] || item.content || null;
  const snippet = item.contentSnippet || item.summary || null;
  const cleanContent = stripHtml(fullContent);

  return {
    source,
    sourceUrl: SOURCES[source] || null,
    sourceFeed: feedTitle || source,
    title: item.title || null,
    link: item.link || null,
    summary: snippet || null,
    content: cleanContent || snippet || null,
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
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

function fetchOneSourceFast(source) {
  const feedUrl = SOURCES[source];
  if (!feedUrl) return Promise.resolve({ source, items: [], ok: false });
  return parser.parseURL(feedUrl)
    .then((feed) => ({ source, feed, ok: true }))
    .catch(() => ({ source, ok: false }));
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
    const batchTimeout = Math.min(timeLeft, 5000);
    const timer = new Promise((resolve) => setTimeout(() => resolve("timeout"), batchTimeout));
    const raceResult = await Promise.race([Promise.allSettled(batchPromises), timer]);

    if (raceResult === "timeout") {
      const settled = await Promise.allSettled(batchPromises.map((p) =>
        Promise.race([p, new Promise((r) => setTimeout(() => r({ ok: false, source: "timeout" }), 300))])
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
      continue;
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

const PRIORITY_PREFIXES = [
  "bbc", "cnn", "guardian", "nytimes", "npr", "aljazeera", "reuters",
  "washpost", "bloomberg", "cnbc", "wsj", "ft", "techcrunch", "verge",
  "wired", "arstechnica", "engadget", "zdnet", "cnet", "espn",
  "ndtv", "toi", "hindu", "hindustantimes", "coindesk", "variety",
  "reddit", "rsub", "medium", "devto", "fill_bbc", "fill_cnn",
  "fill_guardian", "fill_nyt", "fill_npr", "fill_espn", "fill_ndtv",
  "fill_toi", "fill_verge", "fill_wired", "fill_techcrunch",
  "vr_", "sci2_", "ent2_", "game2_",
];

function prioritizeKeys(keys) {
  const priority = [];
  const rest = [];
  for (const key of keys) {
    const kl = key.toLowerCase();
    if (PRIORITY_PREFIXES.some((p) => kl.startsWith(p))) {
      priority.push(key);
    } else {
      rest.push(key);
    }
  }
  return [...priority, ...rest];
}

async function fetchAllSources(limitPerSource = 10) {
  const keys = prioritizeKeys(Object.keys(SOURCES));
  const deadline = Date.now() + MAX_SEARCH_MS;
  const { articles, failed, searched } = await fetchSourcesBatch(keys, limitPerSource, deadline);
  return { articles, failed, searched };
}

async function fetchMultipleSources(keys, limitPerSource = 10) {
  const deadline = Date.now() + MAX_SEARCH_MS;
  return fetchSourcesBatch(keys, limitPerSource, deadline);
}

async function searchArticles(query, limitPerSource = 15) {
  const keys = prioritizeKeys(Object.keys(SOURCES));
  const deadline = Date.now() + MAX_SEARCH_MS;
  const articles = [];
  const failed = [];
  const searched = [];

  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    if (Date.now() >= deadline) break;

    const batch = keys.slice(i, i + BATCH_SIZE);
    const timeLeft = deadline - Date.now();
    if (timeLeft <= 0) break;

    const batchPromises = batch.map((source) => fetchOneSourceFast(source));
    const batchTimeout = Math.min(timeLeft, 5000);
    const timer = new Promise((resolve) => setTimeout(() => resolve("timeout"), batchTimeout));
    const raceResult = await Promise.race([Promise.allSettled(batchPromises), timer]);

    const results = raceResult === "timeout"
      ? await Promise.allSettled(batchPromises.map((p) =>
          Promise.race([p, new Promise((r) => setTimeout(() => r({ ok: false }), 200))])))
      : raceResult;

    results.forEach((result, idx) => {
      const source = batch[idx];
      searched.push(source);
      if (result.status === "fulfilled" && result.value.ok && result.value.feed) {
        const items = result.value.feed.items
          .slice(0, limitPerSource)
          .map((item) => normalizeItem(item, source, result.value.feed.title));
        articles.push(...items);
      } else {
        failed.push({ source, error: "skipped" });
      }
    });
  }

  const q = query.toLowerCase();
  const matched = articles.filter(
    (item) =>
      (item.title && typeof item.title === "string" && item.title.toLowerCase().includes(q)) ||
      (item.summary && typeof item.summary === "string" && item.summary.toLowerCase().includes(q)) ||
      (item.content && typeof item.content === "string" && item.content.toLowerCase().includes(q))
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
