const axios = require("axios");

const BASE = "https://api.tavily.com";

function resolveKey(apiKey) {
  const key = apiKey || process.env.TAVILY_API_KEY;
  if (!key) {
    const error = new Error("TAVILY_API_KEY is not configured on the server");
    error.status = 500;
    throw error;
  }
  return key;
}

/**
 * `apiKey` may be passed per-request (e.g. forwarded from an incoming
 * TAVILY_API_KEY header) and takes priority over the server's own
 * TAVILY_API_KEY environment variable.
 */
async function webSearch(query, { maxResults = 10, searchDepth = "basic", timeRange, apiKey } = {}) {
  const key = resolveKey(apiKey);
  const { data } = await axios.post(
    `${BASE}/search`,
    {
      api_key: key,
      query,
      search_depth: searchDepth,
      topic: "general",
      max_results: maxResults,
      time_range: timeRange,
      include_answer: false,
    },
    { timeout: 20000, headers: { "Content-Type": "application/json" } }
  );

  return {
    query: data.query || query,
    results: (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
      publishedDate: r.published_date || null,
    })),
    responseTime: data.response_time || null,
  };
}

async function newsSearch(query, { maxResults = 10, timeRange = "week", apiKey } = {}) {
  const key = resolveKey(apiKey);
  const { data } = await axios.post(
    `${BASE}/search`,
    {
      api_key: key,
      query,
      topic: "news",
      max_results: maxResults,
      time_range: timeRange,
      include_answer: false,
    },
    { timeout: 20000, headers: { "Content-Type": "application/json" } }
  );

  return {
    query: data.query || query,
    results: (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      publishedDate: r.published_date || null,
      score: r.score,
    })),
  };
}

module.exports = {
  webSearch,
  newsSearch,
};
