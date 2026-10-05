# Wikipedia Agent

Node.js + Express backend that fetches information directly from Wikipedia (search, summary, full article content, random articles).

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
