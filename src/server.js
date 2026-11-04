require("dotenv").config();
const express = require("express");
const cors = require("cors");
const wikipediaRoutes = require("./routes/wikipedia");
const newsRoutes = require("./routes/news");
const searchRoutes = require("./routes/search");
const wavesearchRoutes = require("./routes/wavesearch");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "Agentic AI — Unified Agent Backend",
    status: "running",
    agents: {
      wikipedia: {
        description: "Search 60M+ Wikipedia articles — instant access to the world's largest encyclopedia for ANY knowledge query",
        endpoints: {
          search: "/api/wikipedia/search?q=<query>&limit=<n>",
          summary: "/api/wikipedia/summary/:title",
          fullPage: "/api/wikipedia/page/:title",
          random: "/api/wikipedia/random",
        },
      },
      globalwire: {
        description: "Live news from 275000+ verified RSS feeds across 100+ categories — Reddit, Medium, Dev.to, Hashnode, YouTube, arXiv, podcasts, newsletters, tech blogs, Substack, Tumblr, Flipboard, WordPress, Google News (80+ countries), StackExchange, real newspapers, company blogs, university news, government feeds, international news & more",
        endpoints: {
          sources: "/api/news/sources",
          categories: "/api/news/categories",
          category: "/api/news/category/:name?limit=<n>",
          feed: "/api/news/feed/:source",
          all: "/api/news/all?limit=<n>",
          search: "/api/news/search?q=<query>&limit=<n>",
          reddit: "/api/news/reddit/:subreddit?limit=<n>&sort=<hot|new|top>",
        },
      },
      sarvamai: {
        description: "Every query is answered by Sarvam AI, grounded in live LangSearch search results when available (both free, no card required)",
        endpoints: {
          search: "/api/search/search?q=<query>&maxResults=<n>",
          news: "/api/search/news?q=<query>&maxResults=<n>",
          answer: "/api/search/answer?q=<query>",
        },
      },
      wavesearch: {
        description: "Smart Search Budget System — classifies each query as simple/normal/deep/enterprise research, spends 1-50 LangSearch calls across multiple angles accordingly (capped by a self-managed daily quota), then extractively synthesizes one grounded answer directly from the live results plus a downloadable markdown sources report (standalone — no other agent or external LLM involved)",
        endpoints: {
          search: "/api/wavesearch/search?q=<query>&depth=<simple|normal|deep|enterprise>&searches=<n>",
          report: "/api/wavesearch/report?q=<query>&depth=<simple|normal|deep|enterprise>&download=<true|false>",
          quota: "/api/wavesearch/quota",
        },
      },
    },
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/wikipedia", wikipediaRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/wavesearch", wavesearchRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  const status = err.response?.status || err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Agentic AI Backend running on http://localhost:${PORT}`);
});
