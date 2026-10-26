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

**Sarvam AI Agent** always answers through Sarvam AI — every query, on every endpoint, gets a direct, synthesized answer from the Sarvam AI chat model. Tavily is used behind the scenes purely to fetch live web/news snippets that ground Sarvam's answer in current information; if Tavily is ever unavailable, Sarvam still answers from its own knowledge instead of erroring out.

1. **Web search** — Sarvam AI answers the query, grounded in live Tavily web results, which are also returned raw (`/search`)
2. **News search** — Sarvam AI answers the query, grounded in live Tavily news results, which are also returned raw (`/news`)
3. **AI answer** — a direct, conversational answer with no search grounding, generated purely by Sarvam AI's chat model (`/answer`)

Requires two free API keys:
- **Sarvam AI**: a `SARVAM_API_KEY` ([sarvam.ai](https://www.sarvam.ai), free tier, no card needed) — this is the core of the agent
- **Tavily**: a `TAVILY_API_KEY` ([tavily.com](https://tavily.com), free tier, no card needed, 1,000 credits/month) — used only to ground `/search` and `/news` in live results

Set both in `.env`.

## Endpoints

- `GET /api/search/search?q=<query>&maxResults=<n>&depth=<basic|advanced>&timeRange=<day|week|month|year>` — Sarvam AI answer, grounded via Tavily web search
- `GET /api/search/news?q=<query>&maxResults=<n>&timeRange=<day|week|month|year>` — Sarvam AI answer, grounded via Tavily news search
- `GET /api/search/answer?q=<query>` — pure Sarvam AI answer, no search grounding

## Example

```bash
curl "http://localhost:5000/api/search/answer?q=What+is+retrieval+augmented+generation"
```
