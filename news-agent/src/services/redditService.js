const axios = require("axios");

const client = axios.create({
  headers: { "User-Agent": "newspulse-agent/1.0 (https://github.com/Adityakumar0723/Agentic-Ai-Repo)" },
  timeout: 10000,
});

async function fetchSubreddit(subreddit, limit = 15, sort = "hot") {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${sort}.json`;
  const { data } = await client.get(url, { params: { limit } });

  return data.data.children.map((c) => ({
    source: `reddit/${subreddit}`,
    title: c.data.title,
    link: `https://reddit.com${c.data.permalink}`,
    summary: c.data.selftext ? c.data.selftext.slice(0, 300) : null,
    author: c.data.author,
    upvotes: c.data.ups,
    numComments: c.data.num_comments,
    publishedAt: new Date(c.data.created_utc * 1000).toISOString(),
  }));
}

async function searchReddit(query, limit = 15) {
  const url = `https://www.reddit.com/search.json`;
  const { data } = await client.get(url, { params: { q: query, limit, sort: "relevance" } });

  return data.data.children.map((c) => ({
    source: `reddit/${c.data.subreddit}`,
    title: c.data.title,
    link: `https://reddit.com${c.data.permalink}`,
    summary: c.data.selftext ? c.data.selftext.slice(0, 300) : null,
    author: c.data.author,
    upvotes: c.data.ups,
    numComments: c.data.num_comments,
    publishedAt: new Date(c.data.created_utc * 1000).toISOString(),
  }));
}

module.exports = { fetchSubreddit, searchReddit };
