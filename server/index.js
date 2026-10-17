import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { buildKnowledgeIndex, retrieve } from "./rag/index.js";
import { createItineraryRouter } from "./travel/itinerary.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, "..");
const ENV_FILE = path.join(APP_ROOT, ".env");

async function loadLocalEnv() {
  if (!existsSync(ENV_FILE)) return;
  const source = await readFile(ENV_FILE, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in process.env) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  }
}

await loadLocalEnv();
const [{ checkOllama, generateGroundedAnswer }, { documents, chunks }] = await Promise.all([
  import("./llm/ollama.js"),
  buildKnowledgeIndex(path.join(HERE, "knowledge")),
]);

const app = express();
const port = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 3001;
const rateMessage = { error: "Please wait a moment before sending another question." };

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
}));
app.use(express.json({ limit: "16kb", strict: true }));

const chatLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: rateMessage,
  handler: (_request, response) => response.status(429).json(rateMessage),
});
const healthLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Health check rate limit reached." },
});
function verifySameOrigin(request, response, next) {
  const origin = request.get("origin");
  if (!origin) return next();
  try {
    if (new URL(origin).host !== request.get("host")?.toLowerCase()) return response.status(403).json({ error: "Request origin is not allowed." });
  } catch {
    return response.status(403).json({ error: "Request origin is not allowed." });
  }
  return next();
}

app.use("/api/itinerary", createItineraryRouter({
  getApiKey: () => process.env.OPENROUTER_API_KEY?.trim(),
  verifySameOrigin,
}));

function cleanMessage(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

function parseHistory(value, question) {
  if (!Array.isArray(value)) return [];
  const history = value.slice(-6).flatMap((entry) => {
    if (!entry || (entry.role !== "user" && entry.role !== "assistant")) return [];
    const content = cleanMessage(entry.content);
    if (!content || content.length > 1200) return [];
    return [{ role: entry.role, content }];
  });
  const last = history.at(-1);
  if (last?.role === "user" && last.content === question) history.pop();
  return history;
}

function presentSources(found) {
  const unique = new Map();
  for (const chunk of found) {
    if (!unique.has(chunk.id)) {
      unique.set(chunk.id, {
        id: chunk.id,
        title: chunk.title,
        filename: chunk.filename,
        ...(chunk.section ? { section: chunk.section } : {}),
        ...(chunk.page ? { page: chunk.page } : {}),
        excerpt: chunk.text.slice(0, 720),
      });
    }
  }
  return [...unique.values()].slice(0, 3);
}

function extractiveReply(found) {
  const excerpts = found.slice(0, 2).map((chunk) => `“${chunk.text.slice(0, 380).trim()}${chunk.text.length > 380 ? "…" : ""}”`);
  return `I couldn’t get a local model response, so I can’t write a model-generated answer. These are the matching excerpts from the local portfolio notes:\n\n${excerpts.join("\n\n")}`;
}

app.get("/api/support/health", verifySameOrigin, healthLimiter, async (_request, response) => {
  const model = await checkOllama();
  response.json({
    modelConnected: model.connected,
    mode: model.connected ? "ollama" : "extractive",
    knowledgeSources: documents.length,
    indexedChunks: chunks.length,
  });
});

app.post("/api/support/chat", verifySameOrigin, chatLimiter, async (request, response) => {
  const question = cleanMessage(request.body?.message);
  if (!question) return response.status(400).json({ error: "Write a question before sending." });
  if (question.length > 1200) return response.status(400).json({ error: "Keep your question under 1,200 characters." });
  if (request.body?.history !== undefined && !Array.isArray(request.body.history)) {
    return response.status(400).json({ error: "The chat history format is invalid." });
  }

  try {
    const found = retrieve({ chunks }, question);
    if (!found.length) {
      return response.json({
        answer: "I couldn’t confirm that from the portfolio notes I have. Please ask Rashid directly by email or phone so he can give you an accurate answer.",
        sources: [],
        mode: "unsupported",
      });
    }

    const sources = presentSources(found);
    const history = parseHistory(request.body?.history, question);
    const model = await checkOllama();
    if (model.connected) {
      try {
        const answer = await generateGroundedAnswer({ question, history, chunks: found });
        return response.json({ answer, sources, mode: "ollama" });
      } catch {
        // A failed local generation degrades to transparent snippets; no provider fallback is used.
      }
    }
    return response.json({ answer: extractiveReply(found), sources, mode: "extractive" });
  } catch {
    return response.status(500).json({ error: "The support assistant is temporarily unavailable. Please try again or contact Rashid directly." });
  }
});

const distDirectory = path.join(APP_ROOT, "dist");
app.use(express.static(distDirectory, { index: false, maxAge: process.env.NODE_ENV === "production" ? "1h" : 0 }));
app.use((request, response, next) => {
  if (request.method === "GET" && !request.path.startsWith("/api/") && existsSync(path.join(distDirectory, "index.html"))) {
    return response.sendFile(path.join(distDirectory, "index.html"));
  }
  return next();
});

app.use((error, _request, response, _next) => {
  if (error?.type === "entity.too.large" || error instanceof SyntaxError) {
    return response.status(400).json({ error: "The request could not be read. Keep the message under 1,200 characters." });
  }
  return response.status(500).json({ error: "The support assistant is temporarily unavailable." });
});

const listenHost = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
app.listen(port, listenHost, () => {
  console.log(`[support] API listening on ${listenHost}:${port}; indexed ${documents.length} local knowledge source(s).`);
});
