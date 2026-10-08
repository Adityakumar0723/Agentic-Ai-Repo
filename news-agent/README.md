# NewsPulse Agent

> 🥈 **Second agent in the Agentic-Ai-Repo** (alongside the [Wikipedia Agent](../README.md)).

A Node.js + Express backend that aggregates live news from major news outlets' RSS feeds and Reddit's public API into one unified JSON feed. Search across all of it with a single keyword query.

**51 verified RSS sources** across world news, India, business/finance, technology, science, sports, and entertainment — BBC, CNN, The Guardian, Al Jazeera, NPR, PBS, Sky News, DW, France 24, NHK, SCMP, Straits Times, ABC Australia, CBC Canada, Axios, The Hill, Fox News, NYT, NDTV, Times of India, Hindustan Times, The Hindu, Indian Express, Economic Times, Livemint, Bloomberg, CNBC, MarketWatch, Business Insider, FT, TechCrunch, The Verge, Wired, Ars Technica, Engadget, Hacker News, Mashable, ZDNet, Science Daily, NASA, New Scientist, ESPN, Sky Sports, Variety, Hollywood Reporter, Polygon, IGN, Jerusalem Post, Le Monde, Der Spiegel, El País — plus any public subreddit. See `src/services/sources.js` for the full list (easy to extend with more feeds).

> **Note on social platforms:** Facebook, Instagram, and X (Twitter) do not expose public, unauthenticated feeds — scraping them without an official paid/authorized API violates their Terms of Service and is actively blocked. This agent sticks to sources that are legitimately public: news RSS feeds and Reddit's public JSON API. Reddit's public endpoint can also rate-limit or block requests from data-center/cloud IPs (common on hosting platforms) — if `/api/news/reddit/:subreddit` returns a 403 in production, it means the host's IP got blocked by Reddit, not a bug in this code.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Server runs on `http://localhost:5100` by default.

### Run with Docker

```bash
docker build -t newspulse-agent .
docker run -p 5100:5100 newspulse-agent
```

## Endpoints

- `GET /health` — health check
- `GET /api/news/sources` — list all configured news sources
- `GET /api/news/feed/:source` — latest articles from one source (e.g. `bbc`, `cnn`, `techcrunch`)
- `GET /api/news/all?limit=<n>` — latest articles aggregated across every source
- `GET /api/news/search?q=<query>&limit=<n>` — search a keyword across all news sources + Reddit
- `GET /api/news/reddit/:subreddit?limit=<n>&sort=<hot|new|top>` — posts from a subreddit

Full request/response schema: [openapi.yaml](openapi.yaml)

## Example

```bash
curl "http://localhost:5100/api/news/search?q=artificial+intelligence"
```
