export function calculateFinance(transactions, month) {
  const inMonth = transactions.filter((item) => item.date.startsWith(month));
  const income = inMonth.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = inMonth.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const categoryTotals = inMonth.filter((item) => item.type === "expense").reduce((totals, item) => {
    totals[item.category] = (totals[item.category] || 0) + item.amount;
    return totals;
  }, {});
  return { income, expenses, balance: income - expenses, savings: income - expenses, savingsRate: income ? ((income - expenses) / income) * 100 : 0, categoryTotals };
}

export function monthlyTrend(transactions, currentMonth) {
  const [year, month] = currentMonth.split("-").map(Number);
  return Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(year, month - 1 - (5 - offset), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const totals = calculateFinance(transactions, key);
    return { month: key, label: date.toLocaleDateString(undefined, { month: "short" }), income: totals.income, expenses: totals.expenses };
  });
}
