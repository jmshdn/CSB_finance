import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { TruncatedTxId } from "@/components/TruncatedTxId";
import { ExpandableNote } from "@/components/ExpandableNote";
import { TypeBadge } from "@/components/TypeBadge";
import { useScrolledPast } from "@/hooks/useScrolledPast";
import KPICard from "@/components/KPICard";
import StartingBalanceCard from "@/components/StartingBalanceCard";
import AddTransactionDialog from "@/components/AddTransactionDialog";
import { useWalletStartingBalance } from "@/hooks/useWalletStartingBalance";
import { EditTransactionButton, DeleteTransactionButton } from "@/components/TransactionActions";
import { OriginalTransactionDialog } from "@/components/OriginalTransactionDialog";
import { useTeams } from "@/hooks/useTeams";
import { formatCurrency, formatDateOnly, formatDateTime, toSortTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Search, ArrowUpDown, Download, Lock } from "lucide-react";
import { useMonth } from "@/contexts/MonthContext";
import { useTransactionsByWallet, type DbTransaction } from "@/hooks/useTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingSettlements } from "@/hooks/useSettlements";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

type SortKey = "date" | "amount";
type SortDir = "asc" | "desc";

export default function Wallet() {
  const { role } = useAuth();
  const { data: teams = [] } = useTeams();
  const { selectedMonth, selectedMonthId, isCurrentMonthClosed } = useMonth();
  const { data: pendingSettlements = [] } = usePendingSettlements();
  const canAddTransaction = role === "admin";
  const { data: dbTxns = [], isLoading } = useTransactionsByWallet("CSB", selectedMonthId);
  const { startingAmount, carryForwardAmount, realBalance, realBalanceDate, isLoading: startLoading, upsert, isUpserting, upsertRealBalance, isUpsertingReal } = useWalletStartingBalance("CSB", selectedMonthId);

  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLTableRowElement>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    if (highlightId && !isLoading) {
      setHighlightedId(highlightId);
      setSearchParams({}, { replace: true });
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      const timer = setTimeout(() => setHighlightedId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightId, isLoading]);

  const allTxns = useMemo(() => dbTxns.filter(t => t.income_expense !== "Cash"), [dbTxns]);

  const totalStarting = carryForwardAmount + startingAmount;

  const stats = useMemo(() => {
    const totalReceived = allTxns.filter(t => t.income_expense === "Internal" && t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalSent = Math.abs(allTxns.filter(t => t.income_expense === "Internal" && t.amount < 0).reduce((s, t) => s + t.amount, 0));
    const baseFee = Math.abs(allTxns.filter(t => t.type === "Base fee").reduce((s, t) => s + t.amount, 0));
    const teamExpense = Math.abs(allTxns.filter(t => t.income_expense === "Expense" && t.type !== "Base fee" && t.person === "Team").reduce((s, t) => s + t.amount, 0));
    const externalExpense = Math.abs(allTxns.filter(t => t.income_expense === "Expense" && t.type !== "Base fee").reduce((s, t) => s + t.amount, 0));
    const netPosition = totalReceived - totalSent - externalExpense - baseFee;
    const sheetBalance = totalStarting + netPosition;

    // Carry unresolved settlements forward: deduct all pending up to selected month.
    const selectedMonthEndTs = selectedMonth?.end_date
      ? new Date(selectedMonth.end_date).getTime()
      : Number.POSITIVE_INFINITY;
    const pendingNet = pendingSettlements
      .filter((t) => t.team === "CSB" && new Date(t.date).getTime() <= selectedMonthEndTs)
      .reduce((s, t) => s + t.amount, 0);
    const actualSheetBalance = sheetBalance - pendingNet;

    return { totalReceived, totalSent, baseFee, teamExpense, externalExpense, netPosition, sheetBalance, actualSheetBalance };
  }, [allTxns, pendingSettlements, selectedMonth?.end_date, totalStarting]);

  const breakdown = useMemo(() => {
    const internalTxns = allTxns.filter(t => t.income_expense === "Internal");
    const result: Record<string, { sent: number; received: number }> = {};
    for (const team of teams) {
      const sent = Math.abs(internalTxns.filter(t => t.person === team && t.amount < 0).reduce((s, t) => s + t.amount, 0));
      const received = internalTxns.filter(t => (t.person === team || t.note.includes(team)) && t.amount > 0).reduce((s, t) => s + t.amount, 0);
      result[team] = { sent, received };
    }
    return result;
  }, [allTxns, teams]);

  const filtered = useMemo(() => {
    let data = [...allTxns];
    if (typeFilter === "income") data = data.filter(t => t.income_expense === "Income");
    else if (typeFilter === "expense") data = data.filter(t => t.income_expense === "Expense" && t.type !== "Withdraw");
    else if (typeFilter === "internal") data = data.filter(t => t.income_expense === "Internal");
    else if (typeFilter === "withdraw") data = data.filter(t => t.type === "Withdraw");
    else if (typeFilter === "basefee") data = data.filter(t => t.type === "Base fee");
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
  }, [allTxns, typeFilter, search, sortKey, sortDir]);

  const txIdCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of allTxns) {
      counts[t.transaction_id] = (counts[t.transaction_id] || 0) + 1;
    }
    return counts;
  }, [allTxns]);

  const chartData = teams.map(team => ({
    team,
    sent: breakdown[team]?.sent ?? 0,
    received: breakdown[team]?.received ?? 0,
  }));

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
    const a = document.createElement("a"); a.href = url; a.download = `CSB-Wallet.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const typeBadge = (t: DbTransaction) => <TypeBadge transaction={t} />;

  const noop = () => {};

  const { ref: addBtnRef, scrolledPast: showFab } = useScrolledPast();

   return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">CSB Wallet</h2>
          <p className="text-sm text-muted-foreground">Master treasury — {selectedMonth?.name ?? "Select month"}</p>
        </div>
        <div className="flex items-center gap-2">
          {isCurrentMonthClosed && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Lock className="h-3 w-3" /> Month Closed
            </span>
          )}
          <div ref={addBtnRef}>
            {!isCurrentMonthClosed && canAddTransaction && <AddTransactionDialog wallet="CSB" onAdded={noop} />}
          </div>
          <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      {!isCurrentMonthClosed && canAddTransaction && showFab && (
        <div className="fixed bottom-6 left-6 z-50 animate-scale-in">
          <AddTransactionDialog wallet="CSB" onAdded={noop} floating />
        </div>
      )}

      <StartingBalanceCard
        startingAmount={startingAmount}
        carryForwardAmount={carryForwardAmount}
        sheetBalance={stats.sheetBalance}
        actualSheetBalance={stats.actualSheetBalance}
        realBalance={realBalance}
        realBalanceDate={realBalanceDate}
        isLoading={startLoading}
        isClosed={isCurrentMonthClosed}
        isAdmin={role === "admin"}
        onSave={upsert}
        isUpserting={isUpserting}
        onSaveRealBalance={upsertRealBalance}
        isUpsertingReal={isUpsertingReal}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="From Teams" value={formatCurrency(stats.totalReceived)} variant="income" />
        <KPICard label="To Teams" value={formatCurrency(stats.totalSent)} variant="expense" />
        <KPICard label="Base Fee" value={formatCurrency(stats.baseFee)} variant="default" />
        <KPICard label="Team Expense" value={formatCurrency(stats.teamExpense)} variant="expense" />
      </div>

      {stats.sheetBalance < 0 && (
        <div className="rounded-md border border-expense/30 bg-expense-bg p-3 text-sm text-expense">
          ⚠ Warning: CSB Wallet has a negative sheet balance.
        </div>
      )}

      <div className="rounded-lg border bg-card p-5">
        <h3 className="mb-4 text-sm font-medium text-foreground">Team ↔ Wallet Flow</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,90%)" />
            <XAxis dataKey="team" tick={{ fontSize: 12, fill: "hsl(220,10%,46%)" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(220,10%,46%)" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: "hsl(0,0%,100%)", border: "1px solid hsl(220,13%,91%)", borderRadius: 8, fontSize: 12 }} formatter={(value: number) => formatCurrency(value)} />
            <Bar dataKey="received" fill="hsl(152,60%,40%)" radius={[4, 4, 0, 0]} name="Received" />
            <Bar dataKey="sent" fill="hsl(0,65%,50%)" radius={[4, 4, 0, 0]} name="Sent" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ID, note…"
            className="h-8 rounded-md border bg-card pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-8 rounded-md border bg-card px-2 text-sm text-foreground outline-none">
          <option value="all">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="internal">Internal</option>
          <option value="withdraw">Withdraw</option>
          <option value="basefee">Base fee</option>
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
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Note</th>
                <th className="cursor-pointer px-4 py-3 text-right" onClick={() => toggleSort("amount")}>
                  <span className="inline-flex items-center gap-1">Amount <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="px-4 py-3">Tx ID</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No transactions found.</td></tr>
              ) : filtered.map((t) => {
                const isAdj = t.type === "Settlement Adjustment";
                const row = (onClick?: () => void) => (
                <tr key={t.id} ref={t.id === highlightedId ? highlightRef : undefined} className={cn("border-b last:border-0 transition-all hover:bg-muted/40", t.id === highlightedId && "animate-highlight-blink", isAdj && "cursor-pointer")} onClick={onClick}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    <span title={formatDateTime(t.created_at ?? t.date)} className="cursor-help">
                      {formatDateOnly(t.created_at ?? t.date)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{typeBadge(t)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.person || (t.type === "Internal" && t.linked_wallet) || ""}</td>
                  <td className="max-w-[200px] px-4 py-2.5"><ExpandableNote text={t.note} /></td>
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
