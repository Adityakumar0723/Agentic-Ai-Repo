# GlobalWire Agent

> **Second agent in the Agentic-Ai-Repo** (alongside the [Wikipedia Agent](../README.md)).

**GlobalWire** is your personal news wire service — one API call and you tap into **143 live news feeds across 6 continents, 16 categories, and every major topic a user could ever search for**. World politics, India, tech, crypto, science, space, health, climate, sports, cricket, F1, gaming, music, entertainment, AI research — it's all here, unified into a single, clean JSON feed. No API keys. No logins. No scraping hacks.

User queries "AI"? Headlines from TechCrunch, Wired, MIT Tech Review, OpenAI Blog, DeepMind Blog, plus 130+ other sources.
User queries "cricket"? ESPNCricinfo, Sportskeeda, NDTV Sports, BBC Sport, Sky Sports.
User queries "Bitcoin"? CoinDesk, CoinTelegraph, The Block, Decrypt, Bloomberg, CNBC.
User queries "climate change"? Guardian Environment, Mongabay, Carbon Brief, Climate Home, BBC Science.
User queries literally anything? **There's always an answer.**

## How it works

Every call hits real RSS feeds and Reddit's public API in real-time — no caching, no stale data, always the latest published articles. One `/search` query fans out across all 143 sources + Reddit simultaneously and returns every match.

## Coverage (143 verified feeds + Reddit)

| Category | Count | Sources |
|---|---|---|
| **World News** | 40 | BBC (6 feeds), CNN (4 feeds), Guardian (5 feeds), Al Jazeera, NPR (3 feeds), PBS, Sky News, DW, France24, NHK, Axios, The Hill, NYT (7 feeds), Fox News, ABC News, CBS News, Vox, Slate, Newsweek, HuffPost |
| **Asia-Pacific** | 7 | SCMP, Straits Times, ABC Australia, CBC Canada, Japan Times, Bangkok Post, Channel News Asia |
| **India** | 14 | NDTV (2 feeds), Times of India (3 feeds), Hindustan Times, The Hindu, Indian Express, Economic Times (2 feeds), Livemint, India Today, Business Standard, News18 |
| **Europe** | 8 | Le Monde, Der Spiegel, El Pais, Euronews, Irish Times, DutchNews, The Local Sweden, RTE Ireland |
| **Middle East** | 1 | Jerusalem Post |
| **Latin America** | 1 | MercoPress |
| **Africa** | 1 | AllAfrica |
| **Business & Finance** | 8 | Bloomberg, CNBC (2 feeds), MarketWatch, Business Insider, Financial Times, Moneycontrol, Seeking Alpha |
| **Crypto & Fintech** | 4 | CoinDesk, CoinTelegraph, The Block, Decrypt |
| **Technology** | 21 | TechCrunch, The Verge, Wired, Ars Technica, Engadget, Hacker News, Mashable, ZDNet, Tom's Hardware, Android Central, 9to5Mac, 9to5Google, The Next Web, Gizmodo, CNET, TechRadar, The Register, Slashdot, PCWorld, MacRumors, MIT Tech Review |
| **Science & Space** | 6 | Science Daily, NASA, New Scientist, Phys.org, Space.com, Live Science |
| **Health & Medicine** | 2 | WHO News, STAT News |
| **Environment & Climate** | 3 | Mongabay, Carbon Brief, Climate Home News |
| **Sports** | 7 | ESPN (3 feeds), Sky Sports, Sportskeeda, ESPNCricinfo, Formula 1 |
| **Entertainment** | 4 | Variety, Hollywood Reporter, Deadline, TMZ |
| **Gaming** | 8 | Polygon, IGN, Kotaku, Eurogamer, GameSpot, PC Gamer, Rock Paper Shotgun, Nintendo Life |
| **Music** | 5 | Billboard, Rolling Stone, Pitchfork, NME, Stereogum |
| **Education** | 1 | MIT News |
| **AI & ML** | 2 | OpenAI Blog, DeepMind Blog |
| **Reddit** | Any | Any public subreddit (r/worldnews, r/technology, r/india, r/gaming, etc.) |

> **Why no Facebook/Instagram/X?** These platforms block unauthenticated access and scraping violates their Terms of Service. GlobalWire only uses legitimately public feeds. Reddit's public endpoint may return 403 from data-center IPs — this is Reddit's anti-bot blocking, not a bug.

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
| `GET` | `/api/news/sources` | List all 143 configured source keys |
| `GET` | `/api/news/feed/:source` | Latest articles from one source (e.g. `bbc`, `techcrunch`, `coindesk`) |
| `GET` | `/api/news/all?limit=<n>` | Latest articles aggregated across every source |
| `GET` | `/api/news/search?q=<query>&limit=<n>` | Search a keyword across all 143 sources + Reddit |
| `GET` | `/api/news/reddit/:subreddit?limit=<n>&sort=<hot\|new\|top>` | Posts from any public subreddit |

Full request/response schema: [openapi.yaml](openapi.yaml)

## Examples

```bash
# Search "AI" across all 143 sources + Reddit
curl "http://localhost:5100/api/news/search?q=ai"

# Get BBC headlines
curl "http://localhost:5100/api/news/feed/bbc"

# Get crypto news from CoinDesk
curl "http://localhost:5100/api/news/feed/coindesk"

# Get everything from every source (5 per source)
curl "http://localhost:5100/api/news/all?limit=5"

# Browse r/technology
curl "http://localhost:5100/api/news/reddit/technology?sort=hot&limit=10"

# Search for cricket news
curl "http://localhost:5100/api/news/search?q=cricket"

# Get climate news
curl "http://localhost:5100/api/news/feed/mongabay"
```
