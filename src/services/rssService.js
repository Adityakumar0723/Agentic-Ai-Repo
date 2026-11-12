const Parser = require("rss-parser");
const SOURCES = require("./sources");

const parser = new Parser({ timeout: 1500 });
const MAX_SEARCH_MS = 12000;
const CONCURRENCY = 150;

/* ── keyword index: built once at startup, instant source lookup ── */
const _keywordIndex = {};
const _allKeys = Object.keys(SOURCES);
for (const key of _allKeys) {
  const parts = key.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter((w) => w.length >= 2);
  const urlParts = (SOURCES[key] || "").toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter((w) => w.length >= 3);
  for (const p of [...parts, ...urlParts]) {
    if (!_keywordIndex[p]) _keywordIndex[p] = [];
    _keywordIndex[p].push(key);
  }
}

/* ── feed cache: 3 min TTL, prevents re-fetching same source ── */
const _feedCache = new Map();
const CACHE_TTL = 180000;

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
    summary: snippet ? snippet.slice(0, 8000) : null,
    content: (cleanContent || snippet || "").slice(0, 50000) || null,
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

function fetchOneCached(source) {
  const feedUrl = SOURCES[source];
  if (!feedUrl) return Promise.resolve({ source, ok: false });

  const cached = _feedCache.get(source);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return Promise.resolve({ source, feed: cached.feed, ok: true, cached: true });
  }

  return parser.parseURL(feedUrl)
    .then((feed) => {
      _feedCache.set(source, { feed, ts: Date.now() });
      if (_feedCache.size > 5000) {
        const oldest = _feedCache.keys().next().value;
        _feedCache.delete(oldest);
      }
      return { source, feed, ok: true };
    })
    .catch(() => ({ source, ok: false }));
}

/* ── concurrency pool: max N active connections, rapid recycling ── */
async function poolScan(keys, limitPerSource, deadline) {
  const articles = [];
  const failed = [];
  const searched = [];
  let idx = 0;

  async function worker() {
    while (idx < keys.length && Date.now() < deadline) {
      const i = idx++;
      const source = keys[i];
      if (!source) break;
      searched.push(source);

      const timeLeft = deadline - Date.now();
      if (timeLeft <= 0) break;

      const killTimer = Math.min(timeLeft, 1500);
      const result = await Promise.race([
        fetchOneCached(source),
        new Promise((r) => setTimeout(() => r({ source, ok: false, timeout: true }), killTimer)),
      ]);

      if (result.ok && result.feed) {
        const items = result.feed.items
          .slice(0, limitPerSource)
          .map((item) => normalizeItem(item, source, result.feed.title));
        articles.push(...items);
      } else {
        failed.push({ source, error: result.timeout ? "timeout" : "failed" });
      }
    }
  }

  const workers = [];
  const poolSize = Math.min(CONCURRENCY, keys.length);
  for (let w = 0; w < poolSize; w++) {
    workers.push(worker());
  }
  await Promise.allSettled(workers);

  return { articles, failed, searched };
}

/* ── legacy batch for fetchSourcesBatch (category/feed endpoints) ── */
async function fetchSourcesBatch(keys, limitPerSource, deadlineMs) {
  return poolScan(keys, limitPerSource, deadlineMs);
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
  const keys = prioritizeKeys(_allKeys);
  const deadline = Date.now() + MAX_SEARCH_MS;
  return poolScan(keys, limitPerSource, deadline);
}

async function fetchMultipleSources(keys, limitPerSource = 10) {
  const deadline = Date.now() + MAX_SEARCH_MS;
  return poolScan(keys, limitPerSource, deadline);
}

/* ── smart source selection using keyword index ── */
function getRelevantKeys(query) {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  const scoreMap = new Map();

  for (const w of words) {
    const exact = _keywordIndex[w] || [];
    for (const k of exact) {
      scoreMap.set(k, (scoreMap.get(k) || 0) + 3);
    }
    if (w.length >= 4) {
      const stem = w.endsWith("s") ? w.slice(0, -1) : w;
      const stemKeys = _keywordIndex[stem] || [];
      for (const k of stemKeys) {
        if (!scoreMap.has(k)) scoreMap.set(k, 0);
        scoreMap.set(k, scoreMap.get(k) + 1);
      }
    }
  }

  const relevant = [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  const relevantSet = new Set(relevant);
  const priority = [];
  const rest = [];
  for (const k of _allKeys) {
    if (!relevantSet.has(k)) {
      const kl = k.toLowerCase();
      if (PRIORITY_PREFIXES.some((p) => kl.startsWith(p))) {
        priority.push(k);
      } else {
        rest.push(k);
      }
    }
  }

  return [...relevant, ...priority, ...rest];
}

function matchText(text, words) {
  return words.some((w) => text.includes(w));
}

function fuzzyMatch(text, words) {
  return words.some((w) => {
    if (text.includes(w)) return true;
    if (w.length >= 4) {
      const stem = w.endsWith("s") ? w.slice(0, -1) : w;
      if (text.includes(stem)) return true;
      const stem2 = w.endsWith("ing") ? w.slice(0, -3) : w.endsWith("ed") ? w.slice(0, -2) : null;
      if (stem2 && stem2.length >= 3 && text.includes(stem2)) return true;
    }
    return false;
  });
}

function scoreArticle(item, words) {
  const text = [item.title || "", item.summary || "", item.content || ""].join(" ").toLowerCase();
  let score = 0;
  for (const w of words) {
    if (text.includes(w)) score += 2;
    else if (w.length >= 4) {
      const stem = w.endsWith("s") ? w.slice(0, -1) : w;
      if (text.includes(stem)) score += 1;
    }
  }
  const titleText = (item.title || "").toLowerCase();
  for (const w of words) {
    if (titleText.includes(w)) score += 5;
  }
  return score;
}

async function searchArticles(query, limitPerSource = 15) {
  const keys = getRelevantKeys(query);
  const deadline = Date.now() + MAX_SEARCH_MS;

  const { articles, failed, searched } = await poolScan(keys, limitPerSource, deadline);

  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) {
    const latest = articles.sort((a, b) => {
      const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return db - da;
    });
    return { results: latest.slice(0, 30), failed, searched };
  }

  let matched = articles.filter((item) => {
    const text = [
      typeof item.title === "string" ? item.title : "",
      typeof item.summary === "string" ? item.summary : "",
      typeof item.content === "string" ? item.content : "",
    ].join(" ").toLowerCase();
    return matchText(text, words);
  });

  if (matched.length < 5) {
    const fuzzyMatched = articles.filter((item) => {
      const text = [
        typeof item.title === "string" ? item.title : "",
        typeof item.summary === "string" ? item.summary : "",
        typeof item.content === "string" ? item.content : "",
      ].join(" ").toLowerCase();
      return fuzzyMatch(text, words);
    });
    const existingLinks = new Set(matched.map((m) => m.link));
    for (const fm of fuzzyMatched) {
      if (!existingLinks.has(fm.link)) matched.push(fm);
    }
  }

  if (matched.length === 0 && articles.length > 0) {
    matched = articles.slice(0, 30);
  }

  matched.sort((a, b) => {
    const sa = scoreArticle(a, words);
    const sb = scoreArticle(b, words);
    if (sb !== sa) return sb - sa;
    const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return dateB - dateA;
  });

  return { results: matched, failed, searched };
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

function listSources() {
  return Object.entries(SOURCES).map(([key, url]) => ({ key, url }));
}

function listSourceKeys() {
  return _allKeys;
}

module.exports = {
  fetchSource,
  fetchAllSources,
  fetchMultipleSources,
  searchArticles,
  listSources,
  listSourceKeys,
};
