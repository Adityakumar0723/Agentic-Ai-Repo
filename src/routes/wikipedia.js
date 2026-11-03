const express = require("express");
const wiki = require("../services/wikipediaService");

const router = express.Router();

router.get("/search", async (req, res) => {
  try {
    const { q, limit } = req.query;
    if (!q) return res.status(400).json({ error: "Query param 'q' is required" });

    const results = await wiki.searchArticles(q, limit ? Number(limit) : 10);
    res.json({ query: q, count: results.length, results });
  } catch (err) {
    res.json({ query: req.query.q, count: 0, results: [], warning: `Wikipedia search temporarily unavailable: ${err.message}` });
  }
});

router.get("/summary/:title", async (req, res) => {
  try {
    const data = await wiki.getSummary(req.params.title);
    res.json(data);
  } catch (err) {
    res.json({ title: req.params.title, extract: null, warning: `Wikipedia summary temporarily unavailable: ${err.message}` });
  }
});

router.get("/page/:title", async (req, res) => {
  try {
    const data = await wiki.getFullContent(req.params.title);
    res.json(data);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.json({ title: req.params.title, content: null, warning: `Wikipedia page temporarily unavailable: ${err.message}` });
  }
});

router.get("/random", async (req, res) => {
  try {
    const data = await wiki.getRandomArticle();
    res.json(data);
  } catch (err) {
    res.json({ title: null, content: null, warning: `Wikipedia random temporarily unavailable: ${err.message}` });
  }
});

module.exports = router;
