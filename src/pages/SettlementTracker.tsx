import { useState, useMemo } from "react";
import { useAllSettlements, useSettleTransaction } from "@/hooks/useSettlements";
import { useMonth } from "@/contexts/MonthContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMonths } from "@/hooks/useMonths";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Search, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DbTransaction } from "@/hooks/useTransactions";
import { TruncatedTxId } from "@/components/TruncatedTxId";

function getAgingDays(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function AgingBadge({ days }: { days: number }) {
  if (days > 60) return <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-expense-bg text-expense">🔴 {days}d Overdue</span>;
  if (days > 30) return <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-withdraw-bg text-withdraw">🟠 {days}d Aging</span>;
  return <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-income-bg text-income">🟡 {days}d</span>;
}

function SettleDialog({ transaction, onClose }: { transaction: DbTransaction; onClose: () => void }) {
  const [settledAmount, setSettledAmount] = useState<string>(String(transaction.amount));
  const settle = useSettleTransaction();
  const { selectedMonthId } = useMonth();

  const difference = transaction.amount - (parseFloat(settledAmount) || 0);

  const handleSettle = () => {
    if (!selectedMonthId) return;
    settle.mutate(
      {
        transaction,
        settledAmount: parseFloat(settledAmount) || 0,
        currentMonthId: selectedMonthId,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Settle Income</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground text-xs block">Person</span>
              <span className="font-medium">{transaction.person}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Earned</span>
              <span className="font-medium text-income">{formatCurrency(transaction.amount)}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Source</span>
              <span className="font-medium">{transaction.source_type ?? "Unknown"}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Tx ID</span>
              <TruncatedTxId value={transaction.transaction_id} maxLen={8} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settled-amount" className="text-sm font-medium">Actual Settled Amount (Crypto Received)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="settled-amount"
              type="number"
              step="0.01"
              value={settledAmount}
              onChange={e => setSettledAmount(e.target.value)}
              className="pl-7"
              placeholder="0.00"
            />
          </div>
        </div>

        {Math.abs(difference) > 0.01 && (
          <div className={cn(
            "rounded-md border p-3 text-sm animate-in fade-in zoom-in-95 duration-200",
            difference > 0 ? "border-expense/20 bg-expense-bg/50 text-expense-foreground" : "border-income/20 bg-income-bg/50 text-income-foreground"
          )}>
            <div className="flex items-center justify-between font-medium mb-1">
              <span>Adjustment Required</span>
              <span>{formatCurrency(-difference)}</span>
            </div>
            <p className="text-xs opacity-90 leading-relaxed">
              A "Settlement Adjustment" transaction will be automatically created to account for this difference.
            </p>
          </div>
        )}

        <div className="flex items-start gap-2 text-muted-foreground bg-muted/20 p-2 rounded text-xs">
          <span className="mt-0.5">ℹ️</span>
          <p>
            Revenue is recognized immediately when earned. Treasury is reconciled when settled.
            Any difference is absorbed by the income owner.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSettle} className="flex-1" disabled={settle.isPending || !selectedMonthId}>
            {settle.isPending ? "Settling..." : "Confirm Settlement"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

export default function SettlementTracker() {
  const { data: allSettlements = [], isLoading } = useAllSettlements();
  const { data: months = [] } = useMonths();
  const { role, wallet: userWallet } = useAuth();

  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [walletFilter, setWalletFilter] = useState<string>("all");
  const [personFilter, setPersonFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [settleTarget, setSettleTarget] = useState<DbTransaction | null>(null);

  const canSettle = (t: DbTransaction) => {
    if (t.settlement_status !== "Pending") return false;
    if (role === "admin") return true;
    if (role === "team_leader" && userWallet === t.team) return true;
    return false;
  };

  // Only show original income transactions (not adjustments)
  const settlements = useMemo(() => {
    let data = allSettlements.filter(t => t.type !== "Settlement Adjustment");
    if (filter === "pending") data = data.filter(t => t.settlement_status === "Pending");
    if (walletFilter !== "all") data = data.filter(t => t.team === walletFilter);
    if (personFilter !== "all") data = data.filter(t => t.person === personFilter);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(t =>
        t.person.toLowerCase().includes(q) ||
        t.note.toLowerCase().includes(q) ||
        t.transaction_id.toLowerCase().includes(q)
      );
    }
    return data;
  }, [allSettlements, filter, walletFilter, personFilter, search]);

  const wallets = useMemo(() => [...new Set(allSettlements.map(t => t.team))].sort(), [allSettlements]);
  const persons = useMemo(() => [...new Set(allSettlements.filter(t => t.type !== "Settlement Adjustment").map(t => t.person))].sort(), [allSettlements]);

  const monthNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    months.forEach(m => { map[m.id] = m.name; });
    return map;
  }, [months]);

  const pendingTotal = allSettlements.filter(t => t.settlement_status === "Pending" && t.type !== "Settlement Adjustment").reduce((s, t) => s + t.amount, 0);
  const pendingCount = allSettlements.filter(t => t.settlement_status === "Pending" && t.type !== "Settlement Adjustment").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Settlement Tracker</h2>
        <p className="text-sm text-muted-foreground">Track pending income settlements and reconcile crypto receipts</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Pending Amount</p>
          <p className="text-lg font-semibold text-income tabular-nums">{formatCurrency(pendingTotal)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Pending Count</p>
          <p className="text-lg font-semibold text-foreground tabular-nums">{pendingCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Oldest Pending</p>
          <p className="text-lg font-semibold text-foreground tabular-nums">
            {pendingCount > 0
              ? (() => {
                  const oldest = allSettlements
                    .filter(t => t.settlement_status === "Pending" && t.type !== "Settlement Adjustment")
                    .sort((a, b) => a.date.localeCompare(b.date))[0];
                  return oldest ? `${getAgingDays(oldest.date)}d ago` : "—";
                })()
              : "—"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="h-8 rounded-md border bg-card pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value as any)} className="h-8 rounded-md border bg-card px-2 text-sm text-foreground outline-none">
          <option value="pending">Pending Only</option>
          <option value="all">Show All</option>
        </select>
        <select value={walletFilter} onChange={e => setWalletFilter(e.target.value)} className="h-8 rounded-md border bg-card px-2 text-sm text-foreground outline-none">
          <option value="all">All Wallets</option>
          {wallets.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <select value={personFilter} onChange={e => setPersonFilter(e.target.value)} className="h-8 rounded-md border bg-card px-2 text-sm text-foreground outline-none">
          <option value="all">All Persons</option>
          {persons.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading settlements…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Wallet</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Earned</th>
                <th className="px-4 py-3">Earned Month</th>
                <th className="px-4 py-3 text-right">Settled</th>
                <th className="px-4 py-3 text-right">Difference</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aging</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {settlements.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No settlements found.</td></tr>
              ) : settlements.map(t => {
                const days = getAgingDays(t.date);
                const diff = t.settled_amount != null ? t.amount - t.settled_amount : null;
                return (
                  <tr key={t.id} className={cn(
                    "border-b last:border-0 transition-colors hover:bg-muted/40",
                    t.settlement_status === "Pending" && days > 60 && "bg-expense-bg/30",
                    t.settlement_status === "Pending" && days > 30 && days <= 60 && "bg-withdraw-bg/30",
                  )}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{t.person}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">{t.team}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.source_type ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-income font-medium">{formatCurrency(t.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.month_id ? monthNameMap[t.month_id] ?? "—" : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {t.settled_amount != null ? formatCurrency(t.settled_amount) : "—"}
                    </td>
                    <td className={cn("px-4 py-2.5 text-right tabular-nums font-medium",
                      diff != null && diff > 0 && "text-expense",
                      diff != null && diff < 0 && "text-income",
                    )}>
                      {diff != null ? formatCurrency(-diff) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.settlement_status === "Processing" ? (
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground animate-pulse">
                          <Clock className="h-3 w-3 animate-spin" /> Processing…
                        </span>
                      ) : t.settlement_status === "Pending" ? (
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-withdraw-bg text-withdraw">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-income-bg text-income">
                          <CheckCircle2 className="h-3 w-3" /> Settled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.settlement_status === "Pending" ? <AgingBadge days={days} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {canSettle(t) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => setSettleTarget(t)}
                          disabled={t.settlement_status === "Processing"}
                        >
                          {t.settlement_status === "Processing" ? "Processing…" : "Settle"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Settle dialog */}
      <Dialog open={!!settleTarget} onOpenChange={v => { if (!v) setSettleTarget(null); }}>
        {settleTarget && <SettleDialog transaction={settleTarget} onClose={() => setSettleTarget(null)} />}
      </Dialog>
    </div>
  );
}
