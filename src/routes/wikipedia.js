const express = require("express");
const wiki = require("../services/wikipediaService");

const router = express.Router();

router.get("/search", async (req, res, next) => {
  try {
    const { q, limit } = req.query;
    if (!q) return res.status(400).json({ error: "Query param 'q' is required" });

    const results = await wiki.searchArticles(q, limit ? Number(limit) : 10);
    res.json({ query: q, count: results.length, results });
  } catch (err) {
    next(err);
  }
});

router.get("/summary/:title", async (req, res, next) => {
  try {
    const data = await wiki.getSummary(req.params.title);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/page/:title", async (req, res, next) => {
  try {
    const data = await wiki.getFullContent(req.params.title);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/random", async (req, res, next) => {
  try {
    const data = await wiki.getRandomArticle();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
