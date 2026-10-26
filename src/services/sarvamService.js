const axios = require("axios");

const BASE = "https://api.sarvam.ai";

function resolveKey(apiKey) {
  const key = apiKey || process.env.SARVAM_API_KEY;
  if (!key) {
    const error = new Error("SARVAM_API_KEY is not configured on the server");
    error.status = 500;
    throw error;
  }
  return key;
}

/**
 * AI-generated answer via Sarvam AI's chat completion API. When `context`
 * (live search snippets) is supplied, Sarvam grounds its answer in that
 * context; otherwise it answers directly from its own knowledge. Either way,
 * Sarvam AI is the one generating the final response to the user's query.
 *
 * `apiKey` may be passed per-request (e.g. forwarded from an incoming
 * SARVAM_API_KEY header) and takes priority over the server's own
 * SARVAM_API_KEY environment variable.
 */
async function aiAnswer(query, { model = "sarvam-105b-conversations", context, apiKey } = {}) {
  const key = resolveKey(apiKey);

  const systemPrompt = context
    ? `You are a helpful search assistant. Use the following live search results to answer the user's question clearly and concisely. Cite facts from the results where relevant, and mention if the results don't fully answer the question.\n\nSearch results:\n${context}`
    : "You are a helpful search assistant. Answer the user's question clearly and concisely, in plain language.";

  const { data } = await axios.post(
    `${BASE}/v1/chat/completions`,
    {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
    },
    {
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": key,
      },
    }
  );

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
