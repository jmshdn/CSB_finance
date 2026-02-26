export interface Transaction {
  date: string;
  team: string;
  incomeExpense: "Income" | "Expense" | "Internal" | "Cash";
  type: string;
  person: string;
  note: string;
  amount: number;
}

// Monthly summary data from Page 1
export interface MonthlySummary {
  month: string;
  income: number;
  expense: number;
  baseFee: number;
  cryptoStart: number;
}

export const monthlySummaries: MonthlySummary[] = [
  { month: "Oct 2025", income: 27288.79, expense: -3934.80, baseFee: -25300.00, cryptoStart: 1289 },
  { month: "Nov 2025", income: 42471.95, expense: -10192.77, baseFee: -29730.00, cryptoStart: 24656 },
  { month: "Dec 2025", income: 51546.80, expense: -9855.25, baseFee: -28750.00, cryptoStart: 27205 },
  { month: "Jan 2026", income: 53304.60, expense: -14152.98, baseFee: -26450.00, cryptoStart: 40157 },
];

// Personal summary from Page 2 header
export interface PersonSummary {
  name: string;
  income: number;
  expense: number;
  revenue: number;
}

export const personSummaries: PersonSummary[] = [
  { name: "KRS", income: 6439.90, expense: -114.47, revenue: 6325.43 },
  { name: "JSH", income: 7989.00, expense: -1695.40, revenue: 6293.60 },
  { name: "HSJ", income: 3818.10, expense: -41.75, revenue: 3776.35 },
  { name: "KCG", income: 4311.00, expense: -553.00, revenue: 3758.00 },
  { name: "RCS", income: 8890.40, expense: -5133.65, revenue: 3756.75 },
  { name: "JJS", income: 3441.80, expense: 0, revenue: 3441.80 },
  { name: "NSJ", income: 3187.50, expense: -441.60, revenue: 2745.90 },
  { name: "MDS", income: 2854.00, expense: -136.00, revenue: 2718.00 },
  { name: "SHN", income: 2980.10, expense: -546.92, revenue: 2433.18 },
  { name: "PBM", income: 2355.50, expense: -119.50, revenue: 2236.00 },
  { name: "KSM", income: 2298.00, expense: -1275.25, revenue: 1022.75 },
  { name: "JJI", income: 974.00, expense: -149.35, revenue: 824.65 },
  { name: "SRH", income: 915.00, expense: -172.00, revenue: 743.00 },
  { name: "HTR", income: 669.00, expense: -85.00, revenue: 584.00 },
  { name: "RCJ", income: 954.00, expense: -473.75, revenue: 480.25 },
  { name: "KNI", income: 339.30, expense: -126.00, revenue: 213.30 },
  { name: "JGS", income: 0, expense: -53.00, revenue: -53.00 },
  { name: "PMG", income: 0, expense: -62.55, revenue: -62.55 },
  { name: "KGJ", income: 0, expense: -78.40, revenue: -78.40 },
  { name: "YCS", income: 0, expense: -124.00, revenue: -124.00 },
  { name: "STI", income: 888.00, expense: -1104.00, revenue: -216.00 },
  { name: "RGB", income: 0, expense: -681.40, revenue: -681.40 },
];

function parseAmount(str: string): number {
  if (!str || str === "$-" || str === "") return 0;
  const cleaned = str.replace(/[$,()]/g, "").trim();
  if (!cleaned) return 0;
  const val = parseFloat(cleaned);
  if (str.includes("(") && str.includes(")")) return -val;
  return val;
}

// All January 2026 transactions from Page 2
export const transactions: Transaction[] = [];

// Helper functions
export function getOperationalTransactions(txns: Transaction[] = transactions) {
  return txns.filter(t => t.incomeExpense !== "Internal" && t.incomeExpense !== "Cash" && t.type !== "Base fee");
}

export function getTeams() {
  return ["AAA", "BBB", "CCC", "DDD", "EEE", "CSB"];
}

export function getTypes() {
  const types = new Set(transactions.map(t => t.type));
  return Array.from(types).sort();
}

export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(abs);
  return amount < 0 ? `(${formatted})` : formatted;
}

export function formatCurrencyShort(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1000) {
    return (amount < 0 ? "-" : "") + "$" + (abs / 1000).toFixed(1) + "k";
  }
  return formatCurrency(amount);
}
