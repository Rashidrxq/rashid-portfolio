import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import "./support-chat-tailwind.css";
import "./support-chat.css";

type Source = {
  id: string;
  title: string;
  filename: string;
  section?: string;
  page?: number;
  excerpt: string;
};

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  sources?: Source[];
  mode?: "ollama" | "extractive" | "unsupported";
};

type Health = { modelConnected: boolean; knowledgeSources: number };

const INITIAL_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  text: "Hi, I’m Rashid’s portfolio support assistant. Ask me about the featured project or the tools on this site. I’ll cite the portfolio notes I use.",
};

const STARTERS = [
  "What is the featured project?",
  "What can the ATS tool do?",
  "How can I contact Rashid?",
];

const EMAIL = "rashid.mhd.pp@gmail.com";
const PHONE = "+919745393044";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function BubbleIcon({ close = false }: { close?: boolean }) {
  return close ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="support-fab-icon"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="support-fab-icon"><path d="M5 18.5 3.8 21l4.1-1.1c1.22.6 2.6.9 4.1.9 5.1 0 9.2-3.7 9.2-8.3S17.1 4.2 12 4.2 2.8 7.9 2.8 12.5c0 2.3.83 4.4 2.2 6Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" /><path d="M8 12.5h.02M12 12.5h.02M16 12.5h.02" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
  );
}

export default function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [healthChecked, setHealthChecked] = useState(false);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setHealthChecked(false);
    setServiceUnavailable(false);
    fetch("/api/support/health", { headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error("Support service is unavailable");
        return response.json();
      })
      .then((result: Health) => {
        if (active) setHealth(result);
      })
      .catch(() => {
        if (active) {
          setHealth(null);
          setServiceUnavailable(true);
        }
      })
      .finally(() => {
        if (active) setHealthChecked(true);
      });
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, open]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        window.setTimeout(() => fabRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  async function send(text = draft) {
    const content = text.trim();
    if (!content || busy || content.length > 1200) return;
    setError("");
    setDraft("");
    const userMessage: Message = { id: makeId(), role: "user", text: content };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setBusy(true);
    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          message: content,
          history: nextMessages.filter((message) => message.role !== "assistant" || message.id !== "welcome").slice(-6).map(({ role, text: messageText }) => ({ role, content: messageText })),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) throw new Error(result?.error || "The support assistant could not respond right now.");
      setMessages((current) => [...current, {
        id: makeId(),
        role: "assistant",
        text: result.answer,
        sources: Array.isArray(result.sources) ? result.sources : [],
        mode: result.mode,
      }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The support assistant could not respond right now.");
      setDraft(content);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  function newChat() {
    setMessages([INITIAL_MESSAGE]);
    setDraft("");
    setError("");
  }

  const connectionLabel = serviceUnavailable ? "LOCAL SUPPORT SERVER UNAVAILABLE" : !healthChecked ? "CHECKING LOCAL MODEL" : health?.modelConnected ? "LOCAL MODEL CONNECTED" : "EXTRACTIVE DEMO MODE";

  return (
    <div id="support-chat-root" data-open={open ? "true" : "false"}>
      {open && (
        <section id="support-panel" className="support-panel sc-flex sc-flex-col sc-font-support" role="dialog" aria-modal="false" aria-labelledby="support-heading">
          <header className="support-header">
            <div className="support-header-main">
              <div className="support-avatar" aria-hidden="true"><span>R<span>.</span></span><i /></div>
              <div className="support-title-wrap">
                <p className="support-kicker">PORTFOLIO SUPPORT</p>
                <h2 id="support-heading">Ask Rashid’s assistant</h2>
                <span className="support-connection"><i className={health?.modelConnected ? "is-connected" : ""} />{connectionLabel}</span>
              </div>
            </div>
            <div className="support-header-actions">
              <button type="button" className="support-icon-button" onClick={newChat} disabled={busy} aria-label="Start a new chat" title="New chat"><span aria-hidden="true">↻</span></button>
              <button type="button" className="support-icon-button" onClick={() => { setOpen(false); window.setTimeout(() => fabRef.current?.focus(), 0); }} aria-label="Close support chat" title="Close chat"><span aria-hidden="true">×</span></button>
            </div>
          </header>

          {!health?.modelConnected && healthChecked && (
            <div className="support-mode-note" role="status">
              <span className="support-mode-mark">{serviceUnavailable ? "OFFLINE" : "LOCAL"}</span>
              <p>{serviceUnavailable ? "The local support server is unavailable. Restart the portfolio with npm run dev to enable replies." : "Ollama isn’t connected. Replies use excerpts from the portfolio notes; no paid AI service is used."}</p>
            </div>
          )}

          <div className="support-thread" aria-label="Chat messages" aria-live="polite">
            {messages.map((message) => (
              <article className={`support-message support-message--${message.role}`} key={message.id}>
                {message.role === "assistant" && <span className="support-message-mark" aria-hidden="true">R.</span>}
                <div className="support-message-body">
                  {message.mode && <span className="support-answer-mode">{message.mode === "ollama" ? "LOCAL MODEL · GROUNDED ANSWER" : message.mode === "extractive" ? "LOCAL SOURCE EXCERPTS · NO MODEL" : "NO MATCH IN PORTFOLIO NOTES"}</span>}
                  <p>{message.text}</p>
                  {!!message.sources?.length && (
                    <div className="support-sources" aria-label="Sources used">
                      <span className="support-sources-heading">SOURCE NOTES</span>
                      {message.sources.map((source) => (
                        <details className="support-source" key={source.id}>
                          <summary><span aria-hidden="true">↗</span>{source.title}<i>{source.page ? `p. ${source.page}` : source.section || source.filename}</i></summary>
                          <div className="support-source-detail"><span>{source.filename}{source.section ? ` · ${source.section}` : ""}{source.page ? ` · page ${source.page}` : ""}</span><p>{source.excerpt}</p></div>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {messages.length === 1 && (
              <div className="support-starters" aria-label="Suggested questions">
                <span className="support-starters-label">START HERE</span>
                {STARTERS.map((starter) => <button type="button" key={starter} onClick={() => void send(starter)} disabled={busy}>{starter}<span aria-hidden="true">↗</span></button>)}
              </div>
            )}
            {busy && <div className="support-typing" role="status"><span /><span /><span /><em>Looking through the portfolio notes…</em></div>}
            <div ref={threadEndRef} />
          </div>

          <footer className="support-footer">
            {error && <p className="support-error" role="alert">{error}</p>}
            <form className="support-composer" onSubmit={handleSubmit}>
              <label className="support-sr-only" htmlFor="support-message-input">Message the portfolio assistant</label>
              <textarea ref={inputRef} id="support-message-input" value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 1200))} onKeyDown={handleKeyDown} placeholder="Ask a question about this portfolio…" maxLength={1200} rows={2} disabled={busy} />
              <div className="support-compose-bottom"><span>{draft.length}/1200 <i>·</i> Enter to send</span><button type="submit" disabled={busy || !draft.trim()} aria-label="Send message"><span aria-hidden="true">↑</span></button></div>
            </form>
            <div className="support-human"><span>NEED A HUMAN?</span><a href={`mailto:${EMAIL}`}>EMAIL RASHID <b aria-hidden="true">↗</b></a><a href={`tel:${PHONE}`}>CALL <b aria-hidden="true">↗</b></a></div>
            <p className="support-privacy">Chats stay in this page tab only. Don’t share passwords or sensitive information.</p>
          </footer>
        </section>
      )}

      <button ref={fabRef} type="button" className="support-fab" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close portfolio support chat" : "Open portfolio support chat"} aria-expanded={open} aria-controls={open ? "support-panel" : undefined}>
        <span className="support-fab-pulse" aria-hidden="true" /><BubbleIcon close={open} /><span className="support-fab-label">{open ? "CLOSE" : "ASK A QUESTION"}</span>
      </button>
    </div>
  );
}
