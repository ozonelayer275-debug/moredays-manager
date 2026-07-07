import { supabase } from "./supabase";
import type { Database } from "../types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];
type FeeStructure = Database["public"]["Tables"]["fee_structures"]["Row"];
type FeePayment = Database["public"]["Tables"]["fee_payments"]["Row"];

// ── Students ──────────────────────────────────────────────────────────────────

export async function fetchStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}

export async function addStudent(
  s: Database["public"]["Tables"]["students"]["Insert"],
) {
  const { data, error } = await supabase
    .from("students")
    .insert(s)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStudent(
  id: string,
  s: Database["public"]["Tables"]["students"]["Update"],
) {
  const { data, error } = await supabase
    .from("students")
    .update(s)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteStudent(id: string) {
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchStudentById(id: string): Promise<Student> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// ── Fee Structures ────────────────────────────────────────────────────────────

export async function fetchFeeStructures(): Promise<FeeStructure[]> {
  const { data, error } = await supabase
    .from("fee_structures")
    .select("*")
    .order("session", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchFeeStructuresForClass(
  cls: string,
): Promise<FeeStructure[]> {
  const { data, error } = await supabase
    .from("fee_structures")
    .select("*")
    .eq("class", cls)
    .order("session", { ascending: false });
  if (error) throw error;
  return data;
}

export async function addFeeStructure(
  f: Database["public"]["Tables"]["fee_structures"]["Insert"],
) {
  const { data, error } = await supabase
    .from("fee_structures")
    .insert(f)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFeeStructure(
  id: string,
  f: Database["public"]["Tables"]["fee_structures"]["Update"],
) {
  const { data, error } = await supabase
    .from("fee_structures")
    .update(f)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFeeStructure(id: string) {
  const { error } = await supabase.from("fee_structures").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchDistinctFeeTypes(): Promise<string[]> {
  const { data, error } = await supabase
    .from("fee_structures")
    .select("fee_type")
  if (error) throw error;
  const rows = (data ?? []) as Pick<FeeStructure, 'fee_type'>[]
  return [...new Set(rows.map(r => r.fee_type))]
}

// ── Fee Payments ──────────────────────────────────────────────────────────────

export type PaymentWithStructure = FeePayment & {
  fee_structures: Pick<
    FeeStructure,
    "fee_type" | "amount" | "term" | "session" | "class"
  >;
};

export async function fetchPaymentsForStudent(
  studentId: string,
): Promise<PaymentWithStructure[]> {
  const { data, error } = await supabase
    .from("fee_payments")
    .select("*, fee_structures(fee_type, amount, term, session, class)")
    .eq("student_id", studentId)
    .order("date", { ascending: false });
  if (error) throw error;
  return data as PaymentWithStructure[];
}

export async function recordFeePayment(
  p: Database["public"]["Tables"]["fee_payments"]["Insert"],
) {
  const { data, error } = await supabase
    .from("fee_payments")
    .insert(p)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFeePayment(id: string) {
  const { error } = await supabase.from("fee_payments").delete().eq("id", id);
  if (error) throw error;
}

// ── Outstanding balances (all students) ──────────────────────────────────────

export interface StudentBalance {
  student: Student;
  totalExpected: number; // kobo — sum of fee structures for their class
  totalPaid: number; // kobo
  balance: number; // kobo (positive = owes money)
}

export async function fetchOutstandingBalances(): Promise<StudentBalance[]> {
  const [studentsRes, structuresRes, paymentsRes] = await Promise.all([
    supabase.from("students").select("*").eq("status", "active").order("name"),
    supabase.from("fee_structures").select("*"),
    supabase.from("fee_payments").select("student_id, amount_paid"),
  ]);
  if (studentsRes.error) throw studentsRes.error;
  if (structuresRes.error) throw structuresRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const structures = (structuresRes.data ?? []) as FeeStructure[];
  const payments = (paymentsRes.data ?? []) as Array<{
    student_id: string;
    amount_paid: number;
  }>;

  return (studentsRes.data ?? []).map((student: Student) => {
    const classStructures = structures.filter(
      (structure) => structure.class === student.class,
    );
    const totalExpected = classStructures.reduce(
      (sum, structure) => sum + structure.amount,
      0,
    );
    const totalPaid = payments
      .filter((payment) => payment.student_id === student.id)
      .reduce((sum, payment) => sum + payment.amount_paid, 0);
    return {
      student,
      totalExpected,
      totalPaid,
      balance: totalExpected - totalPaid,
    };
  });
}
