import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { createPdfAssistantRouter, validatePdfAssistantRequest } from "./assistant.js";

test("validates supported bounded text-only PDF AI payloads", () => {
  assert.deepEqual(validatePdfAssistantRequest({ task: "Fix grammar", text: "A draft sentence.", question: "" }).value, { task: "Fix grammar", text: "A draft sentence.", question: "" });
  assert.match(validatePdfAssistantRequest({ task: "Fix grammar", text: "x".repeat(4001) }).error, /too long/i);
  assert.match(validatePdfAssistantRequest({ task: "Run arbitrary code", text: "x" }).error, /supported/i);
  assert.match(validatePdfAssistantRequest({ task: "Summarize current page / selection" }).error, /select text|question/i);
  assert.match(validatePdfAssistantRequest({ task: "Explain current page / selection", text: "", question: "?".repeat(701) }).error, /too long/i);
});

test("sends snippets only to fixed free model, keeps API key server-side, and handles busy/malformed responses", async (t) => {
  let status = 200; let malformed = false; let captured;
  const app = express(); app.use(express.json());
  app.use("/api/pdf", createPdfAssistantRouter({ getApiKey: () => "unit-test-key", verifySameOrigin: (_req, _res, next) => next(), fetchImpl: async (url, options) => { captured = { url, options, body: JSON.parse(options.body) }; return { status, ok: status === 200, json: async () => ({ choices: [{ message: { content: malformed ? "" : "A clearer sentence." } }] }) }; } }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening"); t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/api/pdf/assistant`;
  const body = { task: "Rewrite selected text", text: "A sentence to improve", question: "" };
  let response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(response.status, 200); assert.equal((await response.json()).proposal, "A clearer sentence.");
  assert.equal(captured.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(captured.body.model, "google/gemma-4-26b-a4b-it:free");
  assert.deepEqual(captured.body.provider, { allow_fallbacks: false });
  assert.equal(captured.options.headers.Authorization, "Bearer unit-test-key");
  assert.equal(JSON.stringify(captured.body).includes("pdf bytes"), false);
  status = 429; response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(response.status, 429); assert.match((await response.json()).error, /no paid model fallback/i);
  status = 200; malformed = true; response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(response.status, 502); assert.match((await response.json()).error, /incomplete proposal/i);
});

test("PDF AI status does not treat example placeholder as configured", async (t) => {
  const app = express(); app.use("/api/pdf", createPdfAssistantRouter({ getApiKey: () => "your_key_here", verifySameOrigin: (_req, _res, next) => next() }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening"); t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/pdf/status`);
  assert.equal((await response.json()).configured, false);
});
