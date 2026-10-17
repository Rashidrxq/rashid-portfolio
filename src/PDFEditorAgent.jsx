import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import "./pdf-editor.css";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 35;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const parseHex = (hex) => ({ r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 });

export function validatePdfFile(file) {
  if (!file) throw new Error("Choose a PDF file to begin.");
  if (file.size > MAX_BYTES) throw new Error("This file is larger than 10 MB. Choose a smaller PDF.");
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") throw new Error("That file is not a PDF. Choose a .pdf document.");
}

export default function PDFEditorAgent({ onClose }) {
  const [pdfData, setPdfData] = useState(null);
  const [pdfEngine, setPdfEngine] = useState(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [name, setName] = useState("");
  const [pages, setPages] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageInfo, setPageInfo] = useState(null);
  const [pageText, setPageText] = useState("");
  const [sourceTextItems, setSourceTextItems] = useState([]);
  const [selectSourceText, setSelectSourceText] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [overlays, setOverlays] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const actionsRef = useRef({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("tools");
  const [proposal, setProposal] = useState("");
  const [aiTask, setAiTask] = useState("Rewrite selected text");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiDisclosure, setAiDisclosure] = useState(false);
  const [elements, setElements] = useState([]);
  const [apiReady, setApiReady] = useState(false);
  const [imagePurpose, setImagePurpose] = useState("image");
  const [filename, setFilename] = useState("");
  const inputRef = useRef(null);
  const imageInputRef = useRef(null);
  const canvasRef = useRef(null);
  const thumbnailRefs = useRef(new Map());
  const pageBoxRef = useRef(null);
  const canvasHostRef = useRef(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const priorFocus = useRef(null);
  const dragRef = useRef(null);
  const selected = overlays.find((item) => item.id === selectedId) || null;
  const visibleOverlays = useMemo(() => overlays.filter((item) => item.page === pageIndex), [overlays, pageIndex]);

  useEffect(() => {
    priorFocus.current = document.activeElement;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event) => {
      const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
      if (!typing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? actionsRef.current.redo() : actionsRef.current.undo(); }
      else if (!typing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); actionsRef.current.redo(); }
      else if (!typing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); actionsRef.current.duplicateSelected(); }
      else if (!typing && (event.key === "Delete" || event.key === "Backspace") && actionsRef.current.selectedId) { event.preventDefault(); actionsRef.current.deleteSelected(); }
      else if (event.key === "Escape") onClose();
      if (event.key === "Tab" && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll("button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex='-1'])")];
        if (!items.length) return;
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    fetch("/api/pdf/status").then((r) => r.ok ? r.json() : null).then((d) => setApiReady(Boolean(d?.configured))).catch(() => setApiReady(false));
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = priorOverflow; priorFocus.current?.focus?.(); };
  // Keyboard handlers call the current state through this component's closure; modal is mounted per open.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  useEffect(() => {
    let active = true;
    async function render() {
      if (!pdfDocument || !pdfEngine || !canvasRef.current) return;
      try {
        const page = await pdfDocument.getPage(pages[pageIndex].source);
        const effectiveRotation = (page.rotate + pages[pageIndex].rotation) % 360;
        const base = page.getViewport({ scale: 1, rotation: effectiveRotation });
        const hostWidth = Math.max(280, (canvasHostRef.current?.clientWidth || 720) - 48);
        const scale = Math.min(1.5, hostWidth / base.width) * zoom;
        const viewport = page.getViewport({ scale, rotation: effectiveRotation });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d", { alpha: false });
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
        setPageInfo({ width: base.width, height: base.height, viewportWidth: viewport.width, viewportHeight: viewport.height });
        const text = await page.getTextContent();
        setPageText(text.items.map((item) => item.str).join(" ").slice(0, 10000));
        setSourceTextItems(text.items.filter((item) => item.str?.trim()).map((item) => {
          const transform = pdfEngine.Util.transform(viewport.transform, item.transform);
          const height = Math.max(8, Math.hypot(transform[2], transform[3]));
          return { text: item.str, x: clamp(transform[4] / viewport.width * 100, 0, 99), y: clamp((transform[5] - height) / viewport.height * 100, 0, 99), w: clamp(item.width * scale / viewport.width * 100, 1, 99), h: clamp(height / viewport.height * 100, 1, 20) };
        }));
        await page.render({ canvasContext: context, viewport }).promise;
      } catch (e) { if (active) setError(e?.name === "PasswordException" ? "This PDF is encrypted or password protected. Unlock it and choose the file again." : "This page could not be rendered. The PDF may be damaged or unsupported."); }
    }
    render();
    return () => { active = false; };
  }, [pdfDocument, pdfEngine, pageIndex, pages, zoom]);

  useEffect(() => {
    let cancelled = false;
    async function renderThumbnails() {
      if (!pdfDocument || !pdfEngine) return;
      for (const [index, canvas] of thumbnailRefs.current.entries()) {
        const pageMeta = pages[index]; if (!canvas || !pageMeta) continue;
        try {
          const page = await pdfDocument.getPage(pageMeta.source);
          const effectiveRotation = (page.rotate + pageMeta.rotation) % 360;
          const base = page.getViewport({ scale: 1, rotation: effectiveRotation });
          const viewport = page.getViewport({ scale: 72 / base.width, rotation: effectiveRotation });
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d", { alpha: false });
          await page.render({ canvasContext: context, viewport }).promise;
          if (cancelled) return;
        } catch { /* Main canvas reports page-specific rendering errors. */ }
      }
    }
    renderThumbnails(); return () => { cancelled = true; };
  }, [pdfDocument, pdfEngine, pages]);

  function snapshot() { return { overlays, pages, pageIndex }; }
  function commit(next) { setHistory((old) => [...old.slice(-39), snapshot()]); setFuture([]); setOverlays(next); }
  function restore(entry) { if (Array.isArray(entry)) { setOverlays(entry); return; } setOverlays(entry.overlays); setPages(entry.pages); setPageIndex(entry.pageIndex); }
  function undo() { if (!history.length) return; setFuture((old) => [snapshot(), ...old]); restore(history.at(-1)); setHistory((old) => old.slice(0, -1)); }
  function redo() { if (!future.length) return; setHistory((old) => [...old, snapshot()]); restore(future[0]); setFuture((old) => old.slice(1)); }
  function addOverlay(type, props = {}) {
    if (!pdfDocument) { setError("Upload a PDF before adding page elements."); return; }
    const item = { id: makeId(), page: pageIndex, type, x: 12, y: 14, w: type === "text" ? 34 : 24, h: type === "text" ? 8 : 12, text: type === "text" ? "Your text" : "", fontSize: 18, fontFamily: "Helvetica", bold: false, italic: false, color: "#292622", opacity: 1, rotation: 0, align: "left", ...props };
    commit([...overlays, item]); setSelectedId(item.id); setNotice("Element added. Drag it into place; use the corner handle to resize.");
  }
  function updateSelected(key, value) { if (!selected) return; commit(overlays.map((item) => item.id === selected.id ? { ...item, [key]: value } : item)); }
  function deleteSelected() { if (!selectedId) return; commit(overlays.filter((item) => item.id !== selectedId)); setSelectedId(null); }
  function duplicateSelected() { if (!selected) return; const copy = { ...selected, id: makeId(), x: clamp(selected.x + 3, 0, 90), y: clamp(selected.y + 3, 0, 90) }; commit([...overlays, copy]); setSelectedId(copy.id); }

  async function loadPdf(file) {
    setError(""); setNotice("");
    try {
      validatePdfFile(file);
      const bytes = await file.arrayBuffer();
      const [pdfjsLib, workerModule] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
      setPdfEngine(pdfjsLib);
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) });
      const doc = await loadingTask.promise;
      if (doc.numPages > MAX_PAGES) { await doc.destroy(); throw new Error(`This document has ${doc.numPages} pages. The editor supports up to ${MAX_PAGES} pages at a time.`); }
      const pageIds = Array.from({ length: doc.numPages }, (_, i) => ({ source: i + 1, rotation: 0 }));
      setPdfData(bytes); setPdfDocument(doc); setPages(pageIds); setPageIndex(0); setOverlays([]); setHistory([]); setFuture([]); setSelectedId(null); setName(file.name); setFilename(file.name.replace(/\.pdf$/i, "") + "-edited.pdf"); setTab("tools");
      setNotice(`${doc.numPages} page${doc.numPages === 1 ? "" : "s"} loaded locally. PDF bytes stay in this browser.`);
    } catch (e) {
      const message = e?.name === "PasswordException" ? "This PDF is encrypted or password protected. Unlock it and choose it again." : e?.name === "InvalidPDFException" ? "This PDF is damaged or invalid. Try opening and re-saving it in a PDF reader." : e?.message || "The PDF could not be opened.";
      setError(message); setPdfDocument(null); setPdfData(null);
    }
  }
  function downloadOriginal() {
    if (!pdfData) return;
    const url = URL.createObjectURL(new Blob([pdfData], { type: "application/pdf" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = name || "original.pdf"; anchor.click(); URL.revokeObjectURL(url);
  }
  function pageOperation(operation) {
    if (!pages.length) return;
    const target = operation === "up" ? pageIndex - 1 : operation === "down" ? pageIndex + 1 : pageIndex;
    if ((operation === "up" || operation === "down") && (target < 0 || target >= pages.length)) return;
    if (operation === "delete" && pages.length === 1) { setError("A document must keep at least one page."); return; }
    setHistory((old) => [...old.slice(-39), snapshot()]); setFuture([]);
    if (operation === "rotate") setPages((old) => old.map((p, i) => i === pageIndex ? { ...p, rotation: (p.rotation + 90) % 360 } : p));
    if (operation === "delete") { setPages((old) => old.filter((_, i) => i !== pageIndex)); setPageIndex((i) => Math.max(0, i - 1)); setOverlays((old) => old.filter((item) => item.page !== pageIndex).map((item) => ({ ...item, page: item.page > pageIndex ? item.page - 1 : item.page }))); }
    if (operation === "duplicate") { setPages((old) => { const next = [...old]; next.splice(pageIndex + 1, 0, { ...old[pageIndex] }); return next; }); setOverlays((old) => [...old, ...old.filter((item) => item.page === pageIndex).map((item) => ({ ...item, id: makeId(), page: pageIndex + 1 }))]); setPageIndex((i) => i + 1); }
    if (operation === "up" || operation === "down") { setPages((old) => { const next = [...old]; [next[pageIndex], next[target]] = [next[target], next[pageIndex]]; return next; }); setOverlays((old) => old.map((item) => item.page === pageIndex ? { ...item, page: target } : item.page === target ? { ...item, page: pageIndex } : item)); setPageIndex(target); }
  }
  async function addImage(file) {
    if (!file || !/^image\/(png|jpeg)$/.test(file.type)) { setError("Choose a PNG or JPEG image."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Images must be 5 MB or smaller."); return; }
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    addOverlay(imagePurpose, { data, w: 24, h: 16 });
  }

  function startDrag(event, item, resize = false) {
    event.preventDefault(); event.stopPropagation(); setSelectedId(item.id);
    setHistory((old) => [...old.slice(-39), snapshot()]); setFuture([]);
    const rect = pageBoxRef.current.getBoundingClientRect();
    dragRef.current = { id: item.id, resize, startX: event.clientX, startY: event.clientY, rect, original: item };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event) {
    const drag = dragRef.current; if (!drag) return;
    const dx = ((event.clientX - drag.startX) / drag.rect.width) * 100; const dy = ((event.clientY - drag.startY) / drag.rect.height) * 100;
    setOverlays((old) => old.map((item) => item.id !== drag.id ? item : drag.resize ? { ...item, w: clamp(drag.original.w + dx, 5, 95), h: clamp(drag.original.h + dy, 3, 95) } : { ...item, x: clamp(drag.original.x + dx, 0, 99 - item.w), y: clamp(drag.original.y + dy, 0, 99 - item.h) }));
  }
  function onPointerUp() { if (dragRef.current) dragRef.current = null; }

  async function exportPdf() {
    if (!pdfData) return;
    setBusy(true); setError(""); setNotice("Building and validating the exported PDF…");
    try {
      const doc = await PDFDocument.load(pdfData.slice(0), { ignoreEncryption: false });
      const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
      const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
      const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
      const times = await doc.embedFont(StandardFonts.TimesRoman);
      const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
      const timesItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
      const courier = await doc.embedFont(StandardFonts.Courier);
      const sourcePages = doc.getPages();
      const ordered = pages.map((page) => sourcePages[page.source - 1]);
      const reordered = await PDFDocument.create();
      const copied = await reordered.copyPages(doc, ordered.map((page) => sourcePages.indexOf(page)));
      copied.forEach((page, i) => reordered.addPage(page));
      const outputPages = reordered.getPages();
      for (let index = 0; index < outputPages.length; index++) {
        const page = outputPages[index]; const { width, height } = page.getSize();
        if (pages[index].rotation) page.setRotation(degrees((page.getRotation().angle + pages[index].rotation) % 360));
        const items = overlays.filter((item) => item.page === index);
        for (const item of items) {
          const x = width * item.x / 100; const y = height * (1 - item.y / 100) - height * item.h / 100;
          if (item.type === "rectangle" || item.type === "highlight" || item.type === "cover") {
            const c = parseHex(item.color || (item.type === "cover" ? "#ffffff" : "#f2c94c"));
            page.drawRectangle({ x, y, width: width * item.w / 100, height: height * item.h / 100, color: rgb(c.r, c.g, c.b), opacity: item.opacity ?? (item.type === "highlight" ? 0.35 : 1), borderColor: item.type === "cover" ? rgb(1, 1, 1) : undefined, borderWidth: 0, rotate: degrees(Number(item.rotation) || 0) });
          } else if (item.type === "line") {
            const c = parseHex(item.color); page.drawLine({ start: { x, y }, end: { x: x + width * item.w / 100, y: y + height * item.h / 100 }, thickness: Math.max(1, item.fontSize / 4), color: rgb(c.r, c.g, c.b), opacity: item.opacity });
          } else if (item.type === "text" || item.type === "covertext") {
            const c = parseHex(item.color); const font = item.fontFamily === "Times Roman" ? item.bold ? timesBold : item.italic ? timesItalic : times : item.fontFamily === "Courier" ? courier : item.bold ? fontBold : item.italic ? fontItalic : fontRegular;
            const lines = String(item.text || "").split("\n");
            lines.forEach((line, i) => {
              const textWidth = font.widthOfTextAtSize(line, Number(item.fontSize) || 18);
              const left = item.align === "center" ? x + (width * item.w / 100 - textWidth) / 2 : item.align === "right" ? x + width * item.w / 100 - textWidth : x;
              page.drawText(line, { x: left, y: y + height * item.h / 100 - (i + 1) * (Number(item.fontSize) || 18) * 1.15, size: Number(item.fontSize) || 18, font, color: rgb(c.r, c.g, c.b), opacity: item.opacity, rotate: degrees(Number(item.rotation) || 0) });
            });
          } else if ((item.type === "image" || item.type === "signature") && item.data) {
            const bytes = Uint8Array.from(atob(item.data.split(",")[1]), (char) => char.charCodeAt(0));
            const image = item.data.startsWith("data:image/png") ? await reordered.embedPng(bytes) : await reordered.embedJpg(bytes);
            page.drawImage(image, { x, y, width: width * item.w / 100, height: height * item.h / 100, opacity: item.opacity, rotate: degrees(Number(item.rotation) || 0) });
          }
        }
      }
      const output = await reordered.save();
      if (!pdfEngine) throw new Error("PDF validation engine is unavailable. Reload the editor and try again.");
      const check = await pdfEngine.getDocument({ data: output.slice(0) }).promise;
      if (check.numPages !== pages.length) throw new Error("Export validation found an unexpected page count.");
      await check.destroy();
      const url = URL.createObjectURL(new Blob([output], { type: "application/pdf" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename || "edited-document"}.pdf`; anchor.click(); URL.revokeObjectURL(url);
      setNotice(`Export validated successfully · ${pages.length} pages · ${Math.round(output.byteLength / 1024)} KB. Edited content is added as page overlays.`);
    } catch (e) { setError(e?.message?.includes("encrypted") ? "This PDF is encrypted. Export is unavailable until it is unlocked." : `The PDF could not be exported: ${e?.message || "unknown error"}`); setNotice(""); }
    finally { setBusy(false); }
  }
  async function requestAi(event) {
    event.preventDefault();
    const target = aiTask === "Generate text" ? aiQuestion.trim() : selected?.text || pageText.trim() || aiQuestion.trim();
    if (!target) { setError("Select a text overlay or enter a question first."); return; }
    setAiDisclosure(true); setError(""); setProposal(""); setBusy(true);
    try {
      const response = await fetch("/api/pdf/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: aiTask, text: target.slice(0, 4000), question: aiQuestion.slice(0, 700) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "PDF assistant is unavailable.");
      setProposal(String(data.proposal || "").slice(0, 5000));
    } catch (e) { setError(e.message || "PDF assistant is unavailable. Your local editor remains available."); }
    finally { setBusy(false); }
  }
  function applyProposal() {
    if (!proposal) return;
    if (selected) updateSelected("text", proposal);
    else addOverlay("text", { text: proposal, w: 56, h: 20, fontSize: 16 });
    setProposal(""); setNotice("AI suggestion applied as an editable proposal. Review it before exporting.");
  }

  actionsRef.current = { undo, redo, duplicateSelected, deleteSelected, selectedId };

  return (
    <div className="pdf-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="pdf-modal" role="dialog" aria-modal="true" aria-labelledby="pdf-title" ref={dialogRef}>
        <header className="pdf-topbar">
          <div className="pdf-brand"><span className="pdf-brand-icon">P.</span><span><strong id="pdf-title">PDF EDITOR</strong><small>LOCAL DOCUMENT STUDIO</small></span></div>
          <div className="pdf-file-title"><span className="pdf-live-dot" />{name || "No document open"}{name && <small>{(pdfData?.byteLength / 1024 / 1024).toFixed(2)} MB · LOCAL</small>}</div>
          <div className="pdf-top-actions"><button type="button" onClick={undo} disabled={!history.length} title="Undo (Ctrl+Z)">↶</button><button type="button" onClick={redo} disabled={!future.length} title="Redo (Ctrl+Y)">↷</button><button type="button" onClick={downloadOriginal} disabled={!pdfData}>ORIGINAL</button><button className="pdf-export" type="button" onClick={exportPdf} disabled={!pdfData || busy}>{busy ? "WORKING…" : "EXPORT PDF ↗"}</button><button ref={closeRef} className="pdf-close" type="button" onClick={onClose} aria-label="Close PDF editor">×</button></div>
        </header>
        <div className="pdf-editor-grid">
          <aside className={`pdf-rail pdf-rail--left ${tab === "pages" ? "is-active" : ""}`}>
            <div className="pdf-mobile-tabs"><button onClick={() => setTab("tools")} className={tab === "tools" ? "is-active" : ""}>TOOLS</button><button onClick={() => setTab("pages")} className={tab === "pages" ? "is-active" : ""}>PAGES</button></div>
            <div className="pdf-rail-head"><span>01 / DOCUMENT</span><button type="button" onClick={() => inputRef.current?.click()}>OPEN ↗</button></div>
            <input ref={inputRef} className="pdf-hidden" type="file" accept="application/pdf,.pdf" onChange={(e) => loadPdf(e.target.files?.[0])} />
            <div className="pdf-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); loadPdf(e.dataTransfer.files?.[0]); }} onClick={() => inputRef.current?.click()} role="button" tabIndex="0" onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}><span>＋</span><b>Drop a PDF here</b><small>or browse · max 10 MB</small></div>
            <div className="pdf-rail-head"><span>PAGES <i>{String(pages.length).padStart(2, "0")}</i></span><div><button onClick={() => pageOperation("up")} disabled={!pages.length || pageIndex === 0} title="Move page earlier">↑</button><button onClick={() => pageOperation("down")} disabled={!pages.length || pageIndex === pages.length - 1} title="Move page later">↓</button></div></div>
            <div className="pdf-thumbnails">{pages.map((p, i) => <button className={`pdf-thumb ${i === pageIndex ? "is-selected" : ""}`} type="button" key={`${p.source}-${i}`} onClick={() => setPageIndex(i)}><span className="pdf-thumb-paper"><canvas ref={(el) => { if (el) thumbnailRefs.current.set(i, el); else thumbnailRefs.current.delete(i); }} /><b>{i + 1}</b></span><small>PAGE {String(i + 1).padStart(2, "0")}</small></button>)}</div>
            <div className="pdf-rail-note">PDF processing stays in this browser. The original file is kept unchanged for download.</div>
          </aside>
          <main className="pdf-canvas-area" ref={canvasHostRef}>
            <div className="pdf-canvas-toolbar"><span>{pages.length ? `PAGE ${String(pageIndex + 1).padStart(2, "0")} / ${String(pages.length).padStart(2, "0")}` : "CANVAS / WAITING"}</span><div><button className={selectSourceText ? "is-active" : ""} onClick={() => setSelectSourceText((v) => !v)} disabled={!pdfDocument || !pageText.trim()} title="Select extractable source text to visually cover and replace">SOURCE TEXT</button><button onClick={() => setZoom((z) => Math.max(.5, +(z - .1).toFixed(1)))} disabled={!pdfDocument}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((z) => Math.min(2, +(z + .1).toFixed(1)))} disabled={!pdfDocument}>+</button><button onClick={() => setZoom(1)} disabled={!pdfDocument}>FIT</button></div></div>
            <div className="pdf-canvas-scroll" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
              {!pdfDocument ? <div className="pdf-empty"><div className="pdf-empty-page"><span>PDF</span><i>＋</i><b>01</b></div><p>Bring a document into the studio.</p><small>Pages render locally. Nothing uploads unless you choose an AI action.</small><button onClick={() => inputRef.current?.click()}>OPEN A PDF</button></div> : <div className="pdf-page-stage" ref={pageBoxRef}>
                <canvas ref={canvasRef} className="pdf-page-canvas" />
                {selectSourceText && sourceTextItems.map((item, i) => <button key={`${i}-${item.x}-${item.y}`} className="pdf-source-text-hit" style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%` }} title={`Select source text: ${item.text.slice(0, 100)}`} onClick={() => { const confirmed = window.confirm("Add a white cover and editable replacement over this extractable text? This changes appearance only and is NOT secure redaction; source text may remain underneath."); if (!confirmed) return; const cover = { id: makeId(), page: pageIndex, type: "cover", x: item.x, y: item.y, w: item.w, h: item.h, color: "#ffffff", opacity: 1, text: "" }; const replacement = { ...cover, id: makeId(), type: "covertext", text: item.text, color: "#292622", fontSize: 12, w: Math.max(item.w, 10), h: Math.max(item.h, 3) }; commit([...overlays, cover, replacement]); setSelectedId(replacement.id); setSelectSourceText(false); setNotice("Source text covered visually and replaced with an editable overlay. Original content may remain extractable; not secure redaction."); }}>{" "}</button>)}
                {pageInfo && visibleOverlays.map((item) => <div key={item.id} className={`pdf-overlay pdf-overlay--${item.type} ${item.id === selectedId ? "is-selected" : ""}`} style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%`, color: item.color, opacity: item.opacity, fontSize: `${Math.max(9, item.fontSize * pageInfo.viewportWidth / pageInfo.width)}px`, transform: `rotate(${item.rotation}deg)`, textAlign: item.align }} onPointerDown={(e) => startDrag(e, item)} onClick={() => setSelectedId(item.id)}>{item.type === "image" || item.type === "signature" ? <img src={item.data} alt={item.type === "signature" ? "Signature image" : "Added document image"} /> : item.type === "rectangle" || item.type === "highlight" || item.type === "cover" ? null : item.text}<button className="pdf-resize" title="Resize element" onPointerDown={(e) => startDrag(e, item, true)} aria-label="Resize element" />{item.id === selectedId && <button className="pdf-element-delete" title="Delete element" onClick={(e) => { e.stopPropagation(); deleteSelected(); }}>×</button>}</div>)}
              </div>}
            </div>
            <div className="pdf-page-nav"><button onClick={() => setPageIndex((i) => Math.max(0, i - 1))} disabled={!pages.length || pageIndex === 0}>← PREVIOUS</button><span>{pages.length ? `${pageIndex + 1} of ${pages.length}` : "No page selected"}</span><button onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))} disabled={!pages.length || pageIndex >= pages.length - 1}>NEXT →</button></div>
          </main>
          <aside className={`pdf-rail pdf-rail--right ${tab === "properties" ? "is-active" : ""}`}>
            <div className="pdf-mobile-tabs"><button onClick={() => setTab("tools")} className={tab === "tools" ? "is-active" : ""}>TOOLS</button><button onClick={() => setTab("properties")} className={tab === "properties" ? "is-active" : ""}>DETAILS</button></div>
            <section className="pdf-tool-section"><div className="pdf-rail-head"><span>02 / ADD TO PAGE</span></div><div className="pdf-tool-grid"><button onClick={() => addOverlay("text")}>T<small>TEXT</small></button><button onClick={() => addOverlay("rectangle", { color: "#dc4b3f", w: 30, h: 16 })}>□<small>SHAPE</small></button><button onClick={() => addOverlay("line", { color: "#292622", w: 24, h: 1, fontSize: 6 })}>／<small>LINE</small></button><button onClick={() => addOverlay("highlight", { color: "#f2c94c", opacity: .4, w: 36, h: 8 })}>▰<small>MARK</small></button><button onClick={() => { setImagePurpose("image"); imageInputRef.current?.click(); }}>▧<small>IMAGE</small></button><button onClick={() => { setImagePurpose("signature"); imageInputRef.current?.click(); }}>✎<small>SIGN</small></button></div><input className="pdf-hidden" ref={imageInputRef} type="file" accept="image/png,image/jpeg" onChange={(e) => addImage(e.target.files?.[0])} /></section>
            <section className="pdf-tool-section pdf-page-tools"><div className="pdf-rail-head"><span>03 / PAGE ACTIONS</span></div><div className="pdf-page-tool-actions"><button onClick={() => pageOperation("rotate")} disabled={!pages.length}>ROTATE 90°</button><button onClick={() => pageOperation("duplicate")} disabled={!pages.length}>DUPLICATE PAGE</button><button onClick={() => pageOperation("delete")} disabled={!pages.length}>DELETE PAGE</button></div><p>Page order follows the thumbnail rail. Edited pages retain vector content.</p></section>
            <section className="pdf-properties"><div className="pdf-rail-head"><span>04 / SELECTION</span><button onClick={duplicateSelected} disabled={!selected}>DUPLICATE</button></div>{selected ? <div className="pdf-properties-fields">
              {(selected.type === "text" || selected.type === "covertext") && <><label>TEXT<textarea value={selected.text} onChange={(e) => updateSelected("text", e.target.value)} rows="3" /></label><div className="pdf-field-row"><label>SIZE<input type="number" min="6" max="96" value={selected.fontSize} onChange={(e) => updateSelected("fontSize", clamp(Number(e.target.value), 6, 96))} /></label><label>FONT<select value={selected.fontFamily} onChange={(e) => updateSelected("fontFamily", e.target.value)}><option>Helvetica</option><option>Times Roman</option><option>Courier</option></select></label></div><div className="pdf-format-row"><button className={selected.bold ? "is-active" : ""} onClick={() => updateSelected("bold", !selected.bold)}><b>B</b></button><button className={selected.italic ? "is-active" : ""} onClick={() => updateSelected("italic", !selected.italic)}><i>I</i></button><select value={selected.align} onChange={(e) => updateSelected("align", e.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select><input aria-label="Text color" type="color" value={selected.color} onChange={(e) => updateSelected("color", e.target.value)} /></div></>}
              <div className="pdf-field-row"><label>X %<input type="number" value={Math.round(selected.x)} onChange={(e) => updateSelected("x", clamp(Number(e.target.value), 0, 90))} /></label><label>Y %<input type="number" value={Math.round(selected.y)} onChange={(e) => updateSelected("y", clamp(Number(e.target.value), 0, 90))} /></label></div><div className="pdf-field-row"><label>WIDTH %<input type="number" min="2" max="100" value={Math.round(selected.w)} onChange={(e) => updateSelected("w", clamp(Number(e.target.value), 2, 100))} /></label><label>HEIGHT %<input type="number" min="2" max="100" value={Math.round(selected.h)} onChange={(e) => updateSelected("h", clamp(Number(e.target.value), 2, 100))} /></label></div><label>ROTATION °<input type="number" min="-180" max="180" value={selected.rotation} onChange={(e) => updateSelected("rotation", clamp(Number(e.target.value), -180, 180))} /></label><label>OPACITY<input type="range" min="0.1" max="1" step="0.05" value={selected.opacity} onChange={(e) => updateSelected("opacity", Number(e.target.value))} /></label><div className="pdf-property-buttons"><button onClick={deleteSelected}>DELETE ELEMENT</button></div><p className="pdf-warning">To visually replace selectable source text, use SOURCE TEXT above and select its word or line. This is not secure redaction; hidden text remains.</p>
            </div> : <div className="pdf-no-selection"><span>↖</span><p>Select a page element to change its text, position, color, size, or opacity.</p></div>}</section>
            <section className="pdf-ai-panel"><div className="pdf-ai-title"><span>05 / AI ASSISTANT</span><b>{apiReady ? "FREE MODEL" : "OPTIONAL"}</b></div><p>Uses selected overlay text or extracted text from this page only. Runs when you ask.</p><form onSubmit={requestAi}><select value={aiTask} onChange={(e) => setAiTask(e.target.value)}><option>Rewrite selected text</option><option>Summarize current page / selection</option><option>Fix grammar</option><option>Simplify selected text</option><option>Generate text</option><option>Explain current page / selection</option><option>Find on current page / selection</option><option>Suggest cleaner layout</option></select><textarea value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} placeholder="Ask about the current page or describe what to write…" rows="2"/><div className="pdf-ai-disclosure">Only selected overlay text, or extracted text from this page (max 4,000 characters), plus your task/question is sent to OpenRouter. The PDF itself is never uploaded.</div><button disabled={busy || !apiReady}>{busy ? "THINKING…" : "ASK GEMMA ↗"}</button></form>{!apiReady && <small className="pdf-api-offline">AI is not configured. Local editing and export still work.</small>}{proposal && <div className="pdf-proposal"><b>PROPOSED CHANGE</b><p>{proposal}</p><div><button onClick={applyProposal}>APPLY</button><button onClick={() => setProposal("")}>DISMISS</button></div></div>}{aiDisclosure && <small className="pdf-privacy-note">Review the suggested text before applying it. Model availability varies; no paid fallback is used.</small>}</section>
          </aside>
        </div>
        <footer className="pdf-statusbar"><div>{error ? <span className="pdf-error">⚠ {error}</span> : notice ? <span>{notice}</span> : <span>READY · FILES STAY LOCAL</span>}</div><div>{pageText.trim() ? `${pageText.trim().split(/\s+/).length} EXTRACTED WORDS` : pdfDocument ? "LIKELY SCANNED PAGE · OCR UNAVAILABLE" : "PDF / VECTOR EXPORT"}</div></footer>
        <div className="pdf-export-options"><label>EXPORT NAME <input value={filename} onChange={(e) => setFilename(e.target.value)} disabled={!pdfData} /></label><small>Edited export may lose forms, bookmarks, or some metadata. Use ORIGINAL to download the unchanged source.</small></div>
      </section>
    </div>
  );
}
