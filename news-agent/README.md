# GlobalWire Agent

> **Second agent in the Agentic-Ai-Repo** (alongside the [Wikipedia Agent](../README.md)).

**GlobalWire** is your personal news wire service — one API call and you get live headlines from **85+ sources across 6 continents**, all unified into a single, clean JSON feed. No API keys. No logins. No scraping hacks. Just publicly available RSS feeds and Reddit's public API, aggregated and searchable in real-time.

## What it does

Ask it anything — "AI", "cricket", "stock market crash", "climate change" — and GlobalWire instantly pulls matching headlines from every major news outlet on the planet. One query, one response, every angle covered.

- **Search across everything** — type a keyword and get matching articles from BBC, CNN, NYT, Al Jazeera, NDTV, TechCrunch, ESPN, Bloomberg, and 75+ more, plus Reddit discussions, all in one response
- **Drill into a single source** — want just BBC headlines? Just TechCrunch? Just CNBC? Hit the feed endpoint with that source key
- **Firehose mode** — pull the latest articles from every source at once with `/all`
- **Reddit integration** — search Reddit or browse any public subreddit (hot/new/top), no auth needed
- **Always live** — every call hits the real RSS feed in real-time, so you always get the latest published articles

## Coverage

| Category | Sources |
|---|---|
| **World News** | BBC, BBC World, CNN, CNN World, The Guardian, Al Jazeera, NPR, PBS, Sky News, DW, France24, NHK, Axios, The Hill, NYT, NYT World, Fox News, ABC News, CBS News |
| **Asia-Pacific** | SCMP, Straits Times, ABC Australia, CBC Canada, Japan Times, Bangkok Post |
| **India** | NDTV, Times of India, Hindustan Times, The Hindu, Indian Express, Economic Times, Livemint, India Today |
| **Europe** | Le Monde, Der Spiegel, El Pais, Euronews, Irish Times, DutchNews |
| **Middle East** | Jerusalem Post |
| **Business & Finance** | Bloomberg, CNBC, CNBC World, MarketWatch, Business Insider, Financial Times, Moneycontrol, Seeking Alpha |
| **Technology** | TechCrunch, The Verge, Wired, Ars Technica, Engadget, Hacker News, Mashable, ZDNet, Tom's Hardware, Android Central, 9to5Mac, 9to5Google, The Next Web, Gizmodo, CNET, TechRadar |
| **Science & Space** | Science Daily, NASA, New Scientist, Phys.org, Space.com, Live Science |
| **Sports** | ESPN, Sky Sports, Sportskeeda |
| **Entertainment & Culture** | Variety, Hollywood Reporter, Deadline, Polygon, IGN, Kotaku, Billboard, Rolling Stone, Pitchfork |
| **Reddit** | Any public subreddit (r/worldnews, r/technology, r/india, etc.) |

> **Why no Facebook/Instagram/X?** These platforms block unauthenticated access and scraping violates their Terms of Service. GlobalWire only uses legitimately public feeds. Reddit's public endpoint may also return 403 from data-center IPs — this is Reddit's anti-bot blocking, not a bug.

## Setup

```bash
cd news-agent
npm install
cp .env.example .env
npm start
```

Server runs on `http://localhost:5100` by default.

### Run with Docker

```bash
docker build -t globalwire-agent .
docker run -p 5100:5100 globalwire-agent
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/news/sources` | List all configured source keys |
| `GET` | `/api/news/feed/:source` | Latest articles from one source (e.g. `bbc`, `techcrunch`) |
| `GET` | `/api/news/all?limit=<n>` | Latest articles aggregated across every source |
| `GET` | `/api/news/search?q=<query>&limit=<n>` | Search a keyword across all sources + Reddit |
| `GET` | `/api/news/reddit/:subreddit?limit=<n>&sort=<hot\|new\|top>` | Posts from a subreddit |

Full request/response schema: [openapi.yaml](openapi.yaml)

## Example

```bash
# Search "AI" across all sources + Reddit
curl "http://localhost:5100/api/news/search?q=ai"

# Get BBC headlines
curl "http://localhost:5100/api/news/feed/bbc"

# Get everything from every source
curl "http://localhost:5100/api/news/all?limit=5"

# Browse r/technology
curl "http://localhost:5100/api/news/reddit/technology?sort=hot&limit=10"
```
