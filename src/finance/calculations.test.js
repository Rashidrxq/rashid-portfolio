import test from "node:test";
import assert from "node:assert/strict";
import { calculateFinance, monthlyTrend } from "./calculations.js";
import { normalizeFinanceState } from "./finance-store.js";

test("finance calculations aggregate the selected month and categories", () => {
  const tx = [
    { date: "2026-06-02", type: "income", amount: 5000, category: "Salary" },
    { date: "2026-06-04", type: "expense", amount: 900, category: "Food" },
    { date: "2026-06-08", type: "expense", amount: 1100, category: "Travel" },
    { date: "2026-05-15", type: "income", amount: 2000, category: "Salary" },
  ];
  assert.deepEqual(calculateFinance(tx, "2026-06"), { income: 5000, expenses: 2000, balance: 3000, savings: 3000, savingsRate: 60, categoryTotals: { Food: 900, Travel: 1100 } });
});

test("six-month trend is chronological and includes zero months", () => {
  const result = monthlyTrend([{ date: "2026-06-02", type: "income", amount: 120, category: "Salary" }], "2026-06");
  assert.equal(result.length, 6);
  assert.deepEqual(result.map(item => item.month), ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]);
  assert.equal(result.at(-1).income, 120);
  assert.equal(result[0].income, 0);
});

test("stored state normalizes version and drops invalid entries", () => {
  assert.deepEqual(normalizeFinanceState({ version: 9, transactions: [{ id: "a" }], budgets: [] }), { version: 1, transactions: [], budgets: [] });
  const normalized = normalizeFinanceState({ version: 1, transactions: [{ id: "t", description: "valid", amount: 5, type: "expense", category: "Food", date: "2026-06-01" }, { id: "bad", amount: -2 }], budgets: [] });
  assert.equal(normalized.transactions.length, 1);
});
