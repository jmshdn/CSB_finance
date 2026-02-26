import { transactions as initialTransactions, type Transaction } from "./transactions";
import { TEAMS } from "./months";

// Extended transaction with new fields
export interface ExtendedTransaction extends Transaction {
  transactionId: string;
  linkedWallet?: string;
  createdBy?: string;
  createdAt?: string;
  category?: string;
}

// Convert initial data to extended format
let nextId = 1;
function generateTxId(): string {
  return `TX${String(nextId++).padStart(6, "0")}`;
}

// Runtime store (in-memory, resets on reload)
const store: ExtendedTransaction[] = initialTransactions.map((t) => ({
  ...t,
  transactionId: generateTxId(),
  linkedWallet:
    t.incomeExpense === "Internal"
      ? t.team === "CSB"
        ? TEAMS.includes(t.person as any)
          ? t.person
          : undefined
        : "CSB"
      : undefined,
}));

// Team person lists
export const TEAM_PERSONS: Record<string, string[]> = {
  CSB: [
    "KRS",
    "JSH",
    "HSJ",
    "RCS",
    "JJS",
    "MDS",
    "JJI",
    "SHN",
    "KSM",
    "STI",
    "PMG",
    "KNI",
    "JGS",
    "KGJ",
    "NSJ",
    "SRH",
    "KCG",
    "RGB",
    "RCJ",
    "YCS",
    "HTR",
    "PBM",
    "Team",
  ],
  AAA: ["KNI", "JJS", "HSJ", "RCJ", "KRS"],
  BBB: ["SHN", "PBM", "RCS", "JJI"],
  CCC: ["KCG", "HTR", "YCS", "MDS", "PMG"],
  DDD: ["JSH", "STI", "NSJ", "RGB"],
  EEE: ["KGJ", "JGS", "KSM", "SRH"],
};

// All persons across all teams (unique, sorted)
export function getAllPersons(): string[] {
  const persons = new Set<string>();
  Object.values(TEAM_PERSONS).forEach((list) =>
    list.forEach((p) => {
      if (p !== "Team") persons.add(p);
    }),
  );
  return Array.from(persons).sort();
}

// Get persons for a specific wallet
export function getWalletPersons(wallet: string): string[] {
  return TEAM_PERSONS[wallet] ?? getAllPersons();
}

// CRUD
export function getTransactions(): ExtendedTransaction[] {
  return [...store];
}

export function getTransactionsByTeam(team: string, monthId: string): ExtendedTransaction[] {
  return store.filter((t) => t.team === team && t.date.startsWith(monthId));
}

// Get CSB wallet transactions for persons belonging to a specific team
export function getCsbTransactionsForTeam(team: string, monthId: string): ExtendedTransaction[] {
  const teamPersons = TEAM_PERSONS[team] ?? [];
  return store.filter((t) => t.team === "CSB" && t.date.startsWith(monthId) && teamPersons.includes(t.person));
}

export function getTransactionsByWallet(monthId: string): ExtendedTransaction[] {
  return store.filter((t) => t.team === "CSB" && t.date.startsWith(monthId));
}

export function isDuplicateTxId(txId: string): boolean {
  return store.some((t) => t.transactionId === txId);
}

export type TransactionType = "Income" | "Expense" | "Internal" | "Withdraw";

export const CATEGORIES = [
  "US Job",
  "AS Job",
  "EU Job",
  "LATAM Job",
  "Proxy extension",
  "VPS purchase",
  "Bidder pay",
  "Freelancer Income",
  "Native support",
  "Developer pay",
  "Phone (open phone, krisp, etc)",
  "Payment creation (Wise, bank, paypal, etc)",
  "Headquarter",
] as const;

export type TransactionCategory = (typeof CATEGORIES)[number];

export interface AddTransactionInput {
  date: string;
  type: TransactionType;
  person: string;
  note: string;
  amount: number;
  transactionId: string;
  wallet: string;
  linkedWallet?: string;
  category: string;
}

// Validation
export function validateTransaction(input: AddTransactionInput): string | null {
  if (!input.date) return "Date is required";
  if (!input.type) return "Type is required";
  if (!input.category) return "Category is required";
  if (input.type !== "Internal" && input.type !== "Withdraw" && !input.person) return "Person is required";
  if (input.amount === 0) return "Amount cannot be zero";
  if (!input.transactionId || input.transactionId.length < 6) return "Transaction ID must be at least 6 characters";
  if (isDuplicateTxId(input.transactionId)) return "Transaction ID already exists";

  if (input.type === "Income" && input.amount < 0) return "Income must be positive";
  if (input.type === "Expense" && input.amount > 0) return "Expense must be negative";
  if (input.type === "Withdraw" && input.amount > 0) return "Withdraw must be negative";
  if (input.type === "Withdraw" && input.wallet !== "CSB") return "Withdraw is only allowed for CSB Wallet";
  if (input.type === "Internal" && !input.linkedWallet) return "Internal transfers require a destination wallet";

  return null;
}

// Add transaction (with mirroring for internal)
export function addTransaction(input: AddTransactionInput): { success: boolean; error?: string } {
  const error = validateTransaction(input);
  if (error) return { success: false, error };

  const incomeExpense = input.type === "Withdraw" ? ("Expense" as const) : (input.type as Transaction["incomeExpense"]);

  const tx: ExtendedTransaction = {
    date: input.date,
    team: input.wallet,
    incomeExpense,
    type: input.type === "Withdraw" ? "Withdraw" : input.type === "Internal" ? "Internal" : input.type,
    person: input.person,
    note: input.note,
    amount: input.amount,
    transactionId: input.transactionId,
    linkedWallet: input.linkedWallet,
    createdBy: input.wallet,
    createdAt: new Date().toISOString(),
    category: input.category,
  };

  store.push(tx);

  // Mirror internal transfers
  if (input.type === "Internal" && input.linkedWallet) {
    const mirrorTx: ExtendedTransaction = {
      date: input.date,
      team: input.linkedWallet,
      incomeExpense: "Internal",
      type: "Internal",
      person: input.wallet === "CSB" ? input.linkedWallet : input.wallet,
      note: `${input.amount > 0 ? "Received from" : "Transfer to"} ${input.wallet === "CSB" ? "CSB Wallet" : input.wallet}`,
      amount: -input.amount, // mirror
      transactionId: input.transactionId,
      linkedWallet: input.wallet,
      createdBy: input.wallet,
      createdAt: new Date().toISOString(),
    };
    store.push(mirrorTx);
  }

  return { success: true };
}

// Delete transaction (and its mirror if internal)
export function deleteTransaction(transactionId: string, wallet: string): boolean {
  const idx = store.findIndex((t) => t.transactionId === transactionId && t.team === wallet);
  if (idx === -1) return false;

  const tx = store[idx];
  // Remove main
  store.splice(idx, 1);

  // Remove mirror if internal
  if (tx.incomeExpense === "Internal" && tx.linkedWallet) {
    const mirrorIdx = store.findIndex((t) => t.transactionId === transactionId && t.team === tx.linkedWallet);
    if (mirrorIdx !== -1) store.splice(mirrorIdx, 1);
  }

  return true;
}
