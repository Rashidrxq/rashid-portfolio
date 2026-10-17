import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const ALLOWED_EXTENSIONS = new Set([".md", ".txt", ".pdf"]);
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_DOCUMENTS = 40;
const MAX_PDF_PAGES = 80;
const MAX_CHUNK_CHARS = 1250;
const STOP_WORDS = new Set(("a an and are as at be been but by can could did do does for from had has have how i if in into is it its me my of on or our please should so tell that the their them there these this to up us was we what when where which who why will with would you your about portfolio rashid" ).split(/\s+/));

function tokenize(value) {
  return (value.toLowerCase().match(/[a-z0-9+#.-]{2,}/g) || [])
    .map((term) => term.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""))
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

function makeChunks(text, metadata) {
  const normalized = text.replace(/\0/g, "").replace(/\r/g, "").trim();
  if (!normalized) return [];

  const chunks = [];
  let buffer = "";
  for (const rawParagraph of normalized.split(/\n\s*\n/)) {
    const paragraph = rawParagraph.replace(/[ \t]+/g, " ").trim();
    if (!paragraph) continue;
    if (paragraph.length > MAX_CHUNK_CHARS) {
      if (buffer) {
        chunks.push({ ...metadata, text: buffer.trim() });
        buffer = "";
      }
      for (let index = 0; index < paragraph.length; index += MAX_CHUNK_CHARS) {
        const part = paragraph.slice(index, index + MAX_CHUNK_CHARS).trim();
        if (part) chunks.push({ ...metadata, text: part });
      }
      continue;
    }
    if (buffer && buffer.length + paragraph.length + 2 > MAX_CHUNK_CHARS) {
      chunks.push({ ...metadata, text: buffer.trim() });
      buffer = paragraph;
    } else {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
  }
  if (buffer) chunks.push({ ...metadata, text: buffer.trim() });
  return chunks;
}

function parseTextDocument(text, filename) {
  const firstHeading = text.match(/^#\s+(.+)$/m);
  const title = firstHeading?.[1]?.trim() || path.basename(filename, path.extname(filename));
  const sections = text.split(/(?=^#{1,6}\s+.+$)/m);
  const chunks = [];
  for (const sectionText of sections) {
    const heading = sectionText.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim();
    const body = sectionText.replace(/^#{1,6}\s+.+\n?/m, "").trim();
    if (!body) continue;
    chunks.push(...makeChunks(body, { title, filename, section: heading || "Overview" }));
  }
  return { title, chunks };
}

async function getPdfModule() {
  try {
    return await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch {
    return import("pdfjs-dist/build/pdf.mjs");
  }
}

async function parsePdfDocument(buffer, filename) {
  const pdfjs = await getPdfModule();
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const title = path.basename(filename, ".pdf");
  const chunks = [];
  const totalPages = document.numPages;
  const pageLimit = Math.min(totalPages, MAX_PDF_PAGES);
  try {
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      chunks.push(...makeChunks(text, { title, filename, page: pageNumber }));
    }
  } finally {
    await document.destroy();
  }
  return { title, chunks, truncated: totalPages > MAX_PDF_PAGES };
}

async function findFiles(root, current, files) {
  if (files.length >= MAX_DOCUMENTS) return;
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (files.length >= MAX_DOCUMENTS || entry.name.startsWith(".")) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await findFiles(root, absolute, files);
      continue;
    }
    if (!entry.isFile() || !ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    const canonical = await realpath(absolute);
    if (!canonical.startsWith(`${root}${path.sep}`)) continue;
    files.push(canonical);
  }
}

export async function buildKnowledgeIndex(knowledgeDirectory) {
  const root = await realpath(knowledgeDirectory);
  const files = [];
  await findFiles(root, root, files);
  const documents = [];
  const chunks = [];
  let totalBytes = 0;

  for (const filename of files) {
    try {
      const info = await stat(filename);
      if (info.size <= 0 || info.size > MAX_DOCUMENT_BYTES || totalBytes + info.size > MAX_TOTAL_BYTES) {
        console.warn(`[support] Skipping out-of-limit knowledge file: ${path.basename(filename)}`);
        continue;
      }
      totalBytes += info.size;
      const relativeName = path.relative(root, filename).split(path.sep).join("/");
      const extension = path.extname(filename).toLowerCase();
      const buffer = await readFile(filename);
      const parsed = extension === ".pdf"
        ? await parsePdfDocument(buffer, relativeName)
        : parseTextDocument(buffer.toString("utf8"), relativeName);
      if (parsed.truncated) console.warn(`[support] PDF page limit reached: ${relativeName}`);
      documents.push({ title: parsed.title, filename: relativeName });
      for (const chunk of parsed.chunks) {
        chunks.push({ ...chunk, id: `${relativeName}:${chunk.page || chunk.section || chunks.length}` });
      }
    } catch (error) {
      console.warn(`[support] Could not index ${path.basename(filename)}: ${error instanceof Error ? error.name : "document error"}`);
    }
  }

  return { documents, chunks };
}

export function retrieve(index, query, limit = 4) {
  const queryTerms = [...new Set(tokenize(query))];
  if (!queryTerms.length) return [];
  const matches = [];
  for (const chunk of index.chunks) {
    const text = `${chunk.title} ${chunk.section || ""} ${chunk.text}`.toLowerCase();
    const terms = tokenize(text);
    const frequencies = new Map();
    for (const term of terms) frequencies.set(term, (frequencies.get(term) || 0) + 1);
    let score = 0;
    let matched = 0;
    for (const term of queryTerms) {
      const frequency = frequencies.get(term) || 0;
      if (frequency) {
        matched += 1;
        score += 1 + Math.min(1.8, Math.log1p(frequency) * 0.55);
        if (chunk.title.toLowerCase().includes(term)) score += 0.45;
        if ((chunk.section || "").toLowerCase().includes(term)) score += 0.25;
      }
    }
    const coverage = matched / queryTerms.length;
    score = score * (0.65 + coverage * 0.35);
    if (matched > 0) matches.push({ chunk, score, matched, coverage });
  }
  return matches
    .sort((a, b) => b.score - a.score || b.coverage - a.coverage)
    .filter((match, index) => match.score >= 1.55 && (index === 0 || match.matched >= 1))
    .slice(0, limit)
    .map(({ chunk, score }) => ({ ...chunk, score }));
}
