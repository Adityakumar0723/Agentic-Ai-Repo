const express = require("express");
const wavesearch = require("../services/wavesearchService");

const router = express.Router();

// Allows a LangSearch key to be supplied per-request, same convention used
// by search.js. WaveSearch does not call Sarvam AI or any other agent.
function getKeys(req) {
  return {
    langsearchApiKey: req.get("LANGSEARCH_API_KEY") || req.get("x-langsearch-api-key"),
  };
}

function parseOptions(req) {
  const { depth, searches, maxResultsPerSearch, maxSources } = req.query;
  const { langsearchApiKey } = getKeys(req);
  return {
    depth,
    searches: searches !== undefined ? Number(searches) : undefined,
    maxResultsPerSearch: maxResultsPerSearch !== undefined ? Number(maxResultsPerSearch) : undefined,
    maxSources: maxSources !== undefined ? Number(maxSources) : undefined,
    langsearchApiKey,
  };
}

router.get("/search", async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Query param 'q' is required" });

    const options = parseOptions(req);
    const result = await wavesearch.research(q, options);
    if (result.status === "queued") return res.status(202).json(result);

    const { reportMarkdown, ...data } = result;
    res.json({ ...data, reportMarkdown });
  } catch (err) {
    next(err);
  }
});

router.get("/report", async (req, res, next) => {
  try {
    const { q, download } = req.query;
    if (!q) return res.status(400).json({ error: "Query param 'q' is required" });

    const options = parseOptions(req);
    const result = await wavesearch.research(q, options);
    if (result.status === "queued") return res.status(202).json(result);

    const filename = `wavesearch-report-${Date.now()}.md`;
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    if (download !== "false") {
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }
    res.send(result.reportMarkdown);
  } catch (err) {
    next(err);
  }
});

router.get("/resume/:jobId", async (req, res, next) => {
  try {
    const job = await wavesearch.resumeJob(req.params.jobId);
    if (job.status === "not_found") return res.status(404).json({ error: "No queued job with that id" });
    if (job.status === "completed") return res.json({ status: "completed", jobId: job.id, ...job.result });
    res.status(202).json(job);
  } catch (err) {
    next(err);
  }
});

router.get("/quota", (req, res) => {
  res.json({ search: wavesearch.getQuota(), tokens: wavesearch.getTokenQuota() });
});

module.exports = router;
