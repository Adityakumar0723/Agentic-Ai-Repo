const axios = require("axios");

const API_KEY = process.env.SARVAM_API_KEY;
const BASE = "https://api.sarvam.ai";

function requireKey() {
  if (!API_KEY) {
    const error = new Error("SARVAM_API_KEY is not configured on the server");
    error.status = 500;
    throw error;
  }
}

const client = axios.create({
  baseURL: BASE,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    "api-subscription-key": API_KEY,
  },
});

/**
 * AI-generated answer via Sarvam AI's chat completion API. Sarvam itself
 * doesn't crawl the live web, so the question is answered directly from the
 * model's own knowledge — a fast, conversational "ask and get an answer"
 * experience, similar in spirit to Leo AI.
 */
async function aiAnswer(query, { model = "sarvam-105b-conversations" } = {}) {
  requireKey();

  const { data } = await client.post("/v1/chat/completions", {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a helpful search assistant. Answer the user's question clearly and concisely, in plain language.",
      },
      { role: "user", content: query },
    ],
  });

  const choice = data.choices?.[0];

  return {
    query,
    answer: choice?.message?.content || null,
    model: data.model || model,
    usage: data.usage || null,
  };
}

module.exports = {
  aiAnswer,
};
