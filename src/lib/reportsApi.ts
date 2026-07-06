import { supabase } from "./supabase";
import { formatNaira, koboToNaira } from "./currency";

export interface ReportData {
  from: string;
  to: string;
  // Revenue
  feesCollected: number;
  salesRevenue: number;
  totalRevenue: number;
  salesProfit: number;
  // Expenses
  totalExpenses: number;
  expenseByCategory: { name: string; amount: number }[];
  // Fees
  feesExpected: number;
  outstandingFees: number;
  collectionRate: number;
  // Net
  netProfit: number;
  // Raw rows for CSV
  feePaymentRows: FeePaymentRow[];
  saleRows: SaleRow[];
  expenseRows: ExpenseRow[];
  // Student summary
  studentCount: number;
  studentsWithDebt: number;
}

export interface FeePaymentRow {
  date: string;
  student: string;
  class: string;
  fee_type: string;
  term: string;
  session: string;
  amount_paid: number;
  method: string;
}

export interface SaleRow {
  date: string;
  item: string;
  buyer: string;
  quantity: number;
  amount: number;
  profit: number;
}

export interface ExpenseRow {
  date: string;
  category: string;
  description: string;
  amount: number;
  recurring: boolean;
}

export async function fetchReportData(
  from: string,
  to: string,
): Promise<ReportData> {
  const [
    feesRes,
    salesRes,
    expensesRes,
    structuresRes,
    studentsRes,
    allPaymentsRes,
  ] = await Promise.all([
    supabase
      .from("fee_payments")
      .select(
        "amount_paid, method, date, students(name, class), fee_structures(fee_type, amount, term, session, class)",
      )
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false }),
    supabase
      .from("sales")
      .select(
        "amount, quantity, date, buyer_name, inventory_items(name, cost_price, selling_price)",
      )
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false }),
    supabase
      .from("expenses")
      .select("amount, date, description, recurring, expense_categories(name)")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false }),
    supabase.from("fee_structures").select("amount, class"),
    supabase.from("students").select("id, class").eq("status", "active"),
    supabase.from("fee_payments").select("student_id, amount_paid"),
  ]);

  // ── Fee payments ────────────────────────────────────────────────────────────
  type FeeRow = {
    amount_paid: number;
    method: string;
    date: string;
    students: { name: string; class: string } | null;
    fee_structures: {
      fee_type: string;
      amount: number;
      term: string;
      session: string;
      class: string;
    } | null;
  };
  const feeRows = (feesRes.data ?? []) as unknown as FeeRow[];
  const feesCollected = feeRows.reduce((s, r) => s + r.amount_paid, 0);

  const feePaymentRows: FeePaymentRow[] = feeRows.map((r) => ({
    date: r.date,
    student: r.students?.name ?? "—",
    class: r.students?.class ?? r.fee_structures?.class ?? "—",
    fee_type: r.fee_structures?.fee_type ?? "—",
    term: r.fee_structures?.term ?? "—",
    session: r.fee_structures?.session ?? "—",
    amount_paid: r.amount_paid,
    method: r.method,
  }));

  // ── Sales ───────────────────────────────────────────────────────────────────
  type SaleRaw = {
    amount: number;
    quantity: number;
    date: string;
    buyer_name: string;
    inventory_items: {
      name: string;
      cost_price: number;
      selling_price: number;
    } | null;
  };
  const saleRaws = (salesRes.data ?? []) as unknown as SaleRaw[];
  const salesRevenue = saleRaws.reduce((s, r) => s + r.amount, 0);
  const salesProfit = saleRaws.reduce((s, r) => {
    if (!r.inventory_items) return s;
    return (
      s +
      (r.inventory_items.selling_price - r.inventory_items.cost_price) *
        r.quantity
    );
  }, 0);

  const saleRows: SaleRow[] = saleRaws.map((r) => ({
    date: r.date,
    item: r.inventory_items?.name ?? "—",
    buyer: r.buyer_name,
    quantity: r.quantity,
    amount: r.amount,
    profit: r.inventory_items
      ? (r.inventory_items.selling_price - r.inventory_items.cost_price) *
        r.quantity
      : 0,
  }));

  // ── Expenses ────────────────────────────────────────────────────────────────
  type ExpRaw = {
    amount: number;
    date: string;
    description: string;
    recurring: boolean;
    expense_categories: { name: string } | null;
  };
  const expRaws = (expensesRes.data ?? []) as unknown as ExpRaw[];
  const totalExpenses = expRaws.reduce((s, r) => s + r.amount, 0);

  const catMap = new Map<string, number>();
  for (const r of expRaws) {
    const name = r.expense_categories?.name ?? "Uncategorised";
    catMap.set(name, (catMap.get(name) ?? 0) + r.amount);
  }
  const expenseByCategory = Array.from(catMap.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const expenseRows: ExpenseRow[] = expRaws.map((r) => ({
    date: r.date,
    category: r.expense_categories?.name ?? "Uncategorised",
    description: r.description,
    amount: r.amount,
    recurring: r.recurring,
  }));

  // ── Fee expected / outstanding ──────────────────────────────────────────────
  type FeeStructureRow = { amount: number; class: string };
  type StudentRow = { id: string; class: string };
  type PaymentSummaryRow = { student_id: string; amount_paid: number };

  const structures = (structuresRes.data ?? []) as FeeStructureRow[];
  const students = (studentsRes.data ?? []) as StudentRow[];
  const allPayments = (allPaymentsRes.data ?? []) as PaymentSummaryRow[];

  const feesExpected = structures.reduce((sum, row) => sum + row.amount, 0);
  const outstandingFees = Math.max(0, feesExpected - feesCollected);
  const collectionRate =
    feesExpected > 0 ? Math.min(100, (feesCollected / feesExpected) * 100) : 0;

  // ── Students with debt ──────────────────────────────────────────────────────
  const studentsWithDebt = students.filter((student) => {
    const expected = structures
      .filter((structure) => structure.class === student.class)
      .reduce((sum, structure) => sum + structure.amount, 0);
    const paid = allPayments
      .filter((payment) => payment.student_id === student.id)
      .reduce((sum, payment) => sum + payment.amount_paid, 0);
    return expected - paid > 0;
  }).length;

  return {
    from,
    to,
    feesCollected,
    salesRevenue,
    totalRevenue: feesCollected + salesRevenue,
    salesProfit,
    totalExpenses,
    expenseByCategory,
    feesExpected,
    outstandingFees,
    collectionRate,
    netProfit: feesCollected + salesRevenue - totalExpenses,
    feePaymentRows,
    saleRows,
    expenseRows,
    studentCount: students.length,
    studentsWithDebt,
  };
}

// ── CSV helpers ───────────────────────────────────────────────────────────────
function toCSV(headers: string[], rows: string[][]): string {
  return [headers, ...rows]
    .map((r) =>
      r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportFeesCSV(rows: FeePaymentRow[], from: string, to: string) {
  const csv = toCSV(
    [
      "Date",
      "Student",
      "Class",
      "Fee Type",
      "Term",
      "Session",
      "Amount Paid (₦)",
      "Method",
    ],
    rows.map((r) => [
      r.date,
      r.student,
      r.class,
      r.fee_type,
      r.term,
      r.session,
      String(koboToNaira(r.amount_paid)),
      r.method,
    ]),
  );
  downloadCSV(`fees_${from}_to_${to}.csv`, csv);
}

export function exportSalesCSV(rows: SaleRow[], from: string, to: string) {
  const csv = toCSV(
    ["Date", "Item", "Buyer", "Quantity", "Amount (₦)", "Profit (₦)"],
    rows.map((r) => [
      r.date,
      r.item,
      r.buyer,
      String(r.quantity),
      String(koboToNaira(r.amount)),
      String(koboToNaira(r.profit)),
    ]),
  );
  downloadCSV(`sales_${from}_to_${to}.csv`, csv);
}

export function exportExpensesCSV(
  rows: ExpenseRow[],
  from: string,
  to: string,
) {
  const csv = toCSV(
    ["Date", "Category", "Description", "Amount (₦)", "Recurring"],
    rows.map((r) => [
      r.date,
      r.category,
      r.description,
      String(koboToNaira(r.amount)),
      r.recurring ? "Yes" : "No",
    ]),
  );
  downloadCSV(`expenses_${from}_to_${to}.csv`, csv);
}

export function exportSummaryCSV(data: ReportData) {
  const lines = [
    ["Moredays Manager — Summary Report"],
    [`Period: ${data.from} to ${data.to}`],
    [],
    ["REVENUE"],
    ["Fees Collected", formatNaira(data.feesCollected)],
    ["Sales Revenue", formatNaira(data.salesRevenue)],
    ["Total Revenue", formatNaira(data.totalRevenue)],
    [],
    ["EXPENSES"],
    ["Total Expenses", formatNaira(data.totalExpenses)],
    ...data.expenseByCategory.map((e) => [
      `  ${e.name}`,
      formatNaira(e.amount),
    ]),
    [],
    ["NET PROFIT / LOSS", formatNaira(data.netProfit)],
    [],
    ["FEES"],
    ["Expected", formatNaira(data.feesExpected)],
    ["Collected", formatNaira(data.feesCollected)],
    ["Outstanding", formatNaira(data.outstandingFees)],
    ["Collection Rate", `${data.collectionRate.toFixed(1)}%`],
  ];
  const csv = lines.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  downloadCSV(`summary_report_${data.from}_to_${data.to}.csv`, csv);
}
