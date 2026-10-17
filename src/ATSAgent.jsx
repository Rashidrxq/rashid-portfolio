import React, { useRef, useState } from "react";
import "./ats-agent.css";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 35;
const MAX_TEXT_LENGTH = 200_000;

const SECTION_PATTERNS = [
  { label: "Summary", pattern: /\b(summary|professional profile|profile|objective)\b/i },
  { label: "Experience", pattern: /\b(experience|employment|work history|professional history)\b/i },
  { label: "Skills", pattern: /\b(skills|technical skills|core competencies|expertise)\b/i },
  { label: "Education", pattern: /\b(education|academic background|qualifications)\b/i },
  { label: "Projects", pattern: /\b(projects|selected work|portfolio)\b/i },
];

const ACTION_VERBS = [
  "built", "created", "delivered", "designed", "developed", "drove", "improved",
  "increased", "launched", "led", "managed", "optimized", "reduced", "shipped",
  "streamlined", "implemented", "owned", "automated", "maintained", "supported",
];

const STOP_WORDS = new Set((
  "a an the and or but if then than of to in on at for from with by as is are was were be been being " +
  "it its this that these those we you they them their our your i me my he she his her who what when " +
  "where why how can could should would will may might must do does did have has had not no yes " +
  "about across after against all also any both each few more most other some such only own same so " +
  "too very just into over under again further once here there during before between through up down out " +
  "per via using use used work role team company organization experience ability skills strong excellent " +
  "required preferred requirements responsibilities responsibility including include knowledge plus " +
  "looking candidate ideal successful relevant opportunity position years year new join join us " +
  "will-have would-have must-have nice-to-have"
).split(/\s+/));

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function normalizeToken(token) {
  const clean = token.toLowerCase().replace(/[^a-z0-9+#.]/g, "");
  if (clean.length > 5 && clean.endsWith("ies")) return `${clean.slice(0, -3)}y`;
  if (clean.length > 4 && clean.endsWith("s")) return clean.slice(0, -1);
  return clean;
}

function extractKeywords(jobDescription) {
  const counts = new Map();
  const tokens = jobDescription.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || [];
  for (const token of tokens) {
    const normalized = normalizeToken(token);
    if (!normalized || STOP_WORDS.has(normalized) || /^\d+$/.test(normalized)) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([word]) => word);
}

function scoreResume(resume, jobDescription) {
  const words = wordCount(resume);
  const normalized = resume.toLowerCase();
  const hasEmail = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/i.test(resume);
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(resume);
  const foundSections = SECTION_PATTERNS.filter(({ pattern }) => pattern.test(resume));
  const activeVerbCount = ACTION_VERBS.filter((verb) => new RegExp(`\\b${verb}\\b`, "i").test(resume)).length;
  const numbers = (resume.match(/\b\d+(?:[,.]\d+)*(?:%|x|k|m|\+)?\b/gi) || []).length;
  const bulletLines = resume.split(/\r?\n/).filter((line) => /^\s*(?:[-*•▪◦]|\d+[.)])\s+/.test(line)).length;
  const hasDateSignal = /\b(?:19|20)\d{2}\b/.test(resume);

  const contactScore = (hasEmail ? 10 : 0) + (hasPhone ? 10 : 0);
  const sectionScore = Math.round((foundSections.length / SECTION_PATTERNS.length) * 25);
  const evidenceScore = Math.min(13, activeVerbCount * 2) + Math.min(12, numbers * 2);

  let lengthScore;
  if (words >= 300 && words <= 1100) lengthScore = 15;
  else if ((words >= 200 && words < 300) || (words > 1100 && words <= 1500)) lengthScore = 10;
  else if ((words >= 100 && words < 200) || (words > 1500 && words <= 2000)) lengthScore = 5;
  else lengthScore = 0;

  const keywords = jobDescription.trim() ? extractKeywords(jobDescription) : [];
  const resumeTokens = new Set((normalized.match(/[a-z][a-z0-9+#.-]{2,}/g) || []).map(normalizeToken));
  const matchedKeywords = keywords.filter((keyword) => resumeTokens.has(keyword));
  const missingKeywords = keywords.filter((keyword) => !resumeTokens.has(keyword));
  const hasJobDescription = Boolean(jobDescription.trim());

  let breakdown;
  let total;
  if (hasJobDescription) {
    const keywordScore = keywords.length ? Math.round((matchedKeywords.length / keywords.length) * 25) : 0;
    const matchedEvidence = Math.round(evidenceScore * 0.8);
    const matchedLength = Math.round((lengthScore / 15) * 10);
    breakdown = [
      { label: "Contact signals", score: contactScore, outOf: 20, detail: `${hasEmail ? "Email found" : "Email not found"} · ${hasPhone ? "Phone found" : "Phone not found"}` },
      { label: "Standard sections", score: sectionScore, outOf: 25, detail: `${foundSections.length} of ${SECTION_PATTERNS.length} common headings found` },
      { label: "Experience evidence", score: matchedEvidence, outOf: 20, detail: `${activeVerbCount} action verb signals · ${numbers} number signals` },
      { label: "Length & structure", score: matchedLength, outOf: 10, detail: `${words.toLocaleString()} words${bulletLines ? ` · ${bulletLines} bullet lines` : ""}` },
      { label: "Role keyword overlap", score: keywordScore, outOf: 25, detail: keywords.length ? `${matchedKeywords.length} of ${keywords.length} selected terms found` : "No high-value terms recognized in the description" },
    ];
    total = breakdown.reduce((sum, item) => sum + item.score, 0);
  } else {
    const listSignals = Math.min(10, bulletLines * 2) + (hasDateSignal ? 5 : 0);
    const scanStructureScore = Math.min(15, lengthScore + listSignals);
    breakdown = [
      { label: "Contact signals", score: contactScore, outOf: 20, detail: `${hasEmail ? "Email found" : "Email not found"} · ${hasPhone ? "Phone found" : "Phone not found"}` },
      { label: "Standard sections", score: sectionScore, outOf: 25, detail: `${foundSections.length} of ${SECTION_PATTERNS.length} common headings found` },
      { label: "Experience evidence", score: evidenceScore, outOf: 25, detail: `${activeVerbCount} action verb signals · ${numbers} number signals` },
      { label: "Length & scan structure", score: scanStructureScore, outOf: 30, detail: `${words.toLocaleString()} words${bulletLines ? ` · ${bulletLines} bullet lines` : ""}` },
    ];
    total = breakdown.reduce((sum, item) => sum + item.score, 0);
  }

  const recommendations = [];
  if (!hasEmail || !hasPhone) {
    recommendations.push({ impact: 5, title: "Add complete contact details", body: `Add a clearly written ${[!hasEmail && "email address", !hasPhone && "phone number"].filter(Boolean).join(" and ")} near the top of the resume.` });
  }
  if (foundSections.length < SECTION_PATTERNS.length) {
    const missing = SECTION_PATTERNS.filter(({ pattern }) => !pattern.test(resume)).map(({ label }) => label);
    recommendations.push({ impact: 4, title: "Make key sections easy to find", body: `Consider clear headings for ${missing.join(", ")}. Use the heading text that best fits your experience.` });
  }
  if (numbers < 2) {
    recommendations.push({ impact: 3, title: "Show the results of your work", body: "Add a few accurate measures, such as time saved, users supported, delivery volume, or percentage change. Keep every number verifiable." });
  }
  if (activeVerbCount < 3 || bulletLines < 3) {
    recommendations.push({ impact: 3, title: "Make experience easier to scan", body: "Use concise bullets that start with a clear action and explain what you did, how you did it, and what changed." });
  }
  if (words < 200 || words > 1500) {
    recommendations.push({ impact: 2, title: "Review resume length", body: `This scan found ${words.toLocaleString()} words. Check that the resume includes enough relevant detail without repeating information.` });
  }
  if (hasJobDescription && missingKeywords.length) {
    recommendations.push({ impact: 4, title: "Reflect relevant role language where accurate", body: `The job description terms “${missingKeywords.slice(0, 4).join("”, “")}” were not found. Add them only where they truthfully describe your skills or work.` });
  }
  if (hasJobDescription && matchedKeywords.length && !missingKeywords.length) {
    recommendations.push({ impact: 2, title: "Keep the role match specific", body: "The selected terms appear in your resume. Prioritize the most relevant examples near the experience that supports them." });
  }
  if (recommendations.length < 3) {
    recommendations.push({ impact: 1, title: "Check dates and formatting consistency", body: "Review role dates, punctuation, and heading style so they follow one consistent pattern throughout." });
  }
  if (recommendations.length < 3) {
    recommendations.push({ impact: 1, title: "Tailor the opening summary", body: "Use a short, specific introduction that connects your recent experience to the roles you want." });
  }
  recommendations.sort((a, b) => b.impact - a.impact);

  return {
    score: Math.max(0, Math.min(100, total)),
    words,
    breakdown,
    foundSections: foundSections.map(({ label }) => label),
    keywords,
    matchedKeywords,
    missingKeywords,
    recommendations: recommendations.slice(0, 5),
    hasJobDescription,
  };
}

async function extractResumeFile(file) {
  if (file.size > MAX_FILE_SIZE) throw new Error("This file is over 10 MB. Choose a smaller resume or paste its text.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "txt") return { text: await file.text(), note: "Plain text read locally in this browser." };
  if (extension === "docx") {
    const mammothModule = await import("mammoth");
    const mammoth = mammothModule.default || mammothModule;
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { text: result.value, note: "DOCX text extracted locally in this browser." };
  }
  if (extension === "pdf") {
    const [pdfjsLib, workerModule] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]);
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
    const data = new Uint8Array(await file.arrayBuffer());
    const document = await pdfjsLib.getDocument({ data }).promise;
    const totalPages = document.numPages;
    const pageLimit = Math.min(totalPages, MAX_PDF_PAGES);
    const pages = [];
    try {
      for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
      }
    } finally {
      await document.destroy();
    }
    const note = totalPages > MAX_PDF_PAGES
      ? `First ${MAX_PDF_PAGES} pages extracted locally. The remaining pages were skipped.`
      : "PDF text extracted locally in this browser.";
    return { text: pages.join("\n"), note };
  }
  throw new Error("Choose a PDF, DOCX, or TXT file. Other file types are not supported.");
}

function ScoreRing({ score }) {
  return (
    <div className="ats-score-ring" style={{ "--score-angle": `${score * 3.6}deg` }} aria-label={`ATS readiness estimate: ${score} out of 100`}>
      <span className="ats-score-number">{score}</span>
      <span className="ats-score-denom">/ 100</span>
    </div>
  );
}

function ATSResults({ result }) {
  return (
    <section className="ats-results" aria-labelledby="ats-results-heading" aria-live="polite">
      <div className="ats-results-top">
        <ScoreRing score={result.score} />
        <div>
          <p className="ats-result-kicker mono">LOCAL SCAN COMPLETE</p>
          <h3 id="ats-results-heading">ATS readiness<br /><em>estimate</em></h3>
          <p className="ats-result-summary">A rule-based signal from {result.words.toLocaleString()} words. It is not a hiring outcome prediction.</p>
        </div>
      </div>

      <div className="ats-breakdown" aria-label="Score breakdown">
        <h4 className="mono">WHERE THE SCORE CAME FROM</h4>
        {result.breakdown.map((item) => (
          <div className="ats-breakdown-row" key={item.label}>
            <div className="ats-breakdown-main">
              <span>{item.label}</span>
              <strong>{item.score}<small>/{item.outOf}</small></strong>
            </div>
            <div className="ats-progress" role="img" aria-label={`${item.label}: ${item.score} of ${item.outOf}`}>
              <span style={{ width: `${item.outOf ? (item.score / item.outOf) * 100 : 0}%` }} />
            </div>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>

      {result.hasJobDescription && (
        <div className="ats-keywords">
          <h4 className="mono">JOB DESCRIPTION OVERLAP</h4>
          <p>Selected terms are frequency-based signals, not a measure of skill or fit.</p>
          {result.keywords.length === 0 ? <p className="ats-no-keywords">No high-value terms were recognized. Try adding a fuller job description.</p> : <>
          <div className="ats-keyword-group">
            <span className="ats-keyword-label">FOUND</span>
            <div className="ats-keyword-list">
              {result.matchedKeywords.length
                ? result.matchedKeywords.slice(0, 8).map((word) => <span className="ats-keyword ats-keyword--matched" key={word}>{word}</span>)
                : <span className="ats-empty-tag">No selected terms found</span>}
            </div>
          </div>
          <div className="ats-keyword-group">
            <span className="ats-keyword-label">NOT FOUND</span>
            <div className="ats-keyword-list">
              {result.missingKeywords.length
                ? result.missingKeywords.slice(0, 8).map((word) => <span className="ats-keyword" key={word}>{word}</span>)
                : <span className="ats-empty-tag">All selected terms found</span>}
            </div>
          </div>
          </>}
        </div>
      )}

      <div className="ats-improvements">
        <h4 className="mono">NEXT EDITS / IN PRIORITY ORDER</h4>
        <ol>
          {result.recommendations.map((item, index) => (
            <li key={`${item.title}-${index}`}>
              <span className="ats-improvement-index mono">0{index + 1}</span>
              <div><h5>{item.title}</h5><p>{item.body}</p></div>
              <span className={`ats-impact ats-impact--${item.impact >= 4 ? "high" : item.impact >= 3 ? "medium" : "low"}`}>
                {item.impact >= 4 ? "HIGH" : item.impact >= 3 ? "MED" : "LOW"} IMPACT
              </span>
            </li>
          ))}
        </ol>
      </div>
      <p className="ats-disclaimer">This transparent heuristic checks text signals only. It can miss context, design, and employer-specific rules; it cannot predict any ATS result.</p>
    </section>
  );
}

export default function ATSAgent() {
  const fileInputRef = useRef(null);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileNote, setFileNote] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState(null);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setResult(null);
    setFileNote("");
    setIsExtracting(true);
    setStatus(`Reading ${file.name} locally…`);
    try {
      const extracted = await extractResumeFile(file);
      if (!extracted.text.trim()) {
        throw new Error(file.name.toLowerCase().endsWith(".pdf")
          ? "No selectable text was found in this PDF. It may be a scanned image; use OCR first or paste the resume text."
          : "No readable text was found in this file. Check the document or paste the resume text instead.");
      }
      if (extracted.text.length > MAX_TEXT_LENGTH) {
        throw new Error("This file contains too much text for one scan. Use a shorter resume or paste the relevant sections.");
      }
      setResumeText(extracted.text);
      setFileName(file.name);
      setFileNote(extracted.note);
      setStatus(`${file.name} is ready for a local scan.`);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "The file could not be read. Try pasting the resume text.");
      setStatus("");
    } finally {
      setIsExtracting(false);
    }
  }

  function handleResumeChange(event) {
    const value = event.target.value;
    setResumeText(value.slice(0, MAX_TEXT_LENGTH));
    setResult(null);
    setError(value.length > MAX_TEXT_LENGTH ? "Resume text is limited to 200,000 characters." : "");
    if (fileName) {
      setFileName("");
      setFileNote("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleScan(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    const text = resumeText.trim();
    if (!text) {
      setError("Add resume text or choose a PDF, DOCX, or TXT file before scanning.");
      return;
    }
    if (text.length > MAX_TEXT_LENGTH) {
      setError("Resume text is limited to 200,000 characters.");
      return;
    }
    setIsScanning(true);
    setStatus("Reviewing text signals locally in this browser…");
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    setResult(scoreResume(text, jobDescription));
    setStatus("Local scan complete. Your resume text was not uploaded or stored.");
    setIsScanning(false);
  }

  function resetScan() {
    setResumeText("");
    setJobDescription("");
    setFileName("");
    setFileNote("");
    setError("");
    setStatus("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const busy = isExtracting || isScanning;

  return (
    <section className="ats-section" id="ats-agent" aria-labelledby="ats-heading">
      <div className="ats-shell section-shell">
        <div className="ats-topline">
          <p className="eyebrow eyebrow--light"><span>04</span> A PRIVATE RESUME CHECK</p>
          <span className="ats-privacy mono"><i /> LOCAL ONLY / NO UPLOAD / NO STORAGE</span>
        </div>
        <div className="ats-layout">
          <div className="ats-intro">
            <span className="ats-edition mono">FIELD TOOL / 001</span>
            <h2 id="ats-heading">Give your<br />resume a <em>read.</em></h2>
            <p className="ats-lede">A quick, private check of resume text signals and role keywords. Everything stays in this browser tab.</p>
            <div className="ats-rules">
              <p><span>01</span> Paste text or select a resume file</p>
              <p><span>02</span> Add a job description for keyword overlap</p>
              <p><span>03</span> Get a transparent score and edit priorities</p>
            </div>
            <p className="ats-local-note"><span className="ats-local-dot" /> YOUR DOCUMENT IS NEVER SENT TO A SERVER</p>
          </div>

          <div className="ats-workbench">
            <div className="ats-workbench-head">
              <div><span className="ats-window-dots"><i /><i /><i /></span><span className="mono">R / RESUME REVIEW</span></div>
              <span className="ats-version mono">BROWSER MODE</span>
            </div>

            <form className="ats-form" onSubmit={handleScan}>
              <div className="ats-field">
                <label htmlFor="ats-resume" className="ats-label">RESUME TEXT <span>REQUIRED</span></label>
                <textarea
                  id="ats-resume"
                  className="ats-textarea ats-textarea--resume"
                  value={resumeText}
                  onChange={handleResumeChange}
                  placeholder="Paste your resume text here…"
                  maxLength={MAX_TEXT_LENGTH}
                  aria-describedby="ats-resume-help"
                  disabled={busy}
                />
                <div className="ats-text-meta" id="ats-resume-help"><span>{resumeText ? `${wordCount(resumeText).toLocaleString()} words` : "Your text stays on this device"}</span><span>{resumeText.length.toLocaleString()} / 200,000</span></div>
              </div>

              <div className="ats-file-field">
                <label htmlFor="ats-file" className="ats-label">OR CHOOSE A FILE <span>PDF · DOCX · TXT / UP TO 10 MB</span></label>
                <input
                  ref={fileInputRef}
                  id="ats-file"
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={handleFile}
                  aria-describedby="ats-file-help"
                  disabled={busy}
                />
                <p id="ats-file-help" className="ats-file-help">{fileName ? <><strong>{fileName}</strong>{fileNote ? ` · ${fileNote}` : ""}</> : "PDFs need selectable text. Scanned image PDFs require OCR or pasted text."}</p>
              </div>

              <div className="ats-field">
                <label htmlFor="ats-job" className="ats-label">JOB DESCRIPTION <span>OPTIONAL</span></label>
                <textarea
                  id="ats-job"
                  className="ats-textarea ats-textarea--job"
                  value={jobDescription}
                  onChange={(event) => { setJobDescription(event.target.value.slice(0, MAX_TEXT_LENGTH)); setResult(null); }}
                  placeholder="Paste the role description to see keyword overlap…"
                  maxLength={MAX_TEXT_LENGTH}
                  disabled={busy}
                />
              </div>

              {error && <p className="ats-error" role="alert">{error}</p>}
              <p className="ats-status mono" role="status" aria-live="polite">{status || "READY WHEN YOU ARE"}</p>
              <div className="ats-actions">
                <button className="ats-submit" type="submit" disabled={busy}>
                  {busy ? (isExtracting ? "READING FILE…" : "SCANNING LOCALLY…") : "RUN LOCAL SCAN"}
                  <span aria-hidden="true">↗</span>
                </button>
                <button className="ats-reset" type="button" onClick={resetScan} disabled={busy || (!resumeText && !jobDescription && !result && !fileName)}>
                  RESET
                </button>
              </div>
            </form>

            {result ? <ATSResults result={result} /> : (
              <div className="ats-empty-result" aria-live="polite">
                <span className="ats-empty-cross" aria-hidden="true">✳</span>
                <p className="mono">YOUR REPORT WILL APPEAR HERE</p>
                <span>Score breakdown · role overlap · next edits</span>
              </div>
            )}
          </div>
        </div>
        <div className="ats-footnote"><span>ESTIMATE, NOT A PROMISE</span><span className="ats-footnote-line" /><span>RULE-BASED TEXT SIGNALS</span></div>
      </div>
    </section>
  );
}
