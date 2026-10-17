import React, { useEffect, useMemo, useRef, useState } from "react";
import { calculateFinance, monthlyTrend } from "./finance/calculations.js";
import { loadFinanceState, saveFinanceState } from "./finance/finance-store.js";
import "./financial-agent.css";

const CATEGORIES = ["Food", "Travel", "Shopping", "Housing", "Bills", "Healthcare", "Education", "Entertainment", "Salary", "Freelance", "Other"];
const METHODS = ["Cash", "Card", "Bank transfer", "UPI", "Other"];
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => today().slice(0, 7);
const fmt = (value, currency) => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value || 0);
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

export default function FinancialAgent({ onClose }) {
  const [state, setState] = useState(loadFinanceState);
  const [month, setMonth] = useState(currentMonth());
  const currency = "INR";
  const [tab, setTab] = useState("Overview");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [entry, setEntry] = useState({ description: "", amount: "", type: "expense", category: "Food", date: today(), method: "UPI" });
  const [editingId, setEditingId] = useState(null);
  const [budgetDraft, setBudgetDraft] = useState({ category: "Overall", amount: "" });
  const [budgetEditing, setBudgetEditing] = useState(null);
  const [saved, setSaved] = useState(true);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [localReply, setLocalReply] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const priorFocus = useRef(null);

  useEffect(() => {
    priorFocus.current = document.activeElement;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll("button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex='-1'])")];
        if (!items.length) return;
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    fetch("/api/finance/status").then(response => response.ok ? response.json() : null).then(data => setAiConfigured(Boolean(data?.configured))).catch(() => setAiConfigured(false));
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = priorOverflow; priorFocus.current?.focus?.(); };
  }, [onClose]);

  useEffect(() => setSaved(saveFinanceState(state)), [state]);
  const totals = useMemo(() => calculateFinance(state.transactions, month), [state.transactions, month]);
  const trend = useMemo(() => monthlyTrend(state.transactions, month), [state.transactions, month]);
  const activeBudgets = state.budgets.filter(item => item.month === month);
  const rows = useMemo(() => state.transactions.filter(item => item.date.startsWith(month) && item.description.toLowerCase().includes(query.toLowerCase()) && (kindFilter === "all" || item.type === kindFilter) && (categoryFilter === "all" || item.category === categoryFilter)).sort((a,b) => sort === "newest" ? b.date.localeCompare(a.date) : sort === "oldest" ? a.date.localeCompare(b.date) : sort === "largest" ? b.amount-a.amount : a.amount-b.amount), [state.transactions, month, query, kindFilter, categoryFilter, sort]);

  function submitTransaction(event) {
    event.preventDefault();
    const amount = Number(entry.amount);
    if (!entry.description.trim() || !Number.isFinite(amount) || amount <= 0 || !entry.date || !entry.category || !entry.method) return;
    const item = { ...entry, description: entry.description.trim(), amount, id: editingId || id() };
    setState(previous => ({ ...previous, transactions: editingId ? previous.transactions.map(row => row.id === editingId ? item : row) : [item, ...previous.transactions] }));
    setEntry({ description: "", amount: "", type: "expense", category: "Food", date: today(), method: "UPI" }); setEditingId(null);
  }
  function editTransaction(item) { setEntry({ ...item, amount: String(item.amount) }); setEditingId(item.id); setTab("Transactions"); }
  function deleteTransaction(transactionId) { setState(previous => ({ ...previous, transactions: previous.transactions.filter(item => item.id !== transactionId) })); }
  function saveBudget(event) {
    event.preventDefault(); const amount = Number(budgetDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const item = { id: budgetEditing || id(), category: budgetDraft.category, amount, month };
    setState(previous => ({ ...previous, budgets: budgetEditing ? previous.budgets.map(row => row.id === budgetEditing ? item : row) : [...previous.budgets, item] }));
    setBudgetDraft({ category: "Overall", amount: "" }); setBudgetEditing(null);
  }
  const localAnswer = () => {
    const top = Object.entries(totals.categoryTotals).sort((a,b) => b[1]-a[1])[0];
    if (/food|grocer|dining/i.test(question) && totals.categoryTotals.Food != null) return `You recorded ${fmt(totals.categoryTotals.Food, currency)} in Food spending for ${month}. This is based on the transactions saved in this browser.`;
    if (/top|highest|category|spend/i.test(question) && top) return `${top[0]} is the largest recorded expense category this month at ${fmt(top[1], currency)}. Total recorded expenses are ${fmt(totals.expenses, currency)}.`;
    if (/save|saving|rate/i.test(question)) return `Your recorded savings for ${month} are ${fmt(totals.savings, currency)} (${totals.savingsRate.toFixed(1)}% of recorded income). This month has ${fmt(totals.income, currency)} income and ${fmt(totals.expenses, currency)} expenses.`;
    return `For ${month}, you recorded ${fmt(totals.income, currency)} income, ${fmt(totals.expenses, currency)} expenses, and a ${fmt(totals.balance, currency)} balance. Add transactions for more detailed category answers.`;
  };
  async function askAssistant(event) {
    event.preventDefault(); if (!question.trim()) return;
    setLocalReply(localAnswer()); setReply(""); setAiError(""); setAiLoading(true);
    try {
      const needsCategories = /category|spend|spent|food|travel|shopping|housing|bills|health|education|entertainment/i.test(question);
      const namedCategory = CATEGORIES.find(category => new RegExp(`\\b${category}\\b`, "i").test(question));
      const categories = needsCategories ? Object.entries(totals.categoryTotals).sort((a,b) => b[1]-a[1]).filter(([name]) => !namedCategory || name === namedCategory).slice(0, namedCategory ? 1 : 8).map(([name, amount]) => ({ name, amount })) : [];
      const response = await fetch("/api/finance/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: question.trim(), summary: { month, currency, income: totals.income, expenses: totals.expenses, balance: totals.balance, savingsRate: totals.savingsRate, categories } }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Finance AI is unavailable."); setReply(data.answer);
    } catch (error) { setAiError(error.message || "Finance AI is unavailable. Local answers remain available."); }
    finally { setAiLoading(false); }
  }

  const maximum = Math.max(1, ...trend.flatMap(item => [item.income, item.expenses]));
  const chartPoints = (key) => trend.map((item,index) => `${12 + index * 56},${88 - (item[key] / maximum) * 70}`).join(" ");
  const overBudget = activeBudgets.map(item => ({ ...item, spent: item.category === "Overall" ? totals.expenses : totals.categoryTotals[item.category] || 0 })).filter(item => item.spent >= item.amount * .8);
  const previousMonth = trend.at(-2);
  const comparison = previousMonth?.expenses ? ((totals.expenses - previousMonth.expenses) / previousMonth.expenses) * 100 : null;
  const recurring = state.transactions.filter(item => item.type === "expense" && item.date.startsWith(month)).reduce((acc,item) => { const key = `${item.description.toLowerCase()}|${item.amount}`; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
  const recurringCount = Object.values(recurring).filter(count => count > 1).length;
  const monthlyExpenses = state.transactions.filter(item => item.type === "expense" && item.date.startsWith(month));
  const unusualExpense = monthlyExpenses.find(item => {
    const peerAmounts = monthlyExpenses.filter(peer => peer.category === item.category).map(peer => peer.amount).sort((a,b)=>a-b);
    if (peerAmounts.length < 3) return false;
    const median = peerAmounts[Math.floor(peerAmounts.length / 2)];
    return item.amount > median * 2;
  });

  return <div className="finance-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="finance-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-title" ref={dialogRef}>
      <header className="finance-header"><div><span className="finance-kicker">R / PERSONAL LEDGER · EDUCATIONAL BUDGETING</span><h2 id="finance-title">Money, <em>in view.</em></h2><p>Track what you record here. No bank connection, sync, or financial advice.</p></div><button ref={closeRef} className="finance-close" type="button" onClick={onClose} aria-label="Close financial workspace">×</button></header>
      <div className="finance-toolbar"><label>MONTH <input type="month" value={month} onChange={event => setMonth(event.target.value)} /></label><span className="finance-currency">CURRENCY <b>INR</b></span><nav aria-label="Finance workspace tabs">{["Overview", "Transactions", "Budgets", "Assistant"].map(label => <button key={label} className={tab === label ? "is-active" : ""} type="button" onClick={() => setTab(label)}>{label}</button>)}</nav></div>
      <div className="finance-body">
        {!saved && <p className="finance-storage-note" role="status">Browser storage is unavailable. Your changes may not survive closing this page.</p>}
        <div className="finance-stat-grid"><article><span>INCOME</span><strong>{fmt(totals.income,currency)}</strong><small>recorded this month</small></article><article><span>EXPENSES</span><strong className="is-expense">{fmt(totals.expenses,currency)}</strong><small>recorded this month</small></article><article><span>CURRENT BALANCE</span><strong>{fmt(totals.balance,currency)}</strong><small>income minus expenses</small></article><article><span>SAVINGS RATE</span><strong>{totals.savingsRate.toFixed(1)}%</strong><small>{fmt(totals.savings,currency)} net this month</small></article></div>
        {tab === "Overview" && <div className="finance-columns">
          <section className="finance-panel"><div className="finance-panel-heading"><div><span className="finance-kicker">01 / SIX MONTHS</span><h3>Income & expenses</h3></div><span className="finance-legend"><i /> Income <i className="expense-dot" /> Expenses</span></div>{state.transactions.length ? <svg className="finance-chart" viewBox="0 0 300 110" role="img" aria-label="Six-month income and expense trend"><polyline points={chartPoints("income")} /><polyline className="expense-line" points={chartPoints("expenses")} />{trend.map((item,index) => <text key={item.month} x={12 + index * 56} y="106">{item.label}</text>)}</svg> : <div className="finance-empty-chart">Add transactions to see your six-month trend.</div>}</section>
          <section className="finance-panel"><div className="finance-panel-heading"><div><span className="finance-kicker">02 / OUTFLOW</span><h3>By category</h3></div></div>{Object.keys(totals.categoryTotals).length ? <ul className="finance-category-list">{Object.entries(totals.categoryTotals).sort((a,b)=>b[1]-a[1]).map(([name,amount])=><li key={name}><span>{name}</span><b>{fmt(amount,currency)}</b><i style={{ "--share": `${Math.max(4, amount / Math.max(1, totals.expenses) * 100)}%` }} /></li>)}</ul> : <p className="finance-empty-chart">Category totals will appear after you log an expense.</p>}</section>
          <section className="finance-panel finance-insights"><div className="finance-panel-heading"><div><span className="finance-kicker">03 / OBSERVATIONS</span><h3>Month in context</h3></div></div><p>{comparison == null ? "Add expense history to compare months." : `Recorded expenses are ${Math.abs(comparison).toFixed(0)}% ${comparison > 0 ? "higher" : "lower"} than last month.`}</p><p>{recurringCount ? `${recurringCount} repeated expense pattern${recurringCount === 1 ? "" : "s"} spotted this month; check if the entries represent recurring bills.` : "No repeated same-amount expense descriptions found this month."}</p><p>{unusualExpense ? `Possible outlier: “${unusualExpense.description}” is more than twice the median ${unusualExpense.category} entry this month. Check the amount or category; this is a simple flag, not a judgment.` : "No clear unusually large category entry flagged; at least three entries in a category are needed for this comparison."}</p><p>{totals.savingsRate < 0 ? "Recorded spending exceeds income. Review discretionary categories and upcoming bills." : totals.income ? "Consider setting aside a regular portion of recorded income toward a buffer, if it suits your goals." : "Record income and expenses to receive useful budgeting observations."}</p></section>
          <section className="finance-panel"><div className="finance-panel-heading"><div><span className="finance-kicker">04 / PLAN</span><h3>Budget pulse</h3></div><button type="button" className="finance-text-button" onClick={() => setTab("Budgets")}>MANAGE →</button></div>{activeBudgets.length ? activeBudgets.map(item => { const spent = item.category === "Overall" ? totals.expenses : totals.categoryTotals[item.category] || 0; const pct = Math.min(100, spent / item.amount * 100); return <div className="finance-budget-preview" key={item.id}><span>{item.category}</span><b>{fmt(spent,currency)} / {fmt(item.amount,currency)}</b><i><span style={{ width: `${pct}%` }} /></i></div>; }) : <p className="finance-empty-chart">No monthly budgets yet. Set a limit to keep an eye on spending.</p>}{overBudget.map(item => <p className="finance-warning" role="status" key={item.id}>{item.spent >= item.amount ? "100% reached" : "80% reached"} · {item.category} budget</p>)}</section>
        </div>}
        {tab === "Transactions" && <div className="finance-transactions"><section className="finance-panel"><div className="finance-panel-heading"><div><span className="finance-kicker">ADD OR EDIT</span><h3>{editingId ? "Update entry" : "New transaction"}</h3></div></div><form className="finance-form" onSubmit={submitTransaction}><label>Description<input required maxLength="100" value={entry.description} onChange={e=>setEntry({...entry,description:e.target.value})} placeholder="e.g. Weekly groceries" /></label><div className="finance-form-row"><label>Amount<input required type="number" min="0.01" step="0.01" value={entry.amount} onChange={e=>setEntry({...entry,amount:e.target.value})} /></label><label>Type<select value={entry.type} onChange={e=>setEntry({...entry,type:e.target.value,category:e.target.value==="income"?"Salary":"Food"})}><option value="expense">Expense</option><option value="income">Income</option></select></label></div><div className="finance-form-row"><label>Category<select value={entry.category} onChange={e=>setEntry({...entry,category:e.target.value})}>{CATEGORIES.map(category=><option key={category}>{category}</option>)}</select></label><label>Date<input required type="date" value={entry.date} onChange={e=>setEntry({...entry,date:e.target.value})} /></label></div><label>Payment method<select value={entry.method} onChange={e=>setEntry({...entry,method:e.target.value})}>{METHODS.map(method=><option key={method}>{method}</option>)}</select></label><div className="finance-form-actions"><button className="finance-primary" type="submit">{editingId ? "SAVE CHANGES" : "ADD TRANSACTION"}</button>{editingId && <button type="button" className="finance-text-button" onClick={()=>{setEditingId(null);setEntry({description:"",amount:"",type:"expense",category:"Food",date:today(),method:"UPI"});}}>CANCEL</button>}</div></form></section>
          <section className="finance-panel finance-history"><div className="finance-panel-heading"><div><span className="finance-kicker">LEDGER / {month}</span><h3>Transaction history</h3></div><strong>{rows.length} ENTRIES</strong></div><div className="finance-filters"><input aria-label="Search transactions" placeholder="Search description" value={query} onChange={e=>setQuery(e.target.value)} /><select aria-label="Filter by type" value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expenses</option></select><select aria-label="Filter by category" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="all">All categories</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select><select aria-label="Sort transactions" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="largest">Largest first</option><option value="smallest">Smallest first</option></select></div>{rows.length ? <div className="finance-table-wrap"><table><thead><tr><th>ENTRY</th><th>DATE</th><th>CATEGORY</th><th>METHOD</th><th>AMOUNT</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map(item=><tr key={item.id}><td>{item.description}</td><td>{item.date}</td><td>{item.category}</td><td>{item.method}</td><td className={item.type === "income" ? "is-income" : "is-expense"}>{item.type === "income" ? "+" : "−"}{fmt(item.amount,currency)}</td><td><button type="button" aria-label={`Edit ${item.description}`} onClick={()=>editTransaction(item)}>Edit</button><button type="button" aria-label={`Delete ${item.description}`} onClick={()=>deleteTransaction(item.id)}>Delete</button></td></tr>)}</tbody></table></div> : <div className="finance-empty-ledger"><strong>No transactions for this month yet.</strong><p>Your records stay in this browser; there are no sample transactions.</p></div>}</section></div>}
        {tab === "Budgets" && <div className="finance-columns"><section className="finance-panel"><div className="finance-panel-heading"><div><span className="finance-kicker">MONTHLY LIMIT</span><h3>{budgetEditing ? "Edit budget" : "Set a budget"}</h3></div></div><form className="finance-form" onSubmit={saveBudget}><label>Budget category<select value={budgetDraft.category} onChange={e=>setBudgetDraft({...budgetDraft,category:e.target.value})}>{["Overall",...CATEGORIES.filter(c=>!['Salary','Freelance'].includes(c))].map(c=><option key={c}>{c}</option>)}</select></label><label>Monthly limit<input required type="number" min="0.01" step="0.01" value={budgetDraft.amount} onChange={e=>setBudgetDraft({...budgetDraft,amount:e.target.value})} /></label><button className="finance-primary" type="submit">{budgetEditing ? "SAVE BUDGET" : "ADD BUDGET"}</button></form><p className="finance-muted">Budgets apply to the selected month. At 80% and 100%, a status reminder appears.</p></section><section className="finance-panel"><div className="finance-panel-heading"><div><span className="finance-kicker">{month} / ALLOCATIONS</span><h3>Budget progress</h3></div></div>{activeBudgets.length ? activeBudgets.map(item=>{const spent=item.category === "Overall"?totals.expenses:totals.categoryTotals[item.category]||0; const pct=spent/item.amount*100; return <div className="finance-budget-row" key={item.id}><div><strong>{item.category}</strong><span>{fmt(spent,currency)} of {fmt(item.amount,currency)} · {fmt(Math.max(0,item.amount-spent),currency)} remaining</span></div><i><b className={pct>=100?"over":""} style={{width:`${Math.min(100,pct)}%`}} /></i>{pct>=80&&<p className="finance-warning">{pct>=100?"Budget reached or exceeded":"Approaching limit (80%+)"}</p>}<button className="finance-text-button" type="button" onClick={()=>{setBudgetEditing(item.id);setBudgetDraft({category:item.category,amount:String(item.amount)});}}>EDIT</button><button className="finance-text-button" type="button" onClick={()=>setState(prev=>({...prev,budgets:prev.budgets.filter(b=>b.id!==item.id)}))}>DELETE</button></div>}) : <p className="finance-empty-chart">No budgets for {month}. Add a monthly overall limit or category target.</p>}</section></div>}
        {tab === "Assistant" && <div className="finance-assistant-grid"><section className="finance-panel"><span className="finance-kicker">LOCAL ANSWERS / COMPUTED FROM THIS MONTH</span><h3>Ask your ledger</h3><div className="finance-example-questions"><button type="button" onClick={()=>setQuestion("How much did I spend on food this month?")}>How much did I spend on food this month?</button><button type="button" onClick={()=>setQuestion("Which category is my highest expense?")}>Which category is my highest expense?</button><button type="button" onClick={()=>setQuestion("How much did I save this month?")}>How much did I save this month?</button></div><form className="finance-ask-form" onSubmit={askAssistant}><label htmlFor="finance-question">Your question</label><textarea id="finance-question" rows="3" maxLength="500" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask about your recorded monthly totals..." /><button className="finance-primary" disabled={aiLoading||!question.trim()}>{aiLoading?"ASKING GEMMA…":"ASK LOCAL + AI"}</button></form>{localReply&&<div className="finance-reply finance-local-answer" aria-live="polite"><b>LOCAL CALCULATION / SOURCE OF TRUTH</b><p>{localReply}</p></div>}{reply&&<div className="finance-reply" aria-live="polite"><b>AI EXPLANATION / OPTIONAL</b><p>{reply}</p></div>}{aiError&&<div className="finance-error" role="alert"><p>{aiError}</p><button type="button" className="finance-text-button" onClick={askAssistant}>RETRY AI EXPLANATION</button></div>}</section><aside className="finance-ai-note"><span className="finance-kicker">OPTIONAL AI EXPLANATION</span><h3>{aiConfigured?"Free Gemma model available":"AI unavailable / local mode remains ready"}</h3><p>Local answers and calculations use your saved entries in this browser.</p><p>When you ask, only your question and a compact monthly summary (totals and top categories) are sent to OpenRouter’s free Gemma model. Individual transactions are not sent. No paid fallback is used.</p><p>AI explanations can be wrong. Verify amounts against the ledger; this is an educational budgeting demo, not financial advice.</p></aside></div>}
        <footer className="finance-privacy"><span>LOCAL LEDGER / THIS BROWSER & DEVICE</span><p>Stored in browser localStorage. Not encrypted or synced; clear this browser’s site data to remove it. Keep sensitive details out of descriptions.</p><a href="#contact" onClick={onClose}>Contact Rashid ↗</a></footer>
      </div>
    </section>
  </div>;
}
