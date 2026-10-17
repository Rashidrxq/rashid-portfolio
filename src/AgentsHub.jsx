import React from "react";
import "./agents-hub.css";

const agents = [
  { id: "ats-agent", number: "01", title: "Resume ATS Checker", description: "Check resume structure and role keywords privately in this browser.", status: "LOCAL · RULE-BASED", bot: "screen", action: "OPEN RESUME CHECKER" },
  { id: "linkedin-studio", number: "02", title: "LinkedIn Post Studio", description: "Shape a post brief, then use your own ChatGPT account by handoff.", status: "MANUAL CHATGPT HANDOFF", bot: "writer", action: "OPEN POST STUDIO" },
  { id: "travel-planner", number: "03", title: "AI Travel Planner", description: "Build a day-by-day starter itinerary around your dates, budget, and interests.", status: "FREE MODEL + LOCAL", bot: "traveler", action: "OPEN TRAVEL PLANNER" },
  { id: "pdf-editor", number: "05", title: "AI PDF Editor", description: "Upload, edit, customize, and export PDF documents using an intuitive visual editor.", status: "LOCAL EDITING · OPTIONAL AI", bot: "pdf", action: "OPEN PDF EDITOR", tags: ["PDF TOOLS", "AI AGENT", "DOCUMENT EDITING"] },
];

function Bot({ kind }) {
  return (
    <span className={`agent-bot agent-bot--${kind}`} aria-hidden="true">
      <span className="bot-orbit" /><span className="bot-antenna"><i /></span>
      <span className="bot-ear bot-ear--left" /><span className="bot-ear bot-ear--right" />
      <span className="bot-head"><span className="bot-brow" /><span className="bot-eye bot-eye--left" /><span className="bot-eye bot-eye--right" /><span className="bot-mouth" /><span className="bot-face-detail" /></span>
      <span className="bot-neck" /><span className="bot-body"><span className="bot-panel" /><span className="bot-chest-mark" /><span className="bot-arm bot-arm--left" /><span className="bot-arm bot-arm--right" /></span>
      <span className="bot-shadow" />
      {kind === "screen" && <span className="bot-tool bot-tool--screen">CV<br />SCAN</span>}
      {kind === "writer" && <span className="bot-tool bot-tool--paper">IN</span>}
      {kind === "traveler" && <span className="bot-tool bot-tool--pack"><i /></span>}
      {kind === "finance" && <span className="bot-tool bot-tool--ledger">₹<i>▂ ▅ ▇</i></span>}
      {kind === "pdf" && <span className="bot-tool bot-tool--ledger">PDF<i>✎</i></span>}
    </span>
  );
}

export default function AgentsHub({ onOpenFinance, onOpenPdf }) {
  return (
    <section className="agents-hub section-shell" id="agents" aria-labelledby="agents-heading">
      <div className="agents-hub-topline"><p className="eyebrow"><span>03</span> A SMALL CREW OF USEFUL TOOLS</p><span className="agents-hub-index mono">R / AUTOMATION DESK</span></div>
      <div className="agents-hub-heading"><h2 id="agents-heading">Meet the<br /><em>agents.</em></h2><p>Five focused helpers, each with a clear job. Pick a bot to jump straight into its workspace.</p></div>
      <div className="agents-grid">
        {[...agents.slice(0, 3), { id: "finance-agent", number: "04", title: "Financial AI Agent", description: "AI-powered finance tracker and manager for thoughtful personal budgeting.", status: "LOCAL LEDGER · OPTIONAL AI", bot: "finance", action: "OPEN AGENT", tags: ["AI AGENT", "FINANCE", "ANALYTICS"] }, agents[3]].map((agent) => (
          <article className={`agent-card agent-card--${agent.bot}`} key={agent.id}>
            {agent.id === "finance-agent" || agent.id === "pdf-editor" ? (
              <button className="agent-card-link" type="button" onClick={agent.id === "finance-agent" ? onOpenFinance : onOpenPdf} aria-label={`${agent.action}: ${agent.title}`}>
              <div className="agent-card-art"><span className="agent-card-coordinate mono">UNIT / {agent.number}</span><span className="agent-card-ring agent-card-ring--one" /><span className="agent-card-ring agent-card-ring--two" /><Bot kind={agent.bot} /><span className="agent-card-target" aria-hidden="true">↗</span></div>
              <div className="agent-card-copy"><div className="agent-card-meta"><span className="mono">{agent.number} / 05</span><span className="agent-status"><i />{agent.status}</span></div><h3>{agent.title}</h3><p>{agent.description}</p>{agent.tags && <div className="finance-tags">{agent.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}<span className="agent-card-action mono">{agent.action}<b aria-hidden="true"> ↘</b></span></div>
              </button>
            ) : (
              <a className="agent-card-link" href={`#${agent.id}`} aria-label={`${agent.action}: ${agent.title}`}>
                <div className="agent-card-art"><span className="agent-card-coordinate mono">UNIT / {agent.number}</span><span className="agent-card-ring agent-card-ring--one" /><span className="agent-card-ring agent-card-ring--two" /><Bot kind={agent.bot} /><span className="agent-card-target" aria-hidden="true">↗</span></div>
                <div className="agent-card-copy"><div className="agent-card-meta"><span className="mono">{agent.number} / 05</span><span className="agent-status"><i />{agent.status}</span></div><h3>{agent.title}</h3><p>{agent.description}</p><span className="agent-card-action mono">{agent.action}<b aria-hidden="true"> ↘</b></span></div>
              </a>
            )}
          </article>
        ))}
      </div>
      <div className="agents-hub-foot"><span>FIVE TOOLS / ONE CREATIVE PRACTICE</span><span className="agents-hub-rule" /><span>SCROLL TO MEET THEM ↓</span></div>
    </section>
  );
}
