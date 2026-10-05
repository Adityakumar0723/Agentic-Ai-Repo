require("dotenv").config();
const express = require("express");
const cors = require("cors");
const wikipediaRoutes = require("./routes/wikipedia");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "Wikipedia Agent API",
    status: "running",
    endpoints: {
      search: "/api/wikipedia/search?q=<query>&limit=<n>",
      summary: "/api/wikipedia/summary/:title",
      fullPage: "/api/wikipedia/page/:title",
      random: "/api/wikipedia/random",
    },
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/wikipedia", wikipediaRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  const status = err.response?.status || err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Wikipedia Agent API running on http://localhost:${PORT}`);
});
