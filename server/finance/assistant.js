import { Router } from "express";
import rateLimit from "express-rate-limit";

const MODEL = "google/gemma-4-26b-a4b-it:free";
const URL = "https://openrouter.ai/api/v1/chat/completions";
const noOriginCheck = (_req, _res, next) => next();

export function validateFinanceQuestion(body) {
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const summary = body?.summary;
  if (!question || question.length > 500) return { error: "Ask a question in 1–500 characters." };
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return { error: "A compact finance summary is required." };
  const allowedKeys = new Set(["month", "currency", "income", "expenses", "balance", "savingsRate", "categories"]);
  if (Object.keys(summary).some((key) => !allowedKeys.has(key))) return { error: "Only compact aggregate finance totals can be submitted." };
  const { month, currency, income, expenses, balance, savingsRate, categories = [] } = summary;
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month) || typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) return { error: "The finance summary is invalid." };
  for (const value of [income, expenses, balance, savingsRate]) if (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000) return { error: "The finance summary contains invalid totals." };
  if (!Array.isArray(categories) || categories.length > 12 || categories.some((item) => !item || typeof item.name !== "string" || item.name.length > 40 || !Number.isFinite(item.amount) || item.amount < 0)) return { error: "Category summary is invalid." };
  return { value: { question, summary: { month, currency, income, expenses, balance, savingsRate, categories } } };
}

export function createFinanceAssistantRouter({ getApiKey = () => process.env.OPENROUTER_API_KEY?.trim(), fetchImpl = globalThis.fetch, verifySameOrigin = noOriginCheck } = {}) {
  const router = Router();
  const limiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false, handler: (_req, res) => res.status(429).json({ error: "Finance AI is busy. Wait a moment and retry." }) });
  router.get("/status", verifySameOrigin, (_req, res) => res.json({ configured: Boolean(getApiKey()?.trim() && !/^your_key_here$/i.test(getApiKey().trim())), model: MODEL }));
  router.post("/ask", verifySameOrigin, limiter, async (req, res) => {
    const checked = validateFinanceQuestion(req.body);
    if (checked.error) return res.status(400).json({ error: checked.error });
    const key = getApiKey()?.trim();
    if (!key || /^your_key_here$/i.test(key)) return res.status(503).json({ error: "Optional finance AI is not configured. The local tracker is still available." });
    try {
      const upstream = await fetchImpl(URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: MODEL, provider: { allow_fallbacks: false }, temperature: 0.3, max_tokens: 500, messages: [{ role: "system", content: "Explain personal budgeting using only the supplied compact totals. Do not claim to be a financial adviser. Do not recommend investments, loans, or financial products. State when the summary does not answer the question. Keep the answer practical and concise." }, { role: "user", content: JSON.stringify(checked.value) }] }), signal: AbortSignal.timeout(25_000) });
      if (upstream.status === 429) return res.status(429).json({ error: "The free Gemma model is rate-limited or busy. Retry later; no paid model fallback was attempted." });
      if (!upstream.ok) return res.status(503).json({ error: "The free finance assistant is unavailable right now. Retry later; no paid model fallback is configured." });
      const payload = await upstream.json();
      const answer = payload?.choices?.[0]?.message?.content;
      if (typeof answer !== "string" || !answer.trim() || answer.length > 4000) return res.status(502).json({ error: "The AI response was incomplete. Retry, or use the local calculations." });
      return res.json({ answer: answer.trim(), model: MODEL });
    } catch {
      return res.status(502).json({ error: "The finance assistant could not reach OpenRouter. Your local tracker still works." });
    }
  });
  return router;
}
