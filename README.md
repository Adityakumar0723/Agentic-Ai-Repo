# Wikipedia Agent

> 🥇 **This is the first agent in the Agentic-Ai-Repo.**

**Wikipedia Agent** is a backend that turns any free-text query into real, structured Wikipedia knowledge — no scraping, no manual lookups, no copy-pasting from the browser.

Type literally anything — a person, a place, an event, a concept, even a vague or misspelled phrase — and the agent:

1. **Searches** Wikipedia for the articles that best match the query (`/search`)
2. **Resolves** the right one and pulls a clean, short **summary** with description, thumbnail, and link (`/summary/:title`)
3. **Extracts the full article** — complete text, categories, canonical URL — when you need the whole page, not just the gist (`/page/:title`)
4. Can also hand back a **random article** for discovery or testing (`/random`)

Every response is plain JSON straight from Wikipedia's own REST and Action APIs, so the data is always accurate, current, and sourced directly — never paraphrased or hallucinated.

Built as a clean, self-contained reference agent: a real external API wired up behind a simple REST interface, containerized with Docker, documented with a full OpenAPI schema, and deployed live.

**Live:** https://serverless.on-demand.io/apps/agentic-ai

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Server runs on `http://localhost:5000` by default.

### Run with Docker

```bash
docker build -t wikipedia-agent .
docker run -p 5000:5000 wikipedia-agent
```

## Endpoints

- `GET /health` — health check
- `GET /api/wikipedia/search?q=<query>&limit=<n>` — search Wikipedia articles
- `GET /api/wikipedia/summary/:title` — short summary + thumbnail for a title
- `GET /api/wikipedia/page/:title` — full article text, categories, URL
- `GET /api/wikipedia/random` — full content of a random article

Full request/response schema: [openapi.yaml](openapi.yaml)

## Example

```bash
curl "http://localhost:5000/api/wikipedia/page/India"
```

---

# Sarvam AI Agent

**Sarvam AI Agent** always answers through Sarvam AI — every query, on every endpoint, gets a direct, synthesized answer from the Sarvam AI chat model. LangSearch is used behind the scenes purely to fetch live web/news snippets that ground Sarvam's answer in current information; if LangSearch is ever unavailable, Sarvam still answers from its own knowledge instead of erroring out.

1. **Web search** — Sarvam AI answers the query, grounded in live LangSearch web results, which are also returned raw (`/search`)
2. **News search** — Sarvam AI answers the query, grounded in live LangSearch news results, which are also returned raw (`/news`)
3. **AI answer** — a direct, conversational answer with no search grounding, generated purely by Sarvam AI's chat model (`/answer`)

Requires two free API keys:
- **Sarvam AI**: a `SARVAM_API_KEY` ([sarvam.ai](https://www.sarvam.ai), free tier, no card needed) — this is the core of the agent
- **LangSearch**: a `LANGSEARCH_API_KEY` ([langsearch.com](https://langsearch.com), free tier, no card needed) — used only to ground `/search` and `/news` in live results

Set both in `.env`.

## Endpoints

- `GET /api/search/search?q=<query>&maxResults=<n>&timeRange=<day|week|month|year>` — Sarvam AI answer, grounded via LangSearch web search
- `GET /api/search/news?q=<query>&maxResults=<n>&timeRange=<day|week|month|year>` — Sarvam AI answer, grounded via LangSearch news search
- `GET /api/search/answer?q=<query>` — pure Sarvam AI answer, no search grounding

## Example

```bash
curl "http://localhost:5000/api/search/answer?q=What+is+retrieval+augmented+generation"
```

---

# WaveSearch Agent

**WaveSearch Agent** is a brand-new, fully standalone agent — it does not share code with, depend on, or call the Wikipedia, GlobalWire, or Sarvam AI agents above. It only talks to LangSearch for live search; every answer is synthesized in-process, extractively, straight from those results, plus a downloadable markdown sources report.

Its core feature is the **Smart Search Budget System**: every query is classified into a research depth, and that depth decides how many LangSearch calls get spent researching it from different angles (overview, statistics, pros/cons, expert opinion, case studies, etc.), so free-tier quota is never wasted on simple questions and is spent generously on real research requests.

| Depth | Searches spent | Example |
| --- | --- | --- |
| `simple` | 1–2 | "what is the capital of France" |
| `normal` | 3–5 | "compare React and Vue for a new project" |
| `deep` | 10–20 | "in-depth analysis of the EV battery supply chain" |
| `enterprise` | 20–50 | "comprehensive market research report on the Indian fintech industry" |

Depth is auto-detected from the query, or can be forced with `&depth=`. A built-in daily quota tracker (`WAVESEARCH_DAILY_SEARCH_QUOTA`, default 1000 searches/day, resets at UTC midnight) caps every request so a single "enterprise" call can never burn through the whole free LangSearch quota — if quota is low, the agent transparently spends fewer searches than the bucket would normally allow.

Requires only one free API key — `LANGSEARCH_API_KEY`, set in `.env`. No other agent's key is needed; `SARVAM_API_KEY` is irrelevant to WaveSearch.

## Endpoints

- `GET /api/wavesearch/search?q=<query>&depth=<simple|normal|deep|enterprise>&searches=<n>&maxResultsPerSearch=<n>&maxSources=<n>` — runs the budgeted research and returns the extractively-synthesized answer, the deduped source list, and a markdown report
- `GET /api/wavesearch/report?q=<query>&depth=<...>&download=<true|false>` — same research, returned as a downloadable `.md` report file (`Content-Disposition: attachment` by default; pass `download=false` to view inline)
- `GET /api/wavesearch/quota` — current daily search + token budget status (`used`, `remaining`, `resetsAt`)
- `GET /api/wavesearch/resume/:jobId` — resume a research request that was queued because the daily quota was exhausted

## Example

```bash
curl "http://localhost:5000/api/wavesearch/search?q=deep+dive+into+quantum+computing+startups&depth=deep"
curl "http://localhost:5000/api/wavesearch/report?q=what+is+LangSearch" -o report.md
```
