const Parser = require("rss-parser");
const SOURCES = require("./sources");

const parser = new Parser({ timeout: 3000 });
const MAX_SEARCH_MS = 25000;
const BATCH_SIZE = 200;

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
  const fullContent = item["content:encoded"] || item.content || item.description || null;
  const snippet = item.contentSnippet || item.summary || null;
  const cleanContent = stripHtml(fullContent);

  return {
    source,
    sourceUrl: SOURCES[source] || null,
    sourceFeed: feedTitle || source,
    title: item.title || null,
    link: item.link || null,
    summary: snippet ? snippet.slice(0, 800) : null,
    content: (cleanContent || snippet || "").slice(0, 1500) || null,
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
  "nyt_", "wapo_", "usatoday_", "latimes_", "guardian_", "telegraph_",
  "independent_", "dailymail_", "ie_", "et_", "livemint_", "bs_",
  "thehindu_", "france24_", "dw_", "scmp_", "japantimes_",
  "smh_", "abc_au", "cbc_", "aljazeera_", "arabnews", "dawn_",
  "nature_", "science_", "espn_", "cnbc_", "variety_",
  "openai_", "aws_", "azure_", "gcp_", "github_",
  "mp_", "sb_", "wb_", "pd_", "yt_", "gv_", "ur_",
  "mx_", "sx_", "bx_", "px_", "yx_", "rx_", "dx_", "hx_", "fx_", "se_", "nw_", "gx_",
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

function queryRelevantKeys(query, allKeys) {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length >= 2);
  const priorityRelevant = [];
  const priorityRest = [];
  const otherRelevant = [];
  const otherRest = [];
  for (const key of allKeys) {
    const kl = key.toLowerCase();
    const url = (SOURCES[key] || "").toLowerCase();
    const isPriority = PRIORITY_PREFIXES.some((p) => kl.startsWith(p));
    const isRelevant = words.some((w) => kl.includes(w) || url.includes(w));
    if (isPriority && isRelevant) priorityRelevant.push(key);
    else if (isPriority) priorityRest.push(key);
    else if (isRelevant) otherRelevant.push(key);
    else otherRest.push(key);
  }
  return [...priorityRelevant, ...priorityRest, ...otherRelevant, ...otherRest];
}

const FALLBACK_SOURCES = [
  "bbc", "bbc_world", "cnn", "cnn_world", "guardian", "nytimes", "npr",
  "aljazeera", "reuters", "washpost", "bloomberg", "cnbc", "wsj",
  "techcrunch", "verge", "wired", "ndtv", "toi", "hindu", "espn",
  "coindesk", "variety", "arstechnica", "engadget", "zdnet", "cnet",
];

async function searchBatch(keys, limitPerSource, deadline, articles, failed, searched) {
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    if (Date.now() >= deadline) break;

    const batch = keys.slice(i, i + BATCH_SIZE);
    const timeLeft = deadline - Date.now();
    if (timeLeft <= 0) break;

    const batchPromises = batch.map((source) => fetchOneSourceFast(source));
    const batchTimeout = Math.min(timeLeft, 4000);
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

    if (articles.length >= 500 && Date.now() > deadline - 5000) break;
  }
}

async function searchArticles(query, limitPerSource = 15) {
  const allKeys = Object.keys(SOURCES);
  const keys = queryRelevantKeys(query, allKeys);
  const deadline = Date.now() + MAX_SEARCH_MS;
  const articles = [];
  const failed = [];
  const searched = [];

  await searchBatch(keys, limitPerSource, deadline, articles, failed, searched);

  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) return { results: [], failed, searched };

  let matched = articles.filter((item) => {
    const text = [
      typeof item.title === "string" ? item.title : "",
      typeof item.summary === "string" ? item.summary : "",
      typeof item.content === "string" ? item.content : "",
    ].join(" ").toLowerCase();
    return words.some((w) => text.includes(w));
  });

  if (matched.length === 0 && Date.now() < deadline - 3000) {
    const fallbackKeys = FALLBACK_SOURCES.filter((k) => SOURCES[k] && !searched.includes(k));
    if (fallbackKeys.length > 0) {
      const fbArticles = [];
      const fbFailed = [];
      const fbSearched = [];
      await searchBatch(fallbackKeys, limitPerSource, deadline, fbArticles, fbFailed, fbSearched);
      searched.push(...fbSearched);
      failed.push(...fbFailed);
      matched = fbArticles.filter((item) => {
        const text = [
          typeof item.title === "string" ? item.title : "",
          typeof item.summary === "string" ? item.summary : "",
          typeof item.content === "string" ? item.content : "",
        ].join(" ").toLowerCase();
        return words.some((w) => text.includes(w));
      });
      if (matched.length === 0) matched = fbArticles.slice(0, 20);
    }
  }

  matched.sort((a, b) => {
    const textA = [a.title || "", a.summary || "", a.content || ""].join(" ").toLowerCase();
    const textB = [b.title || "", b.summary || "", b.content || ""].join(" ").toLowerCase();
    const scoreA = words.filter((w) => textA.includes(w)).length;
    const scoreB = words.filter((w) => textB.includes(w)).length;
    if (scoreB !== scoreA) return scoreB - scoreA;
    const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return dateB - dateA;
  });

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
