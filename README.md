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
