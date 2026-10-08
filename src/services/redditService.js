const axios = require("axios");

const client = axios.create({
  headers: { "User-Agent": "globalwire-agent/2.0 (https://github.com/Adityakumar0723/Agentic-Ai-Repo)" },
  timeout: 8000,
});

function normalizePost(c, subreddit) {
  return {
    source: `reddit/${c.data.subreddit || subreddit}`,
    title: c.data.title || null,
    link: c.data.permalink ? `https://reddit.com${c.data.permalink}` : null,
    summary: c.data.selftext ? c.data.selftext.slice(0, 300) : null,
    author: c.data.author || null,
    upvotes: c.data.ups || 0,
    numComments: c.data.num_comments || 0,
    publishedAt: c.data.created_utc
      ? new Date(c.data.created_utc * 1000).toISOString()
      : null,
  };
}

async function fetchSubreddit(subreddit, limit = 15, sort = "hot") {
  try {
    const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${sort}.json`;
    const { data } = await client.get(url, { params: { limit } });
    return {
      posts: (data.data.children || []).map((c) => normalizePost(c, subreddit)),
      error: null,
    };
  } catch (err) {
    return {
      posts: [],
      error: `Reddit r/${subreddit} unavailable: ${err.message}`,
    };
  }
}

async function searchReddit(query, limit = 15) {
  try {
    const url = `https://www.reddit.com/search.json`;
    const { data } = await client.get(url, { params: { q: query, limit, sort: "relevance" } });
    return {
      posts: (data.data.children || []).map((c) => normalizePost(c)),
      error: null,
    };
  } catch (err) {
    return {
      posts: [],
      error: `Reddit search unavailable: ${err.message}`,
    };
  }
}

module.exports = { fetchSubreddit, searchReddit };
