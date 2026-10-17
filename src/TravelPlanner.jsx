import React, { useEffect, useRef, useState } from "react";
import "./travel-planner.css";

const INTERESTS = ["City & culture", "Food", "Nature", "History", "Adventure", "Slow moments", "Local markets"];
const CATEGORIES = ["Stay", "Food", "Local transport", "Activities", "Flex buffer"];
const DEFAULT_INTERESTS = ["City & culture", "Food", "Slow moments"];
const PACE_SPLITS = { Relaxed: [40, 25, 10, 15, 10], Balanced: [35, 25, 15, 15, 10], Full: [30, 20, 15, 25, 10] };
const ACTIVITIES = {
  "City & culture": ["Choose one neighborhood and explore it on foot", "Visit a local gallery or cultural center; check its current hours", "Take a self-guided architecture or public-art walk"],
  Food: ["Pick a local breakfast spot and try one regional dish", "Plan a market or food-hall stop; check opening days first", "Choose dinner from recent local recommendations"],
  Nature: ["Find a nearby public garden or easy nature trail", "Set aside an unhurried outdoor break and check access details", "Choose a scenic viewpoint reachable by your preferred transport"],
  History: ["Select one history museum or heritage site and verify entry details", "Walk a historic district using a current local guide", "Reserve time for one landmark after checking visitor guidance"],
  Adventure: ["Choose one beginner-friendly outdoor activity and verify safety requirements", "Set aside a half-day for a locally operated experience", "Compare a guided option with a self-guided route"],
  "Slow moments": ["Keep the morning open; choose a cafe or quiet public space nearby", "Leave a flexible afternoon for rest and spontaneous stops", "Take a low-key evening walk near your accommodation"],
  "Local markets": ["Browse a local market; confirm its operating days", "Look for a craft or produce market and check transport options", "Leave an open slot for a neighborhood market visit"],
};

const money = (amount, currency) => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount) || 0);

function budgetSplit(total, pace) {
  const percentages = PACE_SPLITS[pace] || PACE_SPLITS.Balanced;
  return CATEGORIES.map((label, index) => ({ label, amount: Math.round(Number(total) * percentages[index] / 100) }));
}

function dayNames(start, count) {
  const base = new Date(`${start}T12:00:00`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  });
}

function buildItinerary(form, budget) {
  const start = new Date(`${form.startDate}T12:00:00`);
  const end = new Date(`${form.endDate}T12:00:00`);
  const count = Math.round((end - start) / 86400000) + 1;
  if (!form.destination.trim()) return { error: "Add a destination to create your starter itinerary." };
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || count < 1) return { error: "Choose a valid start and end date." };
  if (count > 21) return { error: "This starter planner supports trips of up to 21 days." };
  if (!Number.isFinite(Number(budget)) || Number(budget) <= 0) return { error: "Enter a total budget greater than zero." };
  const dates = dayNames(form.startDate, count);
  const interests = form.interests.length ? form.interests : ["City & culture"];
  const days = dates.map((date, index) => {
    const primary = interests[index % interests.length];
    const secondary = interests[(index + 1) % interests.length];
    const first = ACTIVITIES[primary][index % ACTIVITIES[primary].length];
    const second = ACTIVITIES[secondary][(index + 1) % ACTIVITIES[secondary].length];
    const pace = form.pace === "Relaxed" ? "One main outing, with open time around it." : form.pace === "Full" ? "Two activity windows; leave travel time between them." : "One main outing and one optional stop.";
    return `DAY ${String(index + 1).padStart(2, "0")} · ${date}\n${pace}\n• ${first}\n• ${second}\n• Confirm local travel time and current opening details before you go.`;
  });
  return { count, days };
}

function makePrompt(form, itinerary, allocations, total) {
  return [
    "Help me refine this travel itinerary using only verified, current information when browsing is available.",
    "Do not assume attractions, transport routes, opening hours, visa rules, or prices are current. Flag details that need checking and include official source links for specific claims. Stay within the total budget; clearly label any estimate and do not invent availability.",
    "",
    `DESTINATION: ${form.destination.trim()}`,
    `DATES: ${form.startDate} to ${form.endDate}`,
    `TOTAL BUDGET: ${money(total, form.currency)} for ${form.travelers || 1} traveler(s)`,
    `INTERESTS: ${form.interests.length ? form.interests.join(", ") : "City & culture"}`,
    `PACE: ${form.pace}`,
    `CURRENT EDITABLE BUDGET ALLOCATION: ${allocations.map((item) => `${item.label}: ${money(item.amount, form.currency)}`).join("; ")}`,
    "",
    "LOCAL STARTER ITINERARY (generic ideas, not researched destination facts):",
    itinerary,
    "",
    "Please suggest a practical day-by-day revision and a budget check. Distinguish verified facts from suggestions and identify questions I should answer before booking.",
  ].join("\n");
}

function formatStructuredPlan(plan, currency) {
  const days = plan.days.map((day, index) => [
    `DAY ${String(index + 1).padStart(2, "0")} · ${day.date} · ${day.title}`,
    ...day.activities.map((activity) => `${activity.period.toUpperCase()} — ${activity.place}: ${activity.suggestion} (${money(activity.estimatedCost, currency)} estimate)`),
    ...day.meals.map((meal) => `${meal.meal.toUpperCase()} — ${meal.suggestion} (${money(meal.estimatedCost, currency)} estimate)`),
    `ACTIVITY + MEAL ESTIMATE: ${money(day.dayEstimate, currency)}`,
  ].join("\n")).join("\n\n");
  return `${plan.summary}\n\n${days}\n\nBUDGET NOTE\n${plan.budgetNote}\n\nESTIMATED BUDGET SUMMARY\n${money(plan.budgetSummary.estimatedTotal, currency)} total / ${money(plan.budgetSummary.requestedTotal, currency)} requested\n\n${plan.caveats.join("\n")}`;
}

export default function TravelPlanner() {
  const [form, setForm] = useState({ destination: "", startDate: "", endDate: "", budget: "", currency: "INR", travelers: "1", interests: DEFAULT_INTERESTS, pace: "Balanced" });
  const [trip, setTrip] = useState(null);
  const [structuredPlan, setStructuredPlan] = useState(null);
  const [itinerary, setItinerary] = useState("");
  const [allocations, setAllocations] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openRouterStatus, setOpenRouterStatus] = useState("checking");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const formRef = useRef(null);
  const promptRef = useRef(null);
  const itineraryRef = useRef(null);
  const totalAllocated = allocations.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  useEffect(() => {
    let active = true;
    fetch("/api/itinerary/status")
      .then((response) => { if (!response.ok) throw new Error("status unavailable"); return response.json(); })
      .then((data) => { if (active) setOpenRouterStatus(data.configured ? "configured" : "missing"); })
      .catch(() => { if (active) setOpenRouterStatus("unavailable"); });
    return () => { active = false; };
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setNotice("");
  }
  function toggleInterest(interest) {
    setForm((current) => ({ ...current, interests: current.interests.includes(interest) ? current.interests.filter((item) => item !== interest) : [...current.interests, interest] }));
  }
  function generateLocal() {
    setNotice(""); setError(""); setStructuredPlan(null);
    const plan = buildItinerary(form, form.budget);
    if (plan.error) { setError(plan.error); return; }
    setTrip({ count: plan.count, source: "local" }); setItinerary(plan.days.join("\n\n"));
    setAllocations(budgetSplit(form.budget, form.pace));
    setNotice(`Local starter itinerary created for ${plan.count} day${plan.count === 1 ? "" : "s"}.`);
  }
  async function buildWithOpenRouter(event) {
    event.preventDefault();
    if (!formRef.current?.reportValidity()) return;
    setNotice(""); setError("");
    const plan = buildItinerary(form, form.budget);
    if (plan.error) { setError(plan.error); return; }
    if (openRouterStatus !== "configured") {
      setError(openRouterStatus === "missing"
        ? "OpenRouter is not configured. Add OPENROUTER_API_KEY to the ignored .env file and restart Express. Your local draft still works."
        : "OpenRouter status is unavailable. Start or restart Express, then retry. Your local draft still works.");
      return;
    }
    setIsGeneratingAI(true);
    setNotice("Asking the selected free Gemma model for a structured itinerary…");
    try {
      const response = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: form.destination,
          startDate: form.startDate,
          endDate: form.endDate,
          budget: Number(form.budget),
          currency: form.currency,
          travelers: form.travelers ? Number(form.travelers) : 1,
          interests: form.interests,
          pace: form.pace,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Gemma could not create a plan. Retry or build a local draft.");
      if (!result.itinerary || !Array.isArray(result.itinerary.days)) throw new Error("The model returned an incomplete plan. Retry to request a fresh itinerary.");
      const modelPlan = result.itinerary;
      const categoryAmounts = [modelPlan.budgetSummary.lodging, modelPlan.budgetSummary.food, modelPlan.budgetSummary.localTransport, modelPlan.budgetSummary.activities, modelPlan.budgetSummary.buffer];
      setStructuredPlan(modelPlan);
      setTrip({ count: plan.count, source: "openrouter" });
      setItinerary(formatStructuredPlan(modelPlan, form.currency));
      setAllocations(CATEGORIES.map((label, index) => ({ label, amount: categoryAmounts[index] })));
      setNotice("Gemma itinerary ready. Venue details and all costs are estimates; verify before booking.");
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? "The itinerary server could not be reached. Check that Express is running, then retry."
        : requestError.message || "The free Gemma model is temporarily unavailable. Retry later or build a local draft.");
      setNotice("");
    } finally {
      setIsGeneratingAI(false);
    }
  }
  function updateAllocation(index, value) { setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: value } : item)); }
  async function copyText(value, successMessage, fallbackRef = promptRef) {
    try { await navigator.clipboard.writeText(value); setNotice(successMessage); }
    catch { if (fallbackRef.current) { fallbackRef.current.focus(); fallbackRef.current.select(); } setNotice("Clipboard is unavailable. The text is selected; copy it with Ctrl+C or ⌘C."); }
  }
  function handoff() {
    if (!itinerary.trim()) { setNotice("Create a starter itinerary before opening the ChatGPT handoff."); return; }
    const prompt = makePrompt(form, itinerary, allocations, form.budget);
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
    copyText(prompt, "Prompt copied. Paste it into ChatGPT to refine the starter itinerary.");
  }
  function clearPlanner() { setTrip(null); setStructuredPlan(null); setItinerary(""); setAllocations([]); setError(""); setNotice("Planner cleared."); }

  return (
    <section className="travel-planner" id="travel-planner" aria-labelledby="travel-heading">
      <div className="travel-shell section-shell">
        <div className="travel-topline"><p className="eyebrow"><span>06</span> AI TRAVEL PLANNER</p><span className="travel-local mono"><i /> GEMMA 4 FREE / LOCAL OPTION</span></div>
        <div className="travel-heading"><div><span className="travel-edition mono">FIELD TOOL / 003</span><h2 id="travel-heading">Go with<br /><em>a plan.</em></h2></div><p>Turn your dates, budget, and interests into a useful first draft. You stay in control of the details and the spend.</p></div>
        <div className="travel-workspace">
          <form ref={formRef} className="travel-form" onSubmit={buildWithOpenRouter}>
            <div className="travel-panel-title"><span className="mono">01 / YOUR TRIP</span><span className="travel-panel-rule" /><span className="mono">PLAN THE INPUT</span></div>
            <label className="travel-field travel-field--wide"><span>Where are you going? <b>REQUIRED</b></span><input name="destination" value={form.destination} onChange={updateField} placeholder="City, region, or country" required /></label>
            <div className="travel-field-pair"><label className="travel-field"><span>Start date <b>REQUIRED</b></span><input type="date" name="startDate" value={form.startDate} onChange={updateField} required /></label><label className="travel-field"><span>End date <b>REQUIRED</b></span><input type="date" name="endDate" value={form.endDate} onChange={updateField} min={form.startDate || undefined} required /></label></div>
            <div className="travel-field-pair travel-field-pair--budget"><label className="travel-field"><span>Total trip budget <b>REQUIRED</b></span><input type="number" name="budget" min="1" step="1" value={form.budget} onChange={updateField} placeholder="e.g. 45000" required /></label><label className="travel-field"><span>Currency</span><select name="currency" value={form.currency} onChange={updateField}><option value="INR">INR · ₹</option><option value="USD">USD · $</option><option value="EUR">EUR · €</option><option value="GBP">GBP · £</option><option value="AED">AED</option><option value="CAD">CAD</option><option value="AUD">AUD</option><option value="JPY">JPY · ¥</option></select></label></div>
            <div className="travel-field-pair"><label className="travel-field"><span>Travelers <b>OPTIONAL</b></span><input type="number" name="travelers" min="1" max="12" step="1" value={form.travelers} onChange={updateField} /></label><label className="travel-field"><span>Trip pace</span><select name="pace" value={form.pace} onChange={updateField}><option>Relaxed</option><option>Balanced</option><option>Full</option></select></label></div>
            <fieldset className="travel-interests"><legend>What do you enjoy? <small>SELECT ANY</small></legend><div className="travel-interest-options">{INTERESTS.map((interest) => <label className={form.interests.includes(interest) ? "is-selected" : ""} key={interest}><input type="checkbox" checked={form.interests.includes(interest)} onChange={() => toggleInterest(interest)} /><span>{interest}</span></label>)}</div></fieldset>
            <div className="travel-form-actions travel-form-actions--agents">
              <button className="travel-submit" type="submit" disabled={isGeneratingAI || openRouterStatus === "checking"} aria-busy={isGeneratingAI}>
                {isGeneratingAI ? "BUILDING ITINERARY…" : error ? "RETRY WITH GEMMA ↗" : "BUILD STARTER ITINERARY ↗"}
              </button>
              <button className="travel-local-action" type="button" onClick={generateLocal} disabled={isGeneratingAI}>BUILD LOCAL DRAFT</button>
              <button className="travel-reset" type="button" onClick={clearPlanner} disabled={isGeneratingAI}>CLEAR</button>
            </div>
            <p className="travel-ai-disclosure">Only clicking <strong>Build Starter Itinerary</strong> sends your destination, dates, budget, currency, travelers, pace, and interests to OpenRouter. The server requests <code>google/gemma-4-26b-a4b-it:free</code> only; it does not switch to a paid model. Prices and schedules are estimates, not live travel data.</p>
            {openRouterStatus === "missing" && <p className="travel-provider-config" role="status">OpenRouter is not configured. Add <code>OPENROUTER_API_KEY</code> to the ignored <code>.env</code> file and restart Express. Build Local Draft remains available.</p>}
            {openRouterStatus === "unavailable" && <p className="travel-provider-config" role="status">OpenRouter configuration could not be checked. Start or restart Express; local planning remains available.</p>}
            {openRouterStatus === "checking" && <p className="travel-provider-config" role="status">Checking server configuration…</p>}
            {notice && <p className="travel-status mono" role="status" aria-live="polite">{notice}</p>}
            {error && <p className="travel-error travel-error--provider" role="alert">{error}</p>}
          </form>
          <div className="travel-results" aria-live="polite">
            <div className="travel-results-head"><span className="mono">02 / ITINERARY DESK</span><span className="travel-results-state mono">{trip ? `${trip.source === "openrouter" ? "GEMMA 4 FREE" : "LOCAL"} · ${trip.count} DAYS / EDITABLE` : "WAITING FOR A TRIP"}</span></div>
            {!trip ? <div className="travel-empty"><span aria-hidden="true">✳</span><p className="mono">YOUR FIRST DRAFT STARTS HERE</p><p>Build a structured Gemma itinerary or use the local planning fallback.</p></div> : <>
              <div className="travel-result-destination"><span className="mono">STARTER PLAN / {form.pace.toUpperCase()} PACE</span><h3>{form.destination}</h3><p>{form.startDate} — {form.endDate} · {form.travelers || 1} traveler(s) · {money(form.budget, form.currency)} total</p></div>
              {structuredPlan && <>
                <p className="travel-plan-summary">{structuredPlan.summary}</p>
                <div className={`travel-budget-flag travel-budget-flag--${structuredPlan.budgetStatus}`}><strong>{structuredPlan.budgetStatus === "within_budget" ? "BUDGET ESTIMATE" : structuredPlan.budgetStatus === "likely_unrealistic" ? "BUDGET MAY BE UNREALISTIC" : "ABOVE THE ENTERED BUDGET"}</strong><p>{structuredPlan.budgetNote}</p><span>Estimated total · {money(structuredPlan.budgetSummary.estimatedTotal, form.currency)} / {money(structuredPlan.budgetSummary.requestedTotal, form.currency)}</span></div>
                <div className="travel-day-list">{structuredPlan.days.map((day, index) => <article className="travel-day-card" key={day.date}>
                  <div className="travel-day-card-head"><span className="mono">DAY {String(index + 1).padStart(2, "0")} / {day.date}</span><h4>{day.title}</h4></div>
                  <div className="travel-day-items"><h5>Activities &amp; attractions <small>ESTIMATES / PER PERSON</small></h5>{day.activities.map((activity, itemIndex) => <div className="travel-day-item" key={`${activity.period}-${itemIndex}`}><span>{activity.period}</span><p><strong>{activity.place}</strong> — {activity.suggestion}</p><b>{money(activity.estimatedCost, form.currency)}</b></div>)}</div>
                  <div className="travel-day-items"><h5>Meal suggestions <small>ESTIMATES / PER PERSON</small></h5>{day.meals.map((meal) => <div className="travel-day-item" key={meal.meal}><span>{meal.meal}</span><p>{meal.suggestion}</p><b>{money(meal.estimatedCost, form.currency)}</b></div>)}</div>
                  <p className="travel-day-estimate">Meals + activities per person estimate <strong>{money(day.dayEstimate, form.currency)}</strong></p>
                </article>)}</div>
                <ul className="travel-caveats">{structuredPlan.caveats.map((note, index) => <li key={index}>{note}</li>)}</ul>
              </>}
              <label className="travel-itinerary-label" htmlFor="travel-itinerary">{structuredPlan ? "COPY / EDIT ITINERARY TEXT" : "DAY-BY-DAY STARTER"} <small>EDITABLE TEXT</small></label>
              <textarea ref={itineraryRef} id="travel-itinerary" className="travel-itinerary" value={itinerary} onChange={(event) => setItinerary(event.target.value)} rows={Math.max(12, trip.count * 5)} />
              <div className="travel-budget"><div className="travel-budget-heading"><h4>Budget allocation</h4><span className="mono">EDIT THE AMOUNTS</span></div>
                {allocations.map((item, index) => <label className="travel-budget-row" key={item.label}><span>{item.label}</span><div><span>{form.currency}</span><input aria-label={`${item.label} budget amount`} type="number" min="0" step="1" value={item.amount} onChange={(event) => updateAllocation(index, event.target.value)} /></div></label>)}
                <div className={`travel-budget-total${totalAllocated > Number(form.budget) ? " is-over" : ""}`}><span>Allocated · {totalAllocated > Number(form.budget) ? "over budget" : `${money(Math.max(Number(form.budget) - totalAllocated, 0), form.currency)} unassigned`}</span><strong>{money(totalAllocated, form.currency)}</strong></div>
              </div>
              <label className="travel-prompt-label" htmlFor="travel-prompt">CHATGPT HANDOFF PROMPT <small>OPTIONAL / MANUAL</small></label>
              <textarea ref={promptRef} id="travel-prompt" className="travel-prompt" readOnly value={makePrompt(form, itinerary, allocations, form.budget)} onFocus={(event) => event.target.select()} />
              <div className="travel-result-actions"><button type="button" className="travel-copy" onClick={() => copyText(itinerary, "Starter itinerary copied.", itineraryRef)}>COPY ITINERARY</button><button type="button" className="travel-handoff" onClick={handoff}>COPY PROMPT &amp; OPEN CHATGPT ↗</button></div>
              <p className="travel-manual-note">This opens ChatGPT separately and copies a prompt for you to paste. It does not access your signed-in account or send anything automatically.</p>
            </>}
          </div>
        </div>
        <div className="travel-disclaimer"><span>TRAVEL ESTIMATES</span><span className="travel-disclaimer-rule" /><p>The model does not look up live prices, schedules, opening hours, availability, routes, weather, or visa rules. Treat every place and cost as a suggestion, then verify current details with reliable local sources before booking.</p></div>
      </div>
    </section>
  );
}
