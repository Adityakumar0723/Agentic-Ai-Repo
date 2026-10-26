const axios = require("axios");

const API_KEY = process.env.TAVILY_API_KEY;
const BASE = "https://api.tavily.com";

function requireKey() {
  if (!API_KEY) {
    const error = new Error("TAVILY_API_KEY is not configured on the server");
    error.status = 500;
    throw error;
  }
}

const client = axios.create({
  baseURL: BASE,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

async function webSearch(query, { maxResults = 10, searchDepth = "basic", timeRange } = {}) {
  requireKey();
  const { data } = await client.post("/search", {
    api_key: API_KEY,
    query,
    search_depth: searchDepth,
    topic: "general",
    max_results: maxResults,
    time_range: timeRange,
    include_answer: false,
  });

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

async function newsSearch(query, { maxResults = 10, timeRange = "week" } = {}) {
  requireKey();
  const { data } = await client.post("/search", {
    api_key: API_KEY,
    query,
    topic: "news",
    max_results: maxResults,
    time_range: timeRange,
    include_answer: false,
  });

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
