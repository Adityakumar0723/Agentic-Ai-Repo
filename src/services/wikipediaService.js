const axios = require("axios");

const LANG = process.env.WIKI_LANG || "en";
const REST_BASE = `https://${LANG}.wikipedia.org/api/rest_v1`;
const ACTION_BASE = `https://${LANG}.wikipedia.org/w/api.php`;

const client = axios.create({
  headers: { "User-Agent": "wikipedia-agent/1.0 (https://github.com/Adityakumar0723/Agentic-Ai-Repo)" },
  timeout: 10000,
});

async function searchArticles(query, limit = 10) {
  const { data } = await client.get(ACTION_BASE, {
    params: {
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: limit,
      format: "json",
      origin: "*",
    },
  });

  return data.query.search.map((result) => ({
    title: result.title,
    snippet: result.snippet.replace(/<\/?span[^>]*>/g, ""),
    pageId: result.pageid,
    wordCount: result.wordcount,
    timestamp: result.timestamp,
  }));
}

async function getSummary(title) {
  const { data } = await client.get(`${REST_BASE}/page/summary/${encodeURIComponent(title)}`);
  return {
    title: data.title,
    description: data.description,
    extract: data.extract,
    thumbnail: data.thumbnail?.source || null,
    image: data.originalimage?.source || null,
    url: data.content_urls?.desktop?.page || null,
    lang: data.lang,
  };
}

async function getFullContent(title) {
  const { data } = await client.get(ACTION_BASE, {
    params: {
      action: "query",
      prop: "extracts|categories|info|pageimages",
      exintro: false,
      explaintext: true,
      inprop: "url",
      titles: title,
      format: "json",
      origin: "*",
      pithumbsize: 500,
    },
  });

  const pages = data.query.pages;
  const page = pages[Object.keys(pages)[0]];

  if (page.missing !== undefined) {
    const error = new Error(`No Wikipedia page found for "${title}"`);
    error.status = 404;
    throw error;
  }

  return {
    pageId: page.pageid,
    title: page.title,
    url: page.fullurl,
    content: page.extract,
    categories: (page.categories || []).map((c) => c.title.replace("Category:", "")),
    thumbnail: page.thumbnail?.source || null,
  };
}

async function getRandomArticle() {
  const { data } = await client.get(ACTION_BASE, {
    params: {
      action: "query",
      list: "random",
      rnnamespace: 0,
      rnlimit: 1,
      format: "json",
      origin: "*",
    },
  });

  const title = data.query.random[0].title;
  return getFullContent(title);
}

module.exports = {
  searchArticles,
  getSummary,
  getFullContent,
  getRandomArticle,
};
