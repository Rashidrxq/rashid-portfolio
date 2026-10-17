import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import test from "node:test";
import { createItineraryRouter, OPENROUTER_MODEL } from "./itinerary.js";

const validTrip = {
  destination: "Kochi",
  startDate: "2027-01-10",
  endDate: "2027-01-10",
  budget: 8000,
  currency: "INR",
  travelers: 2,
  pace: "Balanced",
  interests: ["Food", "History"],
};

function validModelPlan() {
  return {
    summary: "A relaxed day around Kochi's historic waterfront.",
    budgetStatus: "within_budget",
    budgetNote: "The estimated total fits the budget entered.",
    days: [{
      date: "2027-01-10",
      title: "Fort Kochi and local food",
      activities: [{ period: "morning", place: "Fort Kochi", suggestion: "Explore the heritage streets and waterfront; verify current access locally.", estimatedCost: 500 }],
      meals: [
        { meal: "breakfast", suggestion: "Try a local breakfast cafe; check current menu and hours.", estimatedCost: 300 },
        { meal: "lunch", suggestion: "Choose a nearby Kerala-style restaurant.", estimatedCost: 700 },
        { meal: "dinner", suggestion: "Have an early dinner near your stay.", estimatedCost: 800 },
      ],
    }],
    budgetSummary: { lodging: 2500, food: 1800, localTransport: 700, activities: 500, buffer: 500 },
    caveats: ["Prices, venue hours, and access are estimates; verify before booking."],
  };
}

function modelResponse(content, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => ({ choices: [{ message: { content } }] }) };
}

async function withServer({ fetchImpl, apiKey = "test-openrouter-key", rateLimitLimit = 5 }, run) {
  const app = express();
  app.use(express.json({ limit: "16kb" }));
  app.use("/api/itinerary", createItineraryRouter({ getApiKey: () => apiKey, fetchImpl, rateLimitLimit, rateLimitWindowMs: 60_000 }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}/api/itinerary`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("valid trip returns validated structured itinerary and only requests the selected free model", async () => {
  let upstreamRequest;
  await withServer({ fetchImpl: async (url, options) => {
    upstreamRequest = { url, options, body: JSON.parse(options.body) };
    return modelResponse(JSON.stringify(validModelPlan()));
  } }, async (url) => {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validTrip) });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.model, OPENROUTER_MODEL);
    assert.equal(payload.itinerary.days.length, 1);
    assert.equal(payload.itinerary.days[0].date, validTrip.startDate);
    assert.equal(payload.itinerary.budgetSummary.estimatedTotal, 6000);
    assert.equal(upstreamRequest.url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(upstreamRequest.options.headers.Authorization, "Bearer test-openrouter-key");
    assert.equal(upstreamRequest.body.model, "google/gemma-4-26b-a4b-it:free");
    assert.equal(upstreamRequest.body.provider.allow_fallbacks, false);
    assert.deepEqual(upstreamRequest.body.response_format, { type: "json_object" });
    assert.match(upstreamRequest.body.messages[1].content, /Kochi/);
    assert.match(upstreamRequest.body.messages[1].content, /2027-01-10/);
    assert.match(upstreamRequest.body.messages[1].content, /8000/);
    assert.match(upstreamRequest.body.messages[1].content, /Food.*History/);
  });
});

test("missing fields and invalid dates are rejected before calling OpenRouter", async () => {
  let calls = 0;
  await withServer({ fetchImpl: async () => { calls += 1; return modelResponse("{}"); } }, async (url) => {
    const missing = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    assert.equal(missing.status, 400);
    assert.match((await missing.json()).error, /destination/);

    const invalidDate = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...validTrip, startDate: "2027-02-30" }) });
    assert.equal(invalidDate.status, 400);
    assert.match((await invalidDate.json()).error, /valid start and end dates/);

    const reversed = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...validTrip, startDate: "2027-01-11" }) });
    assert.equal(reversed.status, 400);
    assert.equal(calls, 0);
  });
});

test("an unrealistic or over-budget model result is visibly flagged by the validated response", async () => {
  const plan = validModelPlan();
  plan.budgetStatus = "within_budget";
  plan.budgetSummary.lodging = 9000;
  await withServer({ fetchImpl: async () => modelResponse(JSON.stringify(plan)) }, async (url) => {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validTrip) });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.itinerary.budgetStatus, "over_budget");
    assert.match(payload.itinerary.budgetNote, /above your 8000 INR budget/);
  });
});

test("OpenRouter rate limit is returned clearly without a paid-model fallback", async () => {
  await withServer({ fetchImpl: async () => modelResponse("busy", 429) }, async (url) => {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validTrip) });
    assert.equal(response.status, 429);
    assert.match((await response.json()).error, /free Gemma model is rate-limited/);
  });
});

test("malformed JSON and structurally incomplete model responses are rejected safely", async (context) => {
  await context.test("invalid JSON", async () => {
    await withServer({ fetchImpl: async () => modelResponse("{not valid json") }, async (url) => {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validTrip) });
      assert.equal(response.status, 502);
      assert.match((await response.json()).error, /malformed or incomplete/);
    });
  });

  await context.test("missing meals", async () => {
    const plan = validModelPlan();
    plan.days[0].meals = [];
    await withServer({ fetchImpl: async () => modelResponse(JSON.stringify(plan)) }, async (url) => {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validTrip) });
      assert.equal(response.status, 502);
      assert.match((await response.json()).error, /malformed or incomplete/);
    });
  });
});

test("missing key and upstream failures return useful errors", async (context) => {
  await context.test("missing key", async () => {
    let calls = 0;
    await withServer({ apiKey: "your_key_here", fetchImpl: async () => { calls += 1; return modelResponse("{}"); } }, async (url) => {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validTrip) });
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /OPENROUTER_API_KEY/);
      assert.equal(calls, 0);
    });
  });

  await context.test("upstream outage", async () => {
    await withServer({ fetchImpl: async () => modelResponse("outage", 503) }, async (url) => {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validTrip) });
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /no paid model fallback/);
    });
  });
});

test("application rate limit blocks repeated itinerary requests", async () => {
  await withServer({ rateLimitLimit: 1, fetchImpl: async () => modelResponse(JSON.stringify(validModelPlan())) }, async (url) => {
    const send = () => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validTrip) });
    assert.equal((await send()).status, 200);
    const limited = await send();
    assert.equal(limited.status, 429);
    assert.match((await limited.json()).error, /Too many itinerary requests/);
  });
});
