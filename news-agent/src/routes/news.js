const express = require("express");
const rss = require("../services/rssService");
const reddit = require("../services/redditService");

const router = express.Router();

router.get("/sources", (req, res) => {
  res.json({ sources: rss.listSources() });
});

router.get("/feed/:source", async (req, res, next) => {
  try {
    const articles = await rss.fetchSource(req.params.source);
    res.json({ source: req.params.source, count: articles.length, articles });
  } catch (err) {
    next(err);
  }
});

router.get("/all", async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const articles = await rss.fetchAllSources(limit);
    res.json({ count: articles.length, articles });
  } catch (err) {
    next(err);
  }
});

router.get("/search", async (req, res, next) => {
  try {
    const { q, limit } = req.query;
    if (!q) return res.status(400).json({ error: "Query param 'q' is required" });

    const [newsResults, redditResults] = await Promise.all([
      rss.searchArticles(q, limit ? Number(limit) : 15),
      reddit.searchReddit(q, limit ? Number(limit) : 15).catch(() => []),
    ]);

    res.json({
      query: q,
      count: newsResults.length + redditResults.length,
      news: newsResults,
      reddit: redditResults,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/reddit/:subreddit", async (req, res, next) => {
  try {
    const { limit, sort } = req.query;
    const posts = await reddit.fetchSubreddit(
      req.params.subreddit,
      limit ? Number(limit) : 15,
      sort || "hot"
    );
    res.json({ subreddit: req.params.subreddit, count: posts.length, posts });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
