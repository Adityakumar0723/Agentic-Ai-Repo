require("dotenv").config();
const express = require("express");
const cors = require("cors");
const wikipediaRoutes = require("./routes/wikipedia");
const newsRoutes = require("./routes/news");

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
        description: "Search, summarize, and extract full Wikipedia articles",
        endpoints: {
          search: "/api/wikipedia/search?q=<query>&limit=<n>",
          summary: "/api/wikipedia/summary/:title",
          fullPage: "/api/wikipedia/page/:title",
          random: "/api/wikipedia/random",
        },
      },
      globalwire: {
        description: "Live news from 143 verified RSS feeds + Reddit",
        endpoints: {
          sources: "/api/news/sources",
          feed: "/api/news/feed/:source",
          all: "/api/news/all?limit=<n>",
          search: "/api/news/search?q=<query>&limit=<n>",
          reddit: "/api/news/reddit/:subreddit?limit=<n>&sort=<hot|new|top>",
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
