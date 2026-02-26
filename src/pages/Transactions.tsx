import { useState, useMemo } from "react";
import { formatCurrency, formatDateOnly, formatDateTime, toSortTimestamp } from "@/lib/format";
import { useTeams } from "@/hooks/useTeams";
import { Search, Download, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMonth } from "@/contexts/MonthContext";
import { useTransactions, type DbTransaction } from "@/hooks/useTransactions";

type SortKey = "date" | "amount";
type SortDir = "asc" | "desc";



export default function Transactions() {
  const { selectedMonth, selectedMonthId } = useMonth();
  const { data: allTxns = [], isLoading } = useTransactions(selectedMonthId);
  const { data: teams = [] } = useTeams();
  const ALL_TEAMS = ["CSB", ...teams];

  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [flowFilter, setFlowFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const types = useMemo(() => {
    const set = new Set(allTxns.map(t => t.type));
    return Array.from(set).sort();
  }, [allTxns]);

  const filtered = useMemo(() => {
    let data = [...allTxns];

    if (teamFilter !== "all") data = data.filter(t => t.team === teamFilter);
    if (typeFilter !== "all") data = data.filter(t => t.type === typeFilter);
    if (flowFilter === "income") data = data.filter(t => t.income_expense === "Income");
    else if (flowFilter === "expense") data = data.filter(t => t.income_expense === "Expense");
    else if (flowFilter === "internal") data = data.filter(t => t.income_expense === "Internal");

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(t =>
        t.note.toLowerCase().includes(q) ||
        t.person.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        t.team.toLowerCase().includes(q)
      );
    }

    data.sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "date") {
        return mul * (toSortTimestamp(a.created_at ?? a.date) - toSortTimestamp(b.created_at ?? b.date));
      }
      return mul * (a.amount - b.amount);
    });

    return data;
  }, [allTxns, search, teamFilter, typeFilter, flowFilter, sortKey, sortDir]);

  const totalAmount = filtered.reduce((s, t) => s + t.amount, 0);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const exportCSV = () => {
    const header = "DateTime,Team,Type,Category,Person,Note,Amount\n";
    const rows = filtered.map(t =>
      `${formatDateTime(t.created_at ?? t.date)},${t.team},${t.income_expense},${t.type},${t.person},"${t.note}",${t.amount}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `transactions.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const activeFilters = [teamFilter, typeFilter, flowFilter].filter(f => f !== "all").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Transactions</h2>
          <p className="text-sm text-muted-foreground">
            {selectedMonth?.name ?? "Select month"} · {filtered.length} transactions · Net: <span className={cn(totalAmount >= 0 ? "text-income" : "text-expense", "font-medium")}>{formatCurrency(totalAmount)}</span>
            {activeFilters > 0 && <span className="ml-2 text-xs text-internal">({activeFilters} filter{activeFilters > 1 ? "s" : ""} active)</span>}
          </p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes, people…"
            className="h-8 rounded-md border bg-card pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring" />
        </div>
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className="h-8 rounded-md border bg-card px-2 text-sm text-foreground outline-none">
          <option value="all">All Teams</option>
          {ALL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-8 rounded-md border bg-card px-2 text-sm text-foreground outline-none">
          <option value="all">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={flowFilter} onChange={e => setFlowFilter(e.target.value)} className="h-8 rounded-md border bg-card px-2 text-sm text-foreground outline-none">
          <option value="all">All Flows</option>
          <option value="income">Money In</option>
          <option value="expense">Money Out</option>
          <option value="internal">Internal</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading transactions…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("date")}>
                  <span className="inline-flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Note</th>
                <th className="cursor-pointer px-4 py-3 text-right" onClick={() => toggleSort("amount")}>
                  <span className="inline-flex items-center gap-1">Amount <ArrowUpDown className="h-3 w-3" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No transactions found.</td></tr>
              ) : filtered.map((t) => (
                <tr key={t.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    <span title={formatDateTime(t.created_at ?? t.date)} className="cursor-help">
                      {formatDateOnly(t.created_at ?? t.date)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">{t.team}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn(
                      "rounded px-1.5 py-0.5 text-xs font-medium",
                      t.income_expense === "Income" && "bg-income-bg text-income",
                      t.income_expense === "Expense" && "bg-expense-bg text-expense",
                      t.income_expense === "Internal" && "bg-internal-bg text-internal",
                    )}>
                      {t.income_expense}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.category ?? t.type}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.person}</td>
                  <td className="max-w-[240px] truncate px-4 py-2.5 text-foreground">{t.note}</td>
                  <td className={cn(
                    "whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums",
                    t.amount > 0 && "text-income",
                    t.amount < 0 && "text-expense",
                    t.amount === 0 && "text-muted-foreground",
                  )}>
                    {formatCurrency(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
