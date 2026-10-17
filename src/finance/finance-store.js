const KEY = "rashid-finance-ledger-v1";
const VERSION = 1;

const validTransaction = (item) => item && typeof item.id === "string" && typeof item.description === "string" && Number.isFinite(item.amount) && item.amount > 0 && ["income", "expense"].includes(item.type) && typeof item.category === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date);
const validBudget = (item) => item && typeof item.id === "string" && typeof item.category === "string" && Number.isFinite(item.amount) && item.amount > 0 && /^\d{4}-\d{2}$/.test(item.month);

export function normalizeFinanceState(value) {
  if (!value || value.version !== VERSION || !Array.isArray(value.transactions) || !Array.isArray(value.budgets)) return { version: VERSION, transactions: [], budgets: [] };
  return {
    version: VERSION,
    transactions: value.transactions.filter(validTransaction).slice(0, 5000),
    budgets: value.budgets.filter(validBudget).slice(0, 1000),
  };
}

export function loadFinanceState(storage) {
  try {
    storage ??= globalThis.localStorage;
    const source = storage?.getItem(KEY);
    return source ? normalizeFinanceState(JSON.parse(source)) : { version: VERSION, transactions: [], budgets: [] };
  } catch {
    return { version: VERSION, transactions: [], budgets: [] };
  }
}

export function saveFinanceState(state, storage) {
  try {
    storage ??= globalThis.localStorage;
    storage?.setItem(KEY, JSON.stringify(normalizeFinanceState(state)));
    return true;
  } catch {
    return false;
  }
}
