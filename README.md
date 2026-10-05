# Wikipedia Agent

> 🥇 **This is the first agent in the Agentic-Ai-Repo.**

A lightweight Node.js + Express backend agent that talks directly to Wikipedia. Give it a topic and it searches, summarizes, and pulls the full article content back for you — no scraping, no manual lookups. Built as a clean, self-contained reference agent: a real external API wired up behind a simple REST interface, containerized, documented with an OpenAPI schema, and deployed live.

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
