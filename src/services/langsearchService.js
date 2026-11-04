const axios = require("axios");

const BASE = "https://api.langsearch.com/v1/web-search";

function resolveKey(apiKey) {
  const key = apiKey || process.env.LANGSEARCH_API_KEY;
  if (!key) {
    const error = new Error("LANGSEARCH_API_KEY is not configured on the server");
    error.status = 500;
    throw error;
  }
  return key;
}

const FRESHNESS_MAP = {
  day: "oneDay",
  week: "oneWeek",
  month: "oneMonth",
  year: "oneYear",
};

function mapResults(items = []) {
  return items.map((r) => ({
    title: r.name || r.displayUrl || r.url,
    url: r.url,
    content: r.text || r.snippet || "",
    score: null,
    publishedDate: r.datePublished || null,
  }));
}

async function search(query, { count = 10, freshness, apiKey } = {}) {
  const key = resolveKey(apiKey);

  const { data } = await axios.post(
    BASE,
    {
      query,
      count: Math.min(Math.max(count, 1), 50),
      freshness: freshness || "noLimit",
    },
    {
      timeout: 20000,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
    }
  );

  return {
    query: data.data?.queryContext?.originalQuery || query,
    results: mapResults(data.data?.webPages?.value),
  };
}

/**
 * `apiKey` may be passed per-request (e.g. forwarded from an incoming
 * LANGSEARCH_API_KEY header) and takes priority over the server's own
 * LANGSEARCH_API_KEY environment variable.
 */
async function webSearch(query, { maxResults = 10, timeRange, apiKey } = {}) {
  const { query: q, results } = await search(query, {
    count: maxResults,
    freshness: FRESHNESS_MAP[timeRange],
    apiKey,
  });

  return { query: q, results, responseTime: null };
}

async function newsSearch(query, { maxResults = 10, timeRange = "week", apiKey } = {}) {
  const { query: q, results } = await search(query, {
    count: maxResults,
    freshness: FRESHNESS_MAP[timeRange] || "oneWeek",
    apiKey,
  });

  return { query: q, results };
}

module.exports = {
  webSearch,
  newsSearch,
};
