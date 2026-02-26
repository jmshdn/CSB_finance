/** Application-wide constants */

/** @deprecated Use useTeams() hook for dynamic team list. Kept as fallback seed. */
export const TEAMS = ["AAA", "BBB", "CCC", "DDD", "EEE"] as const;
export type TeamId = (typeof TEAMS)[number];

export const ALL_WALLETS = ["CSB", ...TEAMS] as const;

/** Static team → persons mapping (fallback for AddTransactionDialog) */
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

export function getAllPersons(): string[] {
  const persons = new Set<string>();
  Object.values(TEAM_PERSONS).forEach((list) =>
    list.forEach((p) => {
      if (p !== "Team") persons.add(p);
    }),
  );
  return Array.from(persons).sort();
}

export function getWalletPersons(wallet: string): string[] {
  return TEAM_PERSONS[wallet] ?? getAllPersons();
}

export const INCOME_CATEGORIES = [
  "US Job",
  "AS Job",
  "EU Job",
  "LATAM Job",
  "Freelancer Income",
] as const;

export const EXPENSE_CATEGORIES = [
  "Bidder pay",
  "Native support",
  "Developer pay",
  "Phone (open phone, krisp, etc)",
  "Payment creation (Wise, bank, paypal, etc)",
  "ID card DL & SSN",
  "Drug Test",
  "Tools (VPS, Proxy, Cursor, GPT, etc)",
  "Headquarter",
] as const;

export const CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES] as const;

export type TransactionCategory = (typeof CATEGORIES)[number];
