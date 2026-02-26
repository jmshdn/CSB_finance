import { useParams, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useMonth } from "@/contexts/MonthContext";
import { useTransactions } from "@/hooks/useTransactions";
import { useTeamPersons, buildPersonToTeamMap } from "@/hooks/useTeamPersons";
import { getTeamColors } from "@/lib/team-colors";
import { useSalarySettings, SALARY_DEFAULTS } from "@/hooks/useSalarySettings";
import { usePreviousMonthDeficits } from "@/hooks/useSalaryData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDateOnly, formatDateTime, toSortTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import KPICard from "@/components/KPICard";
import { TruncatedTxId } from "@/components/TruncatedTxId";
import { TypeBadge } from "@/components/TypeBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, TrendingUp, TrendingDown, DollarSign, Wallet } from "lucide-react";

import { fmt } from "@/lib/format";

export default function PersonDetail() {
  const { personName } = useParams<{ personName: string }>();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(personName ?? "");
  const { selectedMonth, selectedMonthId, months } = useMonth();

  const { data: teamPersons = [] } = useTeamPersons();
  const personToTeam = useMemo(() => buildPersonToTeamMap(teamPersons), [teamPersons]);
  const team = personToTeam.get(decodedName) ?? "Unknown";

  const { data: allTxns = [], isLoading } = useTransactions(selectedMonthId);

  // All transactions involving this person
  const personTxns = useMemo(() => {
    return allTxns
      .filter((t) => t.person === decodedName)
      .sort((a, b) => toSortTimestamp(b.created_at ?? b.date) - toSortTimestamp(a.created_at ?? a.date));
  }, [allTxns, decodedName]);

  // Summary stats
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let internalIn = 0;
    let internalOut = 0;
    let txCount = 0;
    const wallets = new Set<string>();

    for (const t of personTxns) {
      txCount++;
      wallets.add(t.team);
      if (t.type === "Internal" || t.type === "Withdraw") continue;
      if (t.income_expense === "Income") income += t.amount;
      else if (t.income_expense === "Expense") expense += Math.abs(t.amount);
      if (t.income_expense === "Internal") {
        if (t.amount > 0) internalIn += t.amount;
        else internalOut += Math.abs(t.amount);
      }
    }

    return { income, expense, revenue: income - expense, internalIn, internalOut, txCount, wallets: Array.from(wallets) };
  }, [personTxns]);

  // Salary info
  const { data: settings } = useSalarySettings(selectedMonthId);
  const s = settings ?? { ...SALARY_DEFAULTS, month_id: selectedMonthId ?? "" };
  const { data: prevDeficits = [] } = usePreviousMonthDeficits(selectedMonthId, months);
  const prevDeficit = useMemo(() => {
    return prevDeficits.find((d) => d.person === decodedName)?.carry_forward_deficit ?? 0;
  }, [prevDeficits, decodedName]);

  const adjustedRevenue = stats.revenue - s.base_fee_per_person - prevDeficit;

  // Person monthly summaries across months for history
  const { data: monthlySummaries = [] } = useQuery({
    queryKey: ["person_monthly_summaries_history", decodedName],
    enabled: !!decodedName,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("person_monthly_summaries")
        .select("*, months!inner(name, start_date)")
        .eq("person", decodedName)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  // TX ID counts for shared badge
  const txIdCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of personTxns) {
      counts[t.transaction_id] = (counts[t.transaction_id] || 0) + 1;
    }
    return counts;
  }, [personTxns]);

  const typeBadge = (t: typeof personTxns[0]) => <TypeBadge transaction={t} />;

  if (!decodedName) {
    return <p className="text-muted-foreground py-10 text-center">No person specified.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center h-8 w-8 rounded-md border bg-card text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-bold tracking-tight">{decodedName}</h2>
            {(() => {
              const tc = getTeamColors(team);
              return (
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${tc.bg} ${tc.text} ${tc.border}`}>
                  {team}
                </span>
              );
            })()}
          </div>
          <p className="text-sm text-muted-foreground">
            Monthly activity — {selectedMonth?.name ?? "Select month"} · {stats.txCount} transactions across {stats.wallets.length} wallet{stats.wallets.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Income" value={formatCurrency(stats.income)} variant="income" />
        <KPICard label="Expense" value={formatCurrency(stats.expense)} variant="expense" />
        <KPICard label="Revenue" value={formatCurrency(stats.revenue)} variant={stats.revenue >= 0 ? "income" : "expense"} />
        <KPICard label="Adj. Revenue" value={formatCurrency(adjustedRevenue)} variant={adjustedRevenue >= 0 ? "income" : "expense"} />
      </div>

      {/* Salary Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            Salary Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Base Fee</p>
              <p className="font-semibold">{fmt(s.base_fee_per_person)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Prev Deficit</p>
              <p className={cn("font-semibold", prevDeficit > 0 && "text-destructive")}>{fmt(prevDeficit)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Revenue After Fees</p>
              <p className={cn("font-semibold", adjustedRevenue <= 0 && "text-destructive")}>{fmt(adjustedRevenue)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Carry Forward</p>
              <p className={cn("font-semibold", adjustedRevenue < 0 && "text-destructive")}>
                {adjustedRevenue <= 0 ? fmt(Math.abs(adjustedRevenue)) : "0.00"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wallet Breakdown */}
      {stats.wallets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Activity by Wallet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {stats.wallets.map((w) => {
                const wTxns = personTxns.filter((t) => t.team === w && t.type !== "Internal" && t.type !== "Withdraw");
                const wIncome = wTxns.filter((t) => t.income_expense === "Income").reduce((s, t) => s + t.amount, 0);
                const wExpense = wTxns.filter((t) => t.income_expense === "Expense").reduce((s, t) => s + Math.abs(t.amount), 0);
                return (
                  <div key={w} className="rounded-md border p-3 text-sm">
                    <p className="font-medium text-foreground mb-1">{w}</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-income">{formatCurrency(wIncome)}</span>
                      <span className="text-expense">{formatCurrency(wExpense)}</span>
                    </div>
                    <p className={cn("text-xs font-semibold mt-0.5", (wIncome - wExpense) >= 0 ? "text-income" : "text-expense")}>
                      Rev: {formatCurrency(wIncome - wExpense)}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month History (from closed months) */}
      {monthlySummaries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Recent Month History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3 text-right">Income</th>
                    <th className="px-4 py-3 text-right">Expense</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummaries.map((ms: any) => (
                    <tr key={ms.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{ms.months?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-income">{formatCurrency(ms.income)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-expense">{formatCurrency(Math.abs(ms.expense))}</td>
                      <td className={cn("px-4 py-2.5 text-right tabular-nums font-semibold", ms.revenue >= 0 ? "text-income" : "text-expense")}>
                        {formatCurrency(ms.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Wallet</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Note</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Tx ID</th>
                  </tr>
                </thead>
                <tbody>
                  {personTxns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No transactions found.</td>
                    </tr>
                  ) : personTxns.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b last:border-0 transition-colors hover:bg-muted/40 cursor-pointer"
                      onClick={() => navigate(t.team === "CSB" ? `/wallet?highlight=${t.id}` : `/team/${t.team}?highlight=${t.id}`)}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                        <span title={formatDateTime(t.created_at ?? t.date)} className="cursor-help">
                          {formatDateOnly(t.created_at ?? t.date)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium">{t.team}</td>
                      <td className="px-4 py-2.5">{typeBadge(t)}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.category ?? "—"}</td>
                      <td className="max-w-[200px] truncate px-4 py-2.5 text-foreground">{t.note}</td>
                      <td className={cn("whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums", t.amount > 0 && "text-income", t.amount < 0 && "text-expense")}>
                        {formatCurrency(t.amount)}
                      </td>
                      <td className="px-4 py-2.5"><TruncatedTxId value={t.transaction_id} duplicateCount={txIdCounts[t.transaction_id]} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
