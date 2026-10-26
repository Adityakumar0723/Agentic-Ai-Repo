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

router.get("/search", async (req, res, next) => {
  const { q, maxResults, depth, timeRange } = req.query;
  if (!q) return res.status(400).json({ error: "Query param 'q' is required" });

  let searchData = null;
  try {
    searchData = await tavily.webSearch(q, {
      maxResults: maxResults ? Number(maxResults) : undefined,
      searchDepth: depth,
      timeRange,
    });
  } catch (err) {
    // Live search unavailable — Sarvam AI will still answer from its own knowledge.
  }

  try {
    const context = searchData ? buildContext(searchData.results) : undefined;
    const answerData = await sarvam.aiAnswer(q, { context });
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

  let newsData = null;
  try {
    newsData = await tavily.newsSearch(q, {
      maxResults: maxResults ? Number(maxResults) : undefined,
      timeRange,
    });
  } catch (err) {
    // Live news search unavailable — Sarvam AI will still answer from its own knowledge.
  }

  try {
    const context = newsData ? buildContext(newsData.results) : undefined;
    const answerData = await sarvam.aiAnswer(q, { context });
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

    const data = await sarvam.aiAnswer(q);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
