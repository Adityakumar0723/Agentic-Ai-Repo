const express = require("express");
const rss = require("../services/rssService");
const reddit = require("../services/redditService");
const { CATEGORIES, getCategoryForSource, getSourcesForCategory, listCategories } = require("../services/categories");

const router = express.Router();

router.get("/sources", (req, res) => {
  res.json({
    total: rss.listSourceKeys().length,
    categories: listCategories(),
    sources: rss.listSources(),
  });
});

router.get("/categories", (req, res) => {
  res.json({ categories: listCategories() });
});

router.get("/category/:name", async (req, res) => {
  try {
    const cat = req.params.name.toLowerCase();
    const keys = getSourcesForCategory(cat);
    if (!keys.length) {
      return res.status(404).json({ error: `Unknown category "${req.params.name}"`, availableCategories: listCategories().map((c) => c.name) });
    }
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const { articles, failed } = await rss.fetchMultipleSources(keys, limit);
    res.json({
      category: cat,
      count: articles.length,
      sourcesTotal: keys.length,
      sourcesOk: keys.length - failed.length,
      sourcesFailed: failed.length,
      articles,
      ...(failed.length > 0 && { skippedSources: failed.map((f) => f.source) }),
    });
  } catch (err) {
    res.json({ category: req.params.name, count: 0, articles: [], warning: `Unexpected error: ${err.message}` });
  }
});

router.get("/feed/:source", async (req, res) => {
  try {
    const result = await rss.fetchSource(req.params.source);

    if (result && result.status === 404) {
      return res.status(404).json({ error: result.error });
    }

    if (result && result.skipped) {
      return res.json({
        source: req.params.source,
        count: 0,
        articles: [],
        warning: `Source "${req.params.source}" temporarily unavailable: ${result.error}. Try again shortly.`,
      });
    }

    const articles = Array.isArray(result) ? result : [];
    res.json({ source: req.params.source, count: articles.length, articles });
  } catch (err) {
    res.json({
      source: req.params.source,
      count: 0,
      articles: [],
      warning: `Unexpected error: ${err.message}`,
    });
  }
});

router.get("/all", async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const { articles, failed } = await rss.fetchAllSources(limit);

    res.json({
      count: articles.length,
      sourcesTotal: rss.listSourceKeys().length,
      sourcesOk: rss.listSourceKeys().length - failed.length,
      sourcesFailed: failed.length,
      articles,
      ...(failed.length > 0 && { skippedSources: failed.map((f) => f.source) }),
    });
  } catch (err) {
    res.json({
      count: 0,
      sourcesTotal: rss.listSourceKeys().length,
      sourcesOk: 0,
      sourcesFailed: 0,
      articles: [],
      warning: `Unexpected error: ${err.message}`,
    });
  }
});

router.get("/search", async (req, res) => {
  const { q, limit } = req.query;
  if (!q) return res.status(400).json({ error: "Query param 'q' is required" });

  try {
    const parsedLimit = limit ? Number(limit) : 15;

    const [newsData, redditData] = await Promise.all([
      rss.searchArticles(q, parsedLimit),
      reddit.searchReddit(q, parsedLimit),
    ]);

    res.json({
      query: q,
      count: newsData.results.length + redditData.posts.length,
      sourcesSearched: rss.listSourceKeys().length,
      sourcesFailed: newsData.failed.length,
      news: newsData.results,
      reddit: redditData.posts,
      ...(redditData.error && { redditWarning: redditData.error }),
      ...(newsData.failed.length > 0 && { skippedSources: newsData.failed.map((f) => f.source) }),
    });
  } catch (err) {
    res.json({
      query: q,
      count: 0,
      sourcesSearched: 0,
      sourcesFailed: 0,
      news: [],
      reddit: [],
      warning: `Unexpected error: ${err.message}`,
    });
  }
});

router.get("/reddit/:subreddit", async (req, res) => {
  try {
    const { limit, sort } = req.query;
    const result = await reddit.fetchSubreddit(
      req.params.subreddit,
      limit ? Number(limit) : 15,
      sort || "hot"
    );

    res.json({
      subreddit: req.params.subreddit,
      count: result.posts.length,
      posts: result.posts,
      ...(result.error && { warning: result.error }),
    });
  } catch (err) {
    res.json({
      subreddit: req.params.subreddit,
      count: 0,
      posts: [],
      warning: `Unexpected error: ${err.message}`,
    });
  }
});

module.exports = router;
