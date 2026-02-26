import { transactions, type Transaction } from "./transactions";

export interface MonthConfig {
  id: string; // e.g. "2026-01"
  label: string; // e.g. "January 2026"
  shortLabel: string; // e.g. "Jan 2026"
  locked: boolean;
  carryForwardBalance: number;
}

export const TEAMS = ["AAA", "BBB", "CCC", "DDD", "EEE"] as const;
export type TeamId = (typeof TEAMS)[number];

export const months: MonthConfig[] = [
  { id: "2026-01", label: "January 2026", shortLabel: "Jan 2026", locked: true, carryForwardBalance: 40157 },
  { id: "2026-02", label: "February 2026", shortLabel: "Feb 2026", locked: false, carryForwardBalance: 0 },
];

// Get transactions for a specific month
export function getMonthTransactions(monthId: string): Transaction[] {
  return transactions.filter(t => t.date.startsWith(monthId));
}

// Get team transactions for a specific month
export function getTeamMonthTransactions(teamId: string, monthId: string): Transaction[] {
  return getMonthTransactions(monthId).filter(t => t.team === teamId);
}

// Get CSB wallet transactions for a specific month
export function getWalletMonthTransactions(monthId: string): Transaction[] {
  return getMonthTransactions(monthId).filter(t => t.team === "CSB");
}

// Calculate team stats
export interface TeamMonthStats {
  income: number;
  expense: number;
  net: number;
  internal: number;
  txCount: number;
  linkedToWallet: number; // amount transferred to CSB
}

export function calcTeamStats(teamId: string, monthId: string): TeamMonthStats {
  const txns = getTeamMonthTransactions(teamId, monthId);
  const ops = txns.filter(t => t.incomeExpense !== "Cash");
  const income = ops.filter(t => t.incomeExpense === "Income").reduce((s, t) => s + t.amount, 0);
  const expense = ops.filter(t => t.incomeExpense === "Expense").reduce((s, t) => s + t.amount, 0);
  const internal = ops.filter(t => t.incomeExpense === "Internal").reduce((s, t) => s + t.amount, 0);
  const linkedToWallet = ops
    .filter(t => t.incomeExpense === "Internal" && t.amount < 0)
    .reduce((s, t) => s + t.amount, 0);

  return {
    income,
    expense: Math.abs(expense),
    net: income + expense,
    internal,
    txCount: ops.length,
    linkedToWallet: Math.abs(linkedToWallet),
  };
}

// Calculate wallet stats
export interface WalletStats {
  totalReceived: number; // from teams
  totalSent: number; // to teams
  externalExpense: number;
  baseFee: number;
  netPosition: number;
  balanceBroughtForward: number;
  endingBalance: number;
}

export function calcWalletStats(monthId: string): WalletStats {
  const txns = getWalletMonthTransactions(monthId);
  const month = months.find(m => m.id === monthId);
  const balanceBroughtForward = month?.carryForwardBalance ?? 0;

  const totalReceived = txns
    .filter(t => t.incomeExpense === "Internal" && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);

  const totalSent = Math.abs(
    txns
      .filter(t => t.incomeExpense === "Internal" && t.amount < 0)
      .reduce((s, t) => s + t.amount, 0)
  );

  const baseFee = Math.abs(
    txns.filter(t => t.type === "Base fee").reduce((s, t) => s + t.amount, 0)
  );

  const externalExpense = Math.abs(
    txns
      .filter(t => t.incomeExpense === "Expense" && t.type !== "Base fee")
      .reduce((s, t) => s + t.amount, 0)
  );

  const netPosition = totalReceived - totalSent - externalExpense - baseFee;
  const endingBalance = balanceBroughtForward + netPosition;

  return { totalReceived, totalSent, externalExpense, baseFee, netPosition, balanceBroughtForward, endingBalance };
}

// Get persons for a team in a month
export function getTeamPersons(teamId: string, monthId: string): string[] {
  const txns = getTeamMonthTransactions(teamId, monthId);
  const persons = new Set(txns.map(t => t.person).filter(p => p !== "Internal" && p !== "All" && p !== "Team"));
  return Array.from(persons).sort();
}

// Wallet: get amounts sent/received per team
export function getWalletTeamBreakdown(monthId: string) {
  const txns = getWalletMonthTransactions(monthId).filter(t => t.incomeExpense === "Internal");
  const breakdown: Record<string, { sent: number; received: number }> = {};

  for (const team of TEAMS) {
    const sent = Math.abs(
      txns.filter(t => t.person === team && t.amount < 0).reduce((s, t) => s + t.amount, 0)
    );
    const received = txns
      .filter(t => (t.person === team || t.note.includes(team)) && t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);
    breakdown[team] = { sent, received };
  }

  return breakdown;
}
