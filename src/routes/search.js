const express = require("express");
const tavily = require("../services/tavilyService");

const router = express.Router();

router.get("/search", async (req, res, next) => {
  try {
    const { q, maxResults, depth, timeRange } = req.query;
    if (!q) return res.status(400).json({ error: "Query param 'q' is required" });

    const data = await tavily.webSearch(q, {
      maxResults: maxResults ? Number(maxResults) : undefined,
      searchDepth: depth,
      timeRange,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/news", async (req, res, next) => {
  try {
    const { q, maxResults, timeRange } = req.query;
    if (!q) return res.status(400).json({ error: "Query param 'q' is required" });

    const data = await tavily.newsSearch(q, {
      maxResults: maxResults ? Number(maxResults) : undefined,
      timeRange,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/answer", async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Query param 'q' is required" });

    const data = await tavily.aiAnswer(q);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
