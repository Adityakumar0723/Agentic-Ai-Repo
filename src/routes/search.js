const express = require("express");
const tavily = require("../services/tavilyService");
const sarvam = require("../services/sarvamService");

const router = express.Router();

function buildContext(results = []) {
  return results
    .slice(0, 5)
    .map((r, i) => `${i + 1}. ${r.title}\n${r.content}\nSource: ${r.url}`)
    .join("\n\n");
}

// Allows keys to be supplied per-request (e.g. by a GPT/agent builder's
// Authentication tab injecting them as headers), falling back to the
// server's own TAVILY_API_KEY / SARVAM_API_KEY environment variables.
function getKeys(req) {
  return {
    tavilyApiKey: req.get("TAVILY_API_KEY") || req.get("x-tavily-api-key"),
    sarvamApiKey: req.get("SARVAM_API_KEY") || req.get("x-sarvam-api-key"),
  };
}

router.get("/search", async (req, res, next) => {
  const { q, maxResults, depth, timeRange } = req.query;
  if (!q) return res.status(400).json({ error: "Query param 'q' is required" });
  const { tavilyApiKey, sarvamApiKey } = getKeys(req);

  let searchData = null;
  try {
    searchData = await tavily.webSearch(q, {
      maxResults: maxResults ? Number(maxResults) : undefined,
      searchDepth: depth,
      timeRange,
      apiKey: tavilyApiKey,
    });
  } catch (err) {
    // Live search unavailable — Sarvam AI will still answer from its own knowledge.
  }

  try {
    const context = searchData ? buildContext(searchData.results) : undefined;
    const answerData = await sarvam.aiAnswer(q, { context, apiKey: sarvamApiKey });
    res.json({
      query: q,
      answer: answerData.answer,
      results: searchData?.results || [],
      groundedInLiveResults: Boolean(searchData),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/news", async (req, res, next) => {
  const { q, maxResults, timeRange } = req.query;
  if (!q) return res.status(400).json({ error: "Query param 'q' is required" });
  const { tavilyApiKey, sarvamApiKey } = getKeys(req);

  let newsData = null;
  try {
    newsData = await tavily.newsSearch(q, {
      maxResults: maxResults ? Number(maxResults) : undefined,
      timeRange,
      apiKey: tavilyApiKey,
    });
  } catch (err) {
    // Live news search unavailable — Sarvam AI will still answer from its own knowledge.
  }

  try {
    const context = newsData ? buildContext(newsData.results) : undefined;
    const answerData = await sarvam.aiAnswer(q, { context, apiKey: sarvamApiKey });
    res.json({
      query: q,
      answer: answerData.answer,
      results: newsData?.results || [],
      groundedInLiveResults: Boolean(newsData),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/answer", async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Query param 'q' is required" });
    const { sarvamApiKey } = getKeys(req);

    const data = await sarvam.aiAnswer(q, { apiKey: sarvamApiKey });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
