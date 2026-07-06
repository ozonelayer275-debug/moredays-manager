import { supabase } from "./supabase";

export type Period = "month" | "term" | "year";

function dateRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: fmt(from), to: fmt(to) };
  }
  if (period === "year") {
    return {
      from: `${now.getFullYear()}-01-01`,
      to: `${now.getFullYear()}-12-31`,
    };
  }
  // term: current calendar quarter as proxy
  const q = Math.floor(now.getMonth() / 3);
  const from = new Date(now.getFullYear(), q * 3, 1);
  const to = new Date(now.getFullYear(), q * 3 + 3, 0);
  return { from: fmt(from), to: fmt(to) };
}

export interface DashboardData {
  period: Period;
  from: string;
  to: string;
  // Revenue
  feesCollected: number; // kobo
  salesRevenue: number; // kobo
  totalRevenue: number; // kobo
  // Expenses
  totalExpenses: number; // kobo
  expenseByCategory: { name: string; amount: number }[];
  // Fees
  feesExpected: number; // kobo
  outstandingFees: number; // kobo
  collectionRate: number; // 0–100
  // Profit
  netProfit: number; // kobo
  // Trend (last 6 months)
  trend: { month: string; revenue: number; expenses: number }[];
  // Insights raw data
  topExpenseCategory: { name: string; amount: number } | null;
  classWithHighestDebt: { class: string; amount: number } | null;
  salesProfit: number; // kobo
}

export async function fetchDashboardData(
  period: Period,
): Promise<DashboardData> {
  const { from, to } = dateRange(period);

  const [
    feesRes,
    salesRes,
    expensesRes,
    feeStructuresRes,
    trendFeesRes,
    trendSalesRes,
    trendExpensesRes,
    debtByClassRes,
  ] = await Promise.all([
    // Fees collected in period
    supabase
      .from("fee_payments")
      .select("amount_paid")
      .gte("date", from)
      .lte("date", to),

    // Sales in period
    supabase
      .from("sales")
      .select("amount, quantity, inventory_items(cost_price, selling_price)")
      .gte("date", from)
      .lte("date", to),

    // Expenses in period with category name
    supabase
      .from("expenses")
      .select("amount, expense_categories(name)")
      .gte("date", from)
      .lte("date", to),

    // All fee structures (to compute expected fees)
    supabase.from("fee_structures").select("amount, class"),

    // Trend: fees last 6 months
    supabase
      .from("fee_payments")
      .select("amount_paid, date")
      .gte("date", sixMonthsAgo()),

    // Trend: sales last 6 months
    supabase.from("sales").select("amount, date").gte("date", sixMonthsAgo()),

    // Trend: expenses last 6 months
    supabase
      .from("expenses")
      .select("amount, date")
      .gte("date", sixMonthsAgo()),

    // Outstanding by class: join fee_payments → fee_structures → students
    supabase
      .from("fee_payments")
      .select("amount_paid, fee_structures(amount, class)"),
  ]);

  // ── Fees collected ──────────────────────────────────────────────────────────
  type FeePaymentRow = { amount_paid: number };
  const feePaymentRows = (feesRes.data ?? []) as FeePaymentRow[];
  const feesCollected = feePaymentRows.reduce(
    (sum, row) => sum + row.amount_paid,
    0,
  );

  // ── Sales revenue + profit ──────────────────────────────────────────────────
  type SaleRow = {
    amount: number;
    quantity: number;
    inventory_items: { cost_price: number; selling_price: number } | null;
  };
  const salesRows = (salesRes.data ?? []) as unknown as SaleRow[];
  const salesRevenue = salesRows.reduce((s, r) => s + r.amount, 0);
  const salesProfit = salesRows.reduce((s, r) => {
    if (!r.inventory_items) return s;
    return (
      s +
      (r.inventory_items.selling_price - r.inventory_items.cost_price) *
        r.quantity
    );
  }, 0);

  // ── Expenses by category ────────────────────────────────────────────────────
  type ExpRow = { amount: number; expense_categories: { name: string } | null };
  const expRows = (expensesRes.data ?? []) as unknown as ExpRow[];
  const totalExpenses = expRows.reduce((s, r) => s + r.amount, 0);

  const catMap = new Map<string, number>();
  for (const r of expRows) {
    const name = r.expense_categories?.name ?? "Uncategorised";
    catMap.set(name, (catMap.get(name) ?? 0) + r.amount);
  }
  const expenseByCategory = Array.from(catMap.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const topExpenseCategory = expenseByCategory[0] ?? null;

  // ── Fees expected (sum of all fee structures — simple proxy) ────────────────
  type FeeStructureRow = { amount: number };
  const feeStructureRows = (feeStructuresRes.data ?? []) as FeeStructureRow[];
  const feesExpected = feeStructureRows.reduce(
    (sum, row) => sum + row.amount,
    0,
  );
  const outstandingFees = Math.max(0, feesExpected - feesCollected);
  const collectionRate =
    feesExpected > 0 ? Math.min(100, (feesCollected / feesExpected) * 100) : 0;

  // ── Class with highest debt ─────────────────────────────────────────────────
  type PayRow = {
    amount_paid: number;
    fee_structures: { amount: number; class: string } | null;
  };
  const payRows = (debtByClassRes.data ?? []) as unknown as PayRow[];
  const classDebt = new Map<string, { expected: number; paid: number }>();
  for (const r of payRows) {
    if (!r.fee_structures) continue;
    const cls = r.fee_structures.class;
    const cur = classDebt.get(cls) ?? { expected: 0, paid: 0 };
    classDebt.set(cls, {
      expected: cur.expected + r.fee_structures.amount,
      paid: cur.paid + r.amount_paid,
    });
  }
  let classWithHighestDebt: { class: string; amount: number } | null = null;
  for (const [cls, { expected, paid }] of classDebt.entries()) {
    const debt = expected - paid;
    if (
      debt > 0 &&
      (!classWithHighestDebt || debt > classWithHighestDebt.amount)
    ) {
      classWithHighestDebt = { class: cls, amount: debt };
    }
  }

  // ── Trend (last 6 months) ───────────────────────────────────────────────────
  const trend = buildTrend(
    (trendFeesRes.data ?? []) as { amount_paid: number; date: string }[],
    (trendSalesRes.data ?? []) as { amount: number; date: string }[],
    (trendExpensesRes.data ?? []) as { amount: number; date: string }[],
  );

  return {
    period,
    from,
    to,
    feesCollected,
    salesRevenue,
    totalRevenue: feesCollected + salesRevenue,
    totalExpenses,
    expenseByCategory,
    feesExpected,
    outstandingFees,
    collectionRate,
    netProfit: feesCollected + salesRevenue - totalExpenses,
    trend,
    topExpenseCategory,
    classWithHighestDebt,
    salesProfit,
  };
}

function sixMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 5);
  d.setDate(1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function buildTrend(
  fees: { amount_paid: number; date: string }[],
  sales: { amount: number; date: string }[],
  expenses: { amount: number; date: string }[],
) {
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }

  return months.map((m) => {
    const rev =
      fees
        .filter((r) => r.date.startsWith(m))
        .reduce((s, r) => s + r.amount_paid, 0) +
      sales
        .filter((r) => r.date.startsWith(m))
        .reduce((s, r) => s + r.amount, 0);
    const exp = expenses
      .filter((r) => r.date.startsWith(m))
      .reduce((s, r) => s + r.amount, 0);
    const label = new Date(m + "-01").toLocaleDateString("en-NG", {
      month: "short",
    });
    return { month: label, revenue: rev / 100, expenses: exp / 100 };
  });
}
