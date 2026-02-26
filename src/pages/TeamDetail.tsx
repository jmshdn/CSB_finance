import { useParams, Navigate, useSearchParams } from "react-router-dom";
import { TruncatedTxId } from "@/components/TruncatedTxId";
import { TypeBadge } from "@/components/TypeBadge";
import { useMemo, useState, useEffect, useRef } from "react";
import { useScrolledPast } from "@/hooks/useScrolledPast";
import AddTransactionDialog from "@/components/AddTransactionDialog";
import { EditTransactionButton, DeleteTransactionButton } from "@/components/TransactionActions";
import { OriginalTransactionDialog } from "@/components/OriginalTransactionDialog";
import { formatCurrency, formatDateOnly, formatDateTime, toSortTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Search, Download, ArrowUpDown, Lock, Pencil, Check, X } from "lucide-react";
import { useMonth } from "@/contexts/MonthContext";
import { useTransactionsByWallet, type DbTransaction } from "@/hooks/useTransactions";
import { useWalletStartingBalance } from "@/hooks/useWalletStartingBalance";
import { useAuth } from "@/contexts/AuthContext";

type SortKey = "date" | "amount";
type SortDir = "asc" | "desc";

export default function TeamDetail() {
  const { teamId } = useParams<{ teamId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role, wallet: userWallet } = useAuth();
  const { selectedMonth, selectedMonthId, isCurrentMonthClosed } = useMonth();
  const canAddTransaction = role === "admin" || (role === "team_leader" && userWallet === teamId);
  const { data: dbTxns = [], isLoading } = useTransactionsByWallet(teamId ?? "", selectedMonthId);
  const {
    startingAmount,
    carryForwardAmount,
    realBalance,
    realBalanceDate,
    isLoading: balanceLoading,
    upsertRealBalance,
    isUpsertingReal,
  } = useWalletStartingBalance(teamId ?? "", selectedMonthId ?? undefined);

  const [search, setSearch] = useState("");
  const [personFilter, setPersonFilter] = useState("all");
  const [flowFilter, setFlowFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editingReal, setEditingReal] = useState(false);
  const [realInput, setRealInput] = useState("");

  const highlightId = searchParams.get("highlight");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (highlightId && !isLoading) {
      setHighlightedId(highlightId);
      // Clear the query param
      setSearchParams({}, { replace: true });
      // Scroll into view after render
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      // Clear highlight after 3s
      const timer = setTimeout(() => setHighlightedId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightId, isLoading, setSearchParams]);

  const allTxns = useMemo(() => dbTxns.filter(t => t.income_expense !== "Cash"), [dbTxns]);

  const sheetBalance = useMemo(() => {
    const net = allTxns.reduce((s, t) => s + t.amount, 0);
    return carryForwardAmount + startingAmount + net;
  }, [allTxns, carryForwardAmount, startingAmount]);
  const balanceDiff = realBalance != null ? realBalance - sheetBalance : null;

  const persons = useMemo(() => {
    const set = new Set(allTxns.map(t => t.person).filter(p => p !== "Internal" && p !== "All" && p !== "Team"));
    return Array.from(set).sort();
  }, [allTxns]);

  const filtered = useMemo(() => {
    let data = [...allTxns];
    if (personFilter !== "all") data = data.filter(t => t.person === personFilter);
    if (flowFilter === "income") data = data.filter(t => t.income_expense === "Income");
    else if (flowFilter === "expense") data = data.filter(t => t.income_expense === "Expense");
    else if (flowFilter === "internal") data = data.filter(t => t.income_expense === "Internal");
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(t =>
        t.note.toLowerCase().includes(q) || t.person.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) || t.transaction_id.toLowerCase().includes(q)
      );
    }
    data.sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      return sortKey === "date"
        ? mul * (toSortTimestamp(a.created_at ?? a.date) - toSortTimestamp(b.created_at ?? b.date))
        : mul * (a.amount - b.amount);
    });
    return data;
  }, [allTxns, personFilter, flowFilter, search, sortKey, sortDir]);

  const txIdCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of allTxns) {
      counts[t.transaction_id] = (counts[t.transaction_id] || 0) + 1;
    }
    return counts;
  }, [allTxns]);

  if (!teamId) return <Navigate to="/" replace />;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const exportCSV = () => {
    const header = "DateTime,Type,Category,Person,Note,Amount,TransactionID,LinkedWallet\n";
    const rows = filtered.map(t =>
      `${formatDateTime(t.created_at ?? t.date)},${t.income_expense},${t.type},${t.person},"${t.note}",${t.amount},${t.transaction_id},${t.linked_wallet ?? ""}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${teamId}-wallet.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const typeBadge = (t: DbTransaction) => <TypeBadge transaction={t} />;

  const noop = () => {};

  const { ref: addBtnRef, scrolledPast: showFab } = useScrolledPast();

  const handleEditReal = () => {
    setRealInput(realBalance != null ? String(realBalance) : "");
    setEditingReal(true);
  };

  const handleSaveReal = () => {
    const value = parseFloat(realInput);
    if (isNaN(value)) return;
    upsertRealBalance(value);
    setEditingReal(false);
  };

  const walletValueClass = "mt-1 text-lg font-bold tabular-nums";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{teamId} Wallet</h2>
          <p className="text-sm text-muted-foreground">
            Wallet balance & activity — {selectedMonth?.name ?? "Select month"} · {allTxns.length} transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCurrentMonthClosed && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Lock className="h-3 w-3" /> Month Closed
            </span>
          )}
          <div ref={addBtnRef}>
            {!isCurrentMonthClosed && canAddTransaction && <AddTransactionDialog wallet={teamId!} onAdded={noop} />}
          </div>
          <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      {!isCurrentMonthClosed && canAddTransaction && showFab && (
        <div className="fixed bottom-6 left-6 z-50 animate-scale-in">
          <AddTransactionDialog wallet={teamId!} onAdded={noop} floating />
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Sheet Balance
          </p>
          <p className={cn(walletValueClass, sheetBalance >= 0 ? "text-income" : "text-expense")}>
            {formatCurrency(sheetBalance)}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Real Balance
            </p>
            {!isCurrentMonthClosed && role === "admin" && !editingReal && (
              <button
                onClick={handleEditReal}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Set real balance"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {balanceLoading ? (
            <p className={cn(walletValueClass, "text-muted-foreground")}>...</p>
          ) : editingReal ? (
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                type="number"
                value={realInput}
                onChange={(e) => setRealInput(e.target.value)}
                className="h-8 w-full rounded-md border bg-background px-2 text-sm tabular-nums outline-none focus:ring-1 focus:ring-ring"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveReal();
                  if (e.key === "Escape") setEditingReal(false);
                }}
              />
              <button onClick={handleSaveReal} disabled={isUpsertingReal} className="rounded p-1.5 text-income transition-colors hover:bg-income/10">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => setEditingReal(false)} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : realBalance != null ? (
            <>
              <p className={cn(walletValueClass, "text-foreground")}>
                {formatCurrency(realBalance)}
              </p>
              {realBalanceDate && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Recorded: {realBalanceDate}
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Not set</p>
          )}
        </div>

        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Difference
          </p>
          {balanceDiff != null ? (
            <>
              <p className={cn(walletValueClass, balanceDiff === 0 ? "text-muted-foreground" : balanceDiff > 0 ? "text-income" : "text-expense")}>
                {balanceDiff === 0 ? "—" : formatCurrency(balanceDiff)}
              </p>
              {balanceDiff !== 0 && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">Real - Sheet</p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">—</p>
          )}
        </div>
      </div>

      <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground">
        📋 This page tracks wallet balance and activity only. For team performance statistics, see the <a href={`/team-performance/${teamId}`} className="font-medium text-foreground underline underline-offset-2 hover:text-primary">Team Performance</a> page.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="h-8 rounded-md border bg-card pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring" />
        </div>
        <select value={personFilter} onChange={e => setPersonFilter(e.target.value)} className="h-8 rounded-md border bg-card px-2 text-sm text-foreground outline-none">
          <option value="all">All People</option>
          {persons.map(p => <option key={p} value={p}>{p}</option>)}
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
                <th className="cursor-pointer px-4 py-3" onClick={() => toggleSort("date")}><span className="inline-flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></span></th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Note</th>
                <th className="cursor-pointer px-4 py-3 text-right" onClick={() => toggleSort("amount")}><span className="inline-flex items-center gap-1">Amount <ArrowUpDown className="h-3 w-3" /></span></th>
                <th className="px-4 py-3">Tx ID</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No transactions found.</td></tr>
              ) : filtered.map((t) => {
                const isAdj = t.type === "Settlement Adjustment";
                const row = (onClick?: () => void) => (
                <tr
                  key={t.id}
                  ref={t.id === highlightedId ? highlightRef : undefined}
                   className={cn(
                    "border-b last:border-0 transition-all duration-700 hover:bg-muted/40",
                    t.id === highlightedId && "animate-highlight-blink",
                    isAdj && "cursor-pointer"
                   )}
                  onClick={onClick}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    <span title={formatDateTime(t.created_at ?? t.date)} className="cursor-help">
                      {formatDateOnly(t.created_at ?? t.date)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{typeBadge(t)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.person}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.category ?? "—"}</td>
                  <td className="max-w-[200px] truncate px-4 py-2.5 text-foreground">{t.note}</td>
                  <td className={cn("whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums", t.amount > 0 && "text-income", t.amount < 0 && "text-expense")}>{formatCurrency(t.amount)}</td>
                  <td className="px-4 py-2.5"><TruncatedTxId value={t.transaction_id} duplicateCount={txIdCounts[t.transaction_id]} /></td>
                  <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-0.5">
                      <EditTransactionButton transaction={t} disabled={isCurrentMonthClosed} />
                      <DeleteTransactionButton transaction={t} disabled={isCurrentMonthClosed} />
                    </div>
                  </td>
                </tr>
                );
                return isAdj ? (
                  <OriginalTransactionDialog key={t.id} originalTransactionId={t.original_transaction_id}>
                    {(onClick) => row(onClick)}
                  </OriginalTransactionDialog>
                ) : row();
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
