const axios = require("axios");
const crypto = require("crypto");
const langsearch = require("./langsearchService");

/**
 * WaveSearch Agent — brand new, fully standalone agent. Does not import
 * from or depend on wikipediaService.js, rssService.js/redditService.js
 * (GlobalWire), or sarvamService.js (Sarvam AI). WaveSearch has no
 * dependency on any other agent in this repo — it only talks to
 * LangSearch for live search, and every answer is synthesized in-process
 * from those results. No external LLM/API key is needed beyond LangSearch.
 *
 * Core idea: a "Smart Search Budget System" — classify how deep a query
 * needs to go, spend a matching number of LangSearch calls researching it
 * from multiple angles, then extractively synthesize one grounded answer
 * directly from the live results, plus a generated sources report
 * (markdown "file").
 *
 * On top of that sits a quota-protection layer: a token/content budget
 * per task, a duplicate-search cache, relevance filtering, full-text
 * fetching only for the most important sources, per-response usage
 * tracking, 80%/95% quota thresholds, and a queue+resume path for when
 * quota runs out.
 */

// ---------------------------------------------------------------------------
// 1. Smart Search Budget System
// ---------------------------------------------------------------------------

const BUDGETS = {
  simple: { min: 1, max: 2 },
  normal: { min: 3, max: 5 },
  deep: { min: 10, max: 20 },
  enterprise: { min: 20, max: 50 },
};

// Per-depth token budget for how much source text this request is allowed
// to read/use when building its answer (rough chars-per-token estimate of
// 4 is used to turn this into a char cap). Purely internal — no external
// LLM is involved, so this just bounds this agent's own processing.
const TOKEN_BUDGETS = {
  simple: 800,
  normal: 2000,
  deep: 4000,
  enterprise: 6000,
};

// How many of the top-ranked sources get their full webpage text fetched,
// instead of just the LangSearch snippet. Kept small/zero for cheap depths.
const FULL_TEXT_SOURCE_COUNT = {
  simple: 0,
  normal: 1,
  deep: 3,
  enterprise: 5,
};

const ENTERPRISE_HINTS = [
  "enterprise", "due diligence", "market research", "competitive landscape",
  "industry analysis", "whitepaper", "full report", "comprehensive report",
  "investment memo", "feasibility study",
];
const DEEP_HINTS = [
  "deep dive", "in-depth", "in depth", "detailed analysis", "thorough",
  "comprehensive", "research paper", "all aspects", "exhaustive",
  "step by step guide", "complete guide",
];
const NORMAL_HINTS = [
  "compare", "vs", "versus", "analysis", "impact of", "pros and cons",
  "explain", "difference between", "how does", "why does", "overview of",
];
const SIMPLE_STARTERS = [
  "what is", "who is", "when is", "when did", "where is", "define",
  "capital of", "meaning of", "spell",
];

/**
 * Classifies a query into a research depth bucket. An explicit `depth`
 * param always wins; otherwise this falls back to lightweight heuristics
 * on the query text so the budget system works even when the caller
 * (an agent builder / GPT) doesn't know to pass one.
 */
function classifyDepth(query, explicitDepth) {
  const valid = Object.keys(BUDGETS);
  if (explicitDepth && valid.includes(String(explicitDepth).toLowerCase())) {
    return String(explicitDepth).toLowerCase();
  }

  const q = query.toLowerCase();
  const wordCount = query.trim().split(/\s+/).filter(Boolean).length;

  if (ENTERPRISE_HINTS.some((h) => q.includes(h))) return "enterprise";
  if (DEEP_HINTS.some((h) => q.includes(h))) return "deep";
  if (wordCount > 30) return "deep";

  if (NORMAL_HINTS.some((h) => q.includes(h))) return "normal";
  if (wordCount > 12) return "normal";

  if (SIMPLE_STARTERS.some((h) => q.startsWith(h)) && wordCount <= 10) return "simple";
  if (wordCount <= 6) return "simple";

  return "normal";
}

/**
 * Picks how many LangSearch calls to spend, within the bucket's [min, max]
 * range, scaled a little by how "rich" the query looks (longer / more
 * clauses = more searches), then clamped to whatever is explicitly
 * requested and to the remaining daily quota.
 */
function pickSearchCount(depth, query, requestedSearches, remainingQuota) {
  const { min, max } = BUDGETS[depth];
  const wordCount = query.trim().split(/\s+/).filter(Boolean).length;
  const clauseBoost = (query.match(/,| and | or /gi) || []).length;

  let count;
  if (Number.isFinite(requestedSearches)) {
    count = requestedSearches;
  } else {
    const richness = Math.min(1, (wordCount / 40) + clauseBoost * 0.15);
    count = Math.round(min + richness * (max - min));
  }

  count = Math.min(Math.max(count, min), max);
  count = Math.min(count, Math.max(remainingQuota, 0));
  return Math.max(count, remainingQuota > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// 2. Quota trackers — self-imposed daily caps so the free LangSearch quota
//    is never burned through by one big "enterprise" request. Reset at UTC
//    midnight. Purely in-memory (per server process) by design — this
//    agent has no database of its own and doesn't touch anyone else's.
// ---------------------------------------------------------------------------

const DAILY_SEARCH_LIMIT = Number(process.env.WAVESEARCH_DAILY_SEARCH_QUOTA) || 1000;
const DAILY_TOKEN_LIMIT = Number(process.env.WAVESEARCH_DAILY_TOKEN_QUOTA) || 500000;

const WARN_THRESHOLD = 0.8;
const PAUSE_THRESHOLD = 0.95;

function nextMidnightUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function makeQuota(limit) {
  return { used: 0, resetsAt: nextMidnightUTC(), limit };
}

const searchQuotaState = makeQuota(DAILY_SEARCH_LIMIT);
const tokenQuotaState = makeQuota(DAILY_TOKEN_LIMIT);

function rollover(state) {
  if (Date.now() >= state.resetsAt.getTime()) {
    state.used = 0;
    state.resetsAt = nextMidnightUTC();
  }
}

function snapshot(state) {
  rollover(state);
  return {
    dailyLimit: state.limit,
    used: state.used,
    remaining: Math.max(state.limit - state.used, 0),
    resetsAt: state.resetsAt.toISOString(),
    usedRatio: state.limit > 0 ? state.used / state.limit : 0,
  };
}

function getQuota() {
  return snapshot(searchQuotaState);
}

function getTokenQuota() {
  return snapshot(tokenQuotaState);
}

function recordUsage(n) {
  rollover(searchQuotaState);
  searchQuotaState.used += n;
}

function recordTokenUsage(n) {
  rollover(tokenQuotaState);
  tokenQuotaState.used += Math.max(n, 0);
}

/**
 * Items 6-7 of the quota protection list: warn at 80%, pause new
 * deep/enterprise searches at 95% by quietly downgrading the effective
 * depth so the request still succeeds, just with a smaller budget.
 */
function applyQuotaProtections(depth) {
  const search = getQuota();
  const tokens = getTokenQuota();
  const usedRatio = Math.max(search.usedRatio, tokens.usedRatio);
  const warnings = [];
  let effectiveDepth = depth;

  if (usedRatio >= PAUSE_THRESHOLD && (depth === "deep" || depth === "enterprise")) {
    effectiveDepth = "normal";
    warnings.push(
      `Daily quota at ${Math.round(usedRatio * 100)}% (≥95%) — new ${depth} searches are paused; ` +
      `automatically falling back to 'normal' depth to conserve the remaining quota.`
    );
  } else if (usedRatio >= WARN_THRESHOLD) {
    warnings.push(`Daily quota at ${Math.round(usedRatio * 100)}% — approaching the daily limit.`);
  }

  return { effectiveDepth, warnings, search, tokens };
}

// ---------------------------------------------------------------------------
// 3. Duplicate-search cache (quota protection item #2) — identical sub-
//    queries within the TTL window are served from cache instead of
//    spending another LangSearch call.
// ---------------------------------------------------------------------------

const DUPLICATE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const searchCache = new Map(); // normalizedQuery -> { results, expiresAt }

function normalizeQuery(q) {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function getCached(subQuery) {
  const entry = searchCache.get(normalizeQuery(subQuery));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(normalizeQuery(subQuery));
    return null;
  }
  return entry.results;
}

function setCached(subQuery, results) {
  searchCache.set(normalizeQuery(subQuery), { results, expiresAt: Date.now() + DUPLICATE_CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// 4. Multi-angle sub-query expansion — so N searches genuinely research the
//    topic from N different angles instead of repeating the same query.
// ---------------------------------------------------------------------------

const ANGLES = [
  "",
  "overview",
  "latest news and updates",
  "detailed analysis",
  "statistics and data",
  "pros and cons",
  "expert opinions and commentary",
  "case studies and real examples",
  "comparison with alternatives",
  "history and background",
  "future trends and predictions",
  "challenges and risks",
  "best practices",
  "official sources and documentation",
  "reviews and user experiences",
  "how it works",
  "key benefits",
  "common mistakes to avoid",
  "cost and pricing",
  "frequently asked questions",
  "recent research and studies",
  "regulations and compliance",
  "market size and growth",
  "key players and competitors",
  "regional and global perspective",
  "technical details and specifications",
  "economic impact",
  "social impact",
  "criticism and controversies",
  "practical use cases",
];

// Human-readable section headers for each angle, used to group the final
// answer into themed sections instead of one flat list of sentences.
const ANGLE_LABELS = {
  "": "Overview",
  "overview": "Overview",
  "latest news and updates": "Latest Developments",
  "detailed analysis": "Detailed Analysis",
  "statistics and data": "Statistics & Data",
  "pros and cons": "Pros & Cons",
  "expert opinions and commentary": "Expert Opinions",
  "case studies and real examples": "Case Studies",
  "comparison with alternatives": "Comparisons",
  "history and background": "Background & History",
  "future trends and predictions": "Future Trends",
  "challenges and risks": "Risks & Challenges",
  "best practices": "Best Practices",
  "official sources and documentation": "Official Sources",
  "reviews and user experiences": "Reviews & Experiences",
  "how it works": "How It Works",
  "key benefits": "Key Benefits",
  "common mistakes to avoid": "Common Mistakes",
  "cost and pricing": "Cost & Pricing",
  "frequently asked questions": "FAQs",
  "recent research and studies": "Recent Research",
  "regulations and compliance": "Regulations & Compliance",
  "market size and growth": "Market Size & Growth",
  "key players and competitors": "Key Players",
  "regional and global perspective": "Regional Perspective",
  "technical details and specifications": "Technical Details",
  "economic impact": "Economic Impact",
  "social impact": "Social Impact",
  "criticism and controversies": "Criticism & Controversies",
  "practical use cases": "Use Cases",
};

function angleLabel(angle) {
  const base = (angle || "").replace(/\s*\(part \d+\)$/, "");
  return ANGLE_LABELS[base] || "Additional Findings";
}

const MAX_SEARCHABLE_QUERY_LENGTH = 150;

/**
 * LangSearch (like most web search APIs) expects a short, keyword-style
 * query — not an essay. A multi-hundred-word research brief sent verbatim
 * trips a generic "web search error" from LangSearch. This derives a short,
 * punctuation-cleaned search phrase from the first part of the query, while
 * the full original `query` is still used for relevance scoring, citations,
 * and the response/report.
 */
function toSearchableQuery(query, maxLen = MAX_SEARCHABLE_QUERY_LENGTH) {
  const sanitized = query
    .replace(/["'""''(){}\[\];:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (sanitized.length <= maxLen) return sanitized;
  const truncated = sanitized.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).trim();
}

function buildSubQueries(query, count) {
  const subQueries = [];
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    const angle = ANGLES[i % ANGLES.length];
    const wrap = i >= ANGLES.length ? ` (part ${Math.floor(i / ANGLES.length) + 1})` : "";
    const subQuery = angle ? `${query} ${angle}${wrap}` : `${query}${wrap}`;
    const key = normalizeQuery(subQuery);
    if (seen.has(key)) continue; // belt-and-braces: never send a literal duplicate
    seen.add(key);
    subQueries.push({ subQuery, angle });
  }
  return subQueries;
}

// ---------------------------------------------------------------------------
// 5. Run the searches — bounded concurrency, cache-aware, relevance-filtered
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "of", "in", "on", "for", "to",
  "and", "or", "with", "about", "what", "who", "when", "where", "why", "how",
  "does", "do", "it", "this", "that", "be", "as", "at", "by", "into",
]);

function significantTerms(query) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Quota protection item #3: keep only webpages that actually mention the
 * query's significant terms, instead of letting every raw search hit
 * through (which wastes tokens downstream).
 */
function isRelevant(result, terms) {
  const text = `${result.title || ""} ${result.content || ""}`.toLowerCase();
  if (text.trim().length < 10) return false;
  if (terms.length === 0) return true;
  return terms.some((t) => text.includes(t));
}

async function runInBatches(items, concurrency, worker) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(worker));
    results.push(...settled);
  }
  return results;
}

function describeSearchError(err) {
  return err.response?.data?.error || err.response?.data?.message || err.message || "Unknown LangSearch error";
}

function isRateLimitError(err) {
  if (err.response?.status === 429) return true;
  const message = describeSearchError(err).toLowerCase();
  return /qps|rate limit|concurrency|too many requests/.test(message);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * LangSearch's free tier enforces a QPS/concurrency cap. Firing too many
 * sub-searches at once trips "QPS or search concurrency limit reached" —
 * this retries just those with jittered exponential backoff instead of
 * giving up on the first rate-limit hit.
 */
async function withRateLimitRetry(fn, { retries = 3, baseDelayMs = 500 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimitError(err) || attempt >= retries) throw err;
      await sleep(baseDelayMs * 2 ** attempt + Math.random() * 200);
    }
  }
}

// LangSearch's QPS cap means we can't fire many sub-searches at once —
// keep this low rather than maximizing parallelism.
const SEARCH_CONCURRENCY = Number(process.env.WAVESEARCH_SEARCH_CONCURRENCY) || 3;

async function runSearches(subQueryObjs, { maxResultsPerSearch, apiKey, queryTerms }) {
  let apiCallsUsed = 0;
  let cacheHits = 0;
  let allResults = [];
  const errors = [];

  const settled = await runInBatches(subQueryObjs, SEARCH_CONCURRENCY, async ({ subQuery, angle }) => {
    const cached = getCached(subQuery);
    if (cached) {
      cacheHits += 1;
      return cached;
    }
    const data = await withRateLimitRetry(() =>
      langsearch.webSearch(subQuery, { maxResults: maxResultsPerSearch, apiKey })
    );
    const results = (data.results || []).map((r) => ({ ...r, angle }));
    setCached(subQuery, results);
    apiCallsUsed += 1;
    return results;
  });

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      allResults.push(...outcome.value);
    } else {
      const message = describeSearchError(outcome.reason || {});
      console.error("[wavesearch] LangSearch call failed:", message);
      if (!errors.includes(message)) errors.push(message);
    }
  }

  allResults = allResults.filter((r) => isRelevant(r, queryTerms));
  return { allResults, apiCallsUsed, cacheHits, errors };
}

/**
 * Normalizes a URL for dedup purposes: scheme and "www." don't make two
 * pages different, nor does a trailing slash or a tracking query string
 * (?utm_source=..., ?ref=..., etc.) — all common reasons the same article
 * showed up under what looked like a different URL.
 */
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${host}${path}`.toLowerCase();
  } catch {
    return (url || "").trim().toLowerCase();
  }
}

function normalizeTitle(title) {
  return (title || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Dedupes on normalized URL AND on exact title match — two different URLs
 * with the identical headline are almost always the same syndicated/mirrored
 * article, not two independent sources.
 */
function dedupeByUrl(allResults) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const deduped = [];
  for (const r of allResults) {
    const urlKey = r.url ? normalizeUrl(r.url) : "";
    const titleKey = normalizeTitle(r.title);
    if (!urlKey && !titleKey) continue;
    if (urlKey && seenUrls.has(urlKey)) continue;
    if (titleKey && titleKey.length > 15 && seenTitles.has(titleKey)) continue;
    if (urlKey) seenUrls.add(urlKey);
    if (titleKey && titleKey.length > 15) seenTitles.add(titleKey);
    deduped.push(r);
  }
  return deduped;
}

// ---------------------------------------------------------------------------
// 6. Full webpage text — quota protection item #4: only the most important
//    (top-ranked) sources get a real page fetch; everything else stays on
//    the cheap LangSearch snippet.
// ---------------------------------------------------------------------------

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFullText(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: 6000,
      maxContentLength: 2 * 1024 * 1024,
      headers: { "User-Agent": "WaveSearchAgent/1.0 (+research-bot)" },
      responseType: "text",
    });
    const text = htmlToText(String(data));
    return text.slice(0, 3000) || null;
  } catch {
    return null; // not important enough to fail the whole request over
  }
}

async function enrichImportantSources(sources, fullTextCount) {
  if (fullTextCount <= 0) return sources;
  const important = sources.slice(0, fullTextCount);
  const rest = sources.slice(fullTextCount);

  const enriched = await Promise.all(
    important.map(async (s) => {
      const fullText = await fetchFullText(s.url);
      return fullText ? { ...s, fullText, fullTextFetched: true } : { ...s, fullTextFetched: false };
    })
  );

  return [...enriched, ...rest];
}

// ---------------------------------------------------------------------------
// 7. Sources + report ("file") builder
// ---------------------------------------------------------------------------

function buildSources(results, limit) {
  return results.slice(0, limit).map((r, i) => ({
    id: i + 1,
    title: r.title,
    url: r.url,
    snippet: (r.content || "").slice(0, 400),
    publishedDate: r.publishedDate || null,
    topic: r.angle !== undefined ? angleLabel(r.angle) : null,
  }));
}

function estimateTokens(text) {
  return Math.ceil((text || "").length / 4);
}

/**
 * Quota protection item #1: cap how much source text this request reads
 * to the depth's token budget (full text for important sources first,
 * then snippets for the rest, stopping once the budget is spent).
 */
function buildContext(sources, tokenBudget) {
  const lines = [];
  let used = 0;

  for (const s of sources) {
    const body = s.fullText || s.snippet || "";
    const line = `[${s.id}] ${s.title}\n${body}\nSource: ${s.url}`;
    const lineTokens = estimateTokens(line);
    if (used + lineTokens > tokenBudget && lines.length > 0) break;
    lines.push(line);
    used += lineTokens;
  }

  return { context: lines.join("\n\n"), contextTokens: used };
}

// ---------------------------------------------------------------------------
// 7b. Extractive answer synthesis — built entirely in-process from the live
//     LangSearch results. No other agent, and no external LLM, is involved:
//     sentences are pulled straight out of the sources that best match the
//     query's significant terms, favoring the sources important enough to
//     have had their full webpage text fetched.
// ---------------------------------------------------------------------------

const ANSWER_SENTENCE_COUNT = { simple: 3, normal: 6, deep: 12, enterprise: 18 };
const MAX_SENTENCES_PER_SOURCE = 3;

function splitSentences(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 400);
}

function scoreSentence(sentence, terms) {
  const lower = sentence.toLowerCase();
  return terms.reduce((score, t) => (lower.includes(t) ? score + 1 : score), 0);
}

// The order sections appear in when multiple are present — reads roughly
// like a research brief rather than a random grab-bag of bullet points.
const SECTION_ORDER = [
  "Overview", "Background & History", "How It Works", "Key Players",
  "Market Size & Growth", "Statistics & Data", "Comparisons", "Pros & Cons",
  "Case Studies", "Technical Details", "Regulations & Compliance",
  "Risks & Challenges", "Criticism & Controversies", "Economic Impact",
  "Social Impact", "Expert Opinions", "Recent Research", "Latest Developments",
  "Future Trends", "Best Practices", "Common Mistakes", "Cost & Pricing",
  "Reviews & Experiences", "Regional Perspective", "Use Cases",
  "Official Sources", "Detailed Analysis", "FAQs", "Additional Findings",
];

function buildExtractiveAnswer(query, sources, depth, searchError) {
  const terms = significantTerms(query);
  const maxSentences = ANSWER_SENTENCE_COUNT[depth] || 6;

  const candidates = [];
  for (const s of sources) {
    const sentences = splitSentences(s.fullText || s.snippet || "");
    for (const sentence of sentences) {
      const score = scoreSentence(sentence, terms);
      if (score === 0) continue;
      candidates.push({
        sentence,
        score: score + (s.fullTextFetched ? 0.5 : 0),
        sourceId: s.id,
        section: s.topic || "Additional Findings",
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const picked = [];
  const perSourceCount = {};
  const seenSentences = new Set();
  for (const c of candidates) {
    if (picked.length >= maxSentences) break;
    const countForSource = perSourceCount[c.sourceId] || 0;
    if (countForSource >= MAX_SENTENCES_PER_SOURCE) continue;
    const key = c.sentence.toLowerCase().slice(0, 50);
    if (seenSentences.has(key)) continue;
    seenSentences.add(key);
    perSourceCount[c.sourceId] = countForSource + 1;
    picked.push(c);
  }

  if (picked.length === 0) {
    if (searchError) {
      return `Live search could not be completed — every LangSearch call for this request failed with: "${searchError}". ` +
        `This is a search backend error (misconfiguration, rate limiting, or an outage), ` +
        `not an indication that no results exist for "${query}". Retrying, lowering \`maxResultsPerSearch\`/\`depth\`, ` +
        `or checking the LangSearch API key/quota should resolve it.`;
    }
    return sources.length > 0
      ? `No sentence in the retrieved sources directly matched "${query}" closely enough to extract — see the sources below for the raw material found.`
      : `No live search results were found for "${query}". Try rephrasing the query, or forcing a deeper \`depth\`.`;
  }

  // Group into sections so the answer reads like a structured brief. With
  // only one section worth of content, skip headers and keep it a flat list.
  const bySection = new Map();
  for (const p of picked) {
    if (!bySection.has(p.section)) bySection.set(p.section, []);
    bySection.get(p.section).push(p);
  }

  const intro = `Based on ${picked.length} point${picked.length > 1 ? "s" : ""} pulled from ${new Set(picked.map((p) => p.sourceId)).size} live source(s) for "${query}":`;

  if (bySection.size <= 1) {
    const lines = picked.map((p) => `- ${p.sentence} [${p.sourceId}]`);
    return `${intro}\n\n${lines.join("\n")}`;
  }

  const orderedSections = [...bySection.keys()].sort(
    (a, b) => SECTION_ORDER.indexOf(a) - SECTION_ORDER.indexOf(b)
  );

  const blocks = orderedSections.map((section) => {
    const lines = bySection.get(section).map((p) => `- ${p.sentence} [${p.sourceId}]`);
    return `### ${section}\n${lines.join("\n")}`;
  });

  return `${intro}\n\n${blocks.join("\n\n")}`;
}

/**
 * Chart-ready data (plain {labels, values} series — consumable by any
 * bar/pie chart component without a UI needing to know this agent's
 * internals) so a frontend can render research coverage visually instead
 * of just reading JSON.
 */
function buildChartData({ sources, quota, tokenQuota, tokenUsage }) {
  const topicCounts = new Map();
  for (const s of sources) {
    const topic = s.topic || "Additional Findings";
    topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
  }
  const sortedTopics = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]);

  return {
    sourcesByTopic: {
      type: "bar",
      labels: sortedTopics.map(([topic]) => topic),
      values: sortedTopics.map(([, count]) => count),
    },
    searchQuotaUsage: {
      type: "pie",
      labels: ["Used today", "Remaining today"],
      values: [quota.used, quota.remaining],
    },
    tokenUsageBreakdown: {
      type: "pie",
      labels: ["Input (sources read)", "Output (answer generated)"],
      values: [tokenUsage.input, tokenUsage.output],
    },
  };
}

function buildReportMarkdown({
  query, depth, requestedDepth, searchesPlanned, searchesUsed, cacheHits,
  quota, tokenQuota, tokenUsage, warnings, answer, sources, groundedInLiveResults, searchError,
}) {
  const sourceLines = sources.length
    ? sources.map((s) => `${s.id}. [${s.title}](${s.url})${s.publishedDate ? ` — ${s.publishedDate}` : ""}${s.fullTextFetched ? " _(full text)_" : ""}\n   > ${(s.fullText || s.snippet).replace(/\n/g, " ").slice(0, 400)}`).join("\n\n")
    : "_No live sources were found for this query._";

  const warningLines = warnings.length ? warnings.map((w) => `- ⚠️ ${w}`).join("\n") : "- none";
  const depthLine = requestedDepth !== depth ? `${requestedDepth} → downgraded to ${depth} (quota protection)` : depth;
  const errorLine = searchError ? `\n**⚠️ Search backend error:** ${searchError} — check the LangSearch API key, quota, and rate limits for this server.\n` : "";

  return `# WaveSearch Research Report

**Query:** ${query}
**Depth:** ${depthLine} (${searchesUsed}/${searchesPlanned} new searches, ${cacheHits} served from cache)
**Grounded in live results:** ${groundedInLiveResults ? "yes" : "no"}
**Generated:** ${new Date().toISOString()}
${errorLine}
## Answer

${answer || "_No answer generated._"}

## Sources (${sources.length})

${sourceLines}

## Quota & Budget

- Search quota: ${quota.used}/${quota.dailyLimit} used, ${quota.remaining} remaining (resets ${quota.resetsAt})
- Token quota: ${tokenQuota.used}/${tokenQuota.dailyLimit} used, ${tokenQuota.remaining} remaining (resets ${tokenQuota.resetsAt})
- This request's tokens: input ${tokenUsage.input}, output ${tokenUsage.output}, total ${tokenUsage.total}
- Warnings:
${warningLines}
`;
}

// ---------------------------------------------------------------------------
// 8. Queue + resume (quota protection item #8) — if quota is fully
//    exhausted, the research request is saved instead of run half-starved,
//    and can be resumed once the daily quota resets. In-memory only (this
//    agent, like the others in this repo, has no database), so the queue's
//    lifetime is tied to this server process.
// ---------------------------------------------------------------------------

const pendingJobs = new Map(); // id -> job
const JOB_TTL_MS = 24 * 60 * 60 * 1000;

function isExhausted() {
  const search = getQuota();
  const tokens = getTokenQuota();
  return search.remaining <= 0 || tokens.remaining <= 0;
}

function queueJob(query, options) {
  const id = crypto.randomUUID();
  const search = getQuota();
  const tokens = getTokenQuota();
  const resumeAfter = search.remaining <= 0 ? search.resetsAt : tokens.resetsAt;

  pendingJobs.set(id, {
    id,
    query,
    options,
    status: "queued",
    createdAt: new Date().toISOString(),
    resumeAfter,
    result: null,
  });

  return { jobId: id, resumeAfter };
}

async function tryResumeJob(id) {
  const job = pendingJobs.get(id);
  if (!job) return { status: "not_found" };

  if (job.status === "completed") return job;

  if (isExhausted()) {
    return { status: "queued", jobId: id, resumeAfter: job.resumeAfter, query: job.query };
  }

  job.status = "running";
  try {
    const result = await _researchCore(job.query, job.options);
    job.status = "completed";
    job.result = result;
    job.completedAt = new Date().toISOString();
  } catch (err) {
    job.status = "queued"; // leave it queued, caller can retry later
    throw err;
  }
  return job;
}

// Best-effort background sweep: once quota resets, automatically run any
// queued jobs so the caller doesn't even have to hit /resume manually.
const sweepInterval = setInterval(() => {
  if (pendingJobs.size === 0 || isExhausted()) return;
  for (const [id, job] of pendingJobs) {
    if (job.status === "queued") {
      tryResumeJob(id).catch(() => {});
    }
    if (job.status === "completed" && Date.now() - new Date(job.completedAt).getTime() > JOB_TTL_MS) {
      pendingJobs.delete(id);
    }
  }
}, 60 * 1000);
if (sweepInterval.unref) sweepInterval.unref();

// ---------------------------------------------------------------------------
// 9. Orchestrator
// ---------------------------------------------------------------------------

/**
 * `apiKey` override (langsearchApiKey) may be passed per-request, same
 * convention as the rest of this repo. WaveSearch talks to LangSearch
 * only — no other agent's key or service is involved anywhere below.
 */
async function _researchCore(query, {
  depth: explicitDepth,
  searches: requestedSearches,
  maxResultsPerSearch = 5,
  maxSources = 15,
  langsearchApiKey,
} = {}) {
  const requestedDepth = classifyDepth(query, explicitDepth);
  const { effectiveDepth: depth, warnings } = applyQuotaProtections(requestedDepth);

  const quotaBefore = getQuota();
  const searchesPlanned = pickSearchCount(depth, query, requestedSearches, quotaBefore.remaining);
  const queryTerms = significantTerms(query);
  const searchableQuery = toSearchableQuery(query);
  const subQueries = buildSubQueries(searchableQuery, searchesPlanned);

  let searchesUsed = 0;
  let cacheHits = 0;
  let deduped = [];
  let searchErrors = [];

  if (subQueries.length > 0) {
    const { allResults, apiCallsUsed, cacheHits: hits, errors } = await runSearches(subQueries, {
      maxResultsPerSearch,
      apiKey: langsearchApiKey,
      queryTerms,
    });
    searchesUsed = apiCallsUsed;
    cacheHits = hits;
    searchErrors = errors;
    recordUsage(apiCallsUsed); // only real API calls spend quota, not cache hits
    deduped = dedupeByUrl(allResults);
  }

  // Only surfaced as a hard error when EVERY sub-search failed (not a single
  // flaky one) — otherwise a partial result set is reported normally.
  const searchError = searchesUsed === 0 && cacheHits === 0 && searchErrors.length > 0
    ? searchErrors[0]
    : null;

  let sources = buildSources(deduped, maxSources);
  sources = await enrichImportantSources(sources, FULL_TEXT_SOURCE_COUNT[depth] || 0);

  const groundedInLiveResults = sources.length > 0;
  const tokenBudget = TOKEN_BUDGETS[depth];
  const { contextTokens } = buildContext(sources, tokenBudget);

  const answer = buildExtractiveAnswer(query, sources, depth, searchError);

  const tokenUsage = {
    input: contextTokens,
    output: estimateTokens(answer),
    total: contextTokens + estimateTokens(answer),
  };
  recordTokenUsage(tokenUsage.total);

  const quota = getQuota();
  const tokenQuota = getTokenQuota();
  const tokenBudgetExceeded = tokenUsage.total > tokenBudget * 1.5;

  if (searchError) {
    warnings.push(`LangSearch calls failed: ${searchError}`);
  }

  const reportMarkdown = buildReportMarkdown({
    query, depth, requestedDepth, searchesPlanned, searchesUsed, cacheHits,
    quota, tokenQuota, tokenUsage, warnings,
    answer, sources, groundedInLiveResults, searchError,
  });

  const chartData = buildChartData({ sources, quota, tokenQuota, tokenUsage });

  return {
    status: "completed",
    query,
    depth,
    requestedDepth,
    searchesPlanned,
    searchesUsed,
    cacheHits,
    quota,
    tokenQuota,
    tokenBudget,
    tokenUsage,
    tokenBudgetExceeded,
    warnings,
    searchError,
    answer,
    sources,
    sourceCount: sources.length,
    groundedInLiveResults,
    chartData,
    reportMarkdown,
  };
}

/**
 * Public entry point. If the daily search or token quota is already fully
 * exhausted, the request is saved as a queued job instead of being run
 * half-starved — call `/api/wavesearch/resume/:jobId` after `resumeAfter`
 * (or just wait; a background sweep resumes it automatically once quota
 * resets, as long as this server process is still running).
 */
async function research(query, options = {}) {
  if (isExhausted()) {
    const { jobId, resumeAfter } = queueJob(query, options);
    return {
      status: "queued",
      jobId,
      resumeAfter,
      query,
      message: "Daily quota exhausted — this research request has been saved and will resume automatically after the quota resets.",
      quota: getQuota(),
      tokenQuota: getTokenQuota(),
    };
  }
  return _researchCore(query, options);
}

module.exports = {
  BUDGETS,
  TOKEN_BUDGETS,
  classifyDepth,
  pickSearchCount,
  getQuota,
  getTokenQuota,
  research,
  resumeJob: tryResumeJob,
};
