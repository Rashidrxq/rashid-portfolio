import test from "node:test";
import assert from "node:assert/strict";
import { createFinanceAssistantRouter, validateFinanceQuestion } from "./assistant.js";
import express from "express";
import { once } from "node:events";

test("accepts bounded question with compact aggregates", () => {
  const result = validateFinanceQuestion({ question: "Where did I spend most?", summary: { month: "2026-06", currency: "INR", income: 100, expenses: 90, balance: 10, savingsRate: 10, categories: [{ name: "Food", amount: 90 }] } });
  assert.equal(result.value.summary.categories[0].name, "Food");
});

test("rejects missing question and individual transaction payload", () => {
  assert.match(validateFinanceQuestion({ summary: {} }).error, /question/i);
  assert.match(validateFinanceQuestion({ question: "hello", summary: { month: "2026-06", currency: "INR", income: 1, expenses: 0, balance: 1, savingsRate: 100, transactions: [{ description: "private" }] } }).error, /summary|aggregate/i);
});

test("rejects invalid totals", () => {
  const result = validateFinanceQuestion({ question: "hi", summary: { month: "2026-06", currency: "INR", income: Infinity, expenses: 1, balance: 0, savingsRate: 0 } });
  assert.match(result.error, /invalid totals/i);
});

test("server sends only compact totals to fixed free model and handles provider busy", async (t) => {
  let upstreamStatus = 200;
  let captured;
  const app = express(); app.use(express.json());
  app.use("/api/finance", createFinanceAssistantRouter({ getApiKey: () => "test-secret", verifySameOrigin: (_req,_res,next)=>next(), fetchImpl: async (_url, options) => { captured = { headers: options.headers, body: JSON.parse(options.body) }; return { status: upstreamStatus, ok: upstreamStatus === 200, json: async () => ({ choices: [{ message: { content: "Review the largest category first." } }] }) }; } }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const payload = { question: "What should I review?", summary: { month: "2026-06", currency: "INR", income: 100, expenses: 90, balance: 10, savingsRate: 10, categories: [{ name: "Food", amount: 90 }] } };
  let response = await fetch(`${origin}/api/finance/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).answer, "Review the largest category first.");
  assert.equal(captured.body.model, "google/gemma-4-26b-a4b-it:free");
  assert.deepEqual(captured.body.provider, { allow_fallbacks: false });
  assert.equal(captured.headers.Authorization, "Bearer test-secret");
  assert.equal(JSON.stringify(captured.body).includes("transaction description"), false);
  upstreamStatus = 429;
  response = await fetch(`${origin}/api/finance/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  assert.equal(response.status, 429);
  assert.match((await response.json()).error, /no paid model fallback/i);
});
