import { useMemo } from "react";
import { Link } from "react-router-dom";
import KPICard from "@/components/KPICard";
import KPICardSkeleton from "@/components/KPICardSkeleton";
import { usePendingSettlements } from "@/hooks/useSettlements";
import FinanceReport from "@/components/FinanceReport";
import QuickAddCTA from "@/components/QuickAddCTA";
import { TeamPerformanceChart, DistributionCharts, MonthlyComparisonChart } from "@/components/DashboardCharts";
import { formatCurrency } from "@/lib/format";
import { useTeams } from "@/hooks/useTeams";
import { cn } from "@/lib/utils";
import { useMonth } from "@/contexts/MonthContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactions } from "@/hooks/useTransactions";
import { useTeamPersons, buildTeamToPersonsMap } from "@/hooks/useTeamPersons";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";

export default function Overview() {
  const { selectedMonth, selectedMonthId } = useMonth();
  const { role } = useAuth();
  const { data: allTxns = [], isLoading } = useTransactions(selectedMonthId);
  const { data: teamPersons = [] } = useTeamPersons();
  const { data: rawTeams = [] } = useTeams();
  const teams = rawTeams as string[];
  const { data: pendingSettlements = [] } = usePendingSettlements();
  const { data: monthlyAnalytics = [] } = useAnalyticsData();

  const teamToPersons = useMemo(() => buildTeamToPersonsMap(teamPersons), [teamPersons]);

  const stats = useMemo(() => {
    const ops = allTxns.filter(t => t.income_expense !== "Cash");
    const income = ops.filter(t => t.income_expense === "Income").reduce((s, t) => s + t.amount, 0);
    const expense = ops.filter(t => t.income_expense === "Expense").reduce((s, t) => s + t.amount, 0);
    const baseFee = ops.filter(t => t.type === "Base fee").reduce((s, t) => s + t.amount, 0);
    const teamExpense = Math.abs(ops.filter(t => t.income_expense === "Expense" && t.type !== "Base fee" && t.person === "Team").reduce((s, t) => s + t.amount, 0));
    return { income, expense, baseFee, teamExpense, net: income + expense };
  }, [allTxns]);

  const walletEndingBalance = useMemo(() => {
    const csbTxns = allTxns.filter(t => t.team === "CSB" && t.income_expense !== "Cash");
    const totalReceived = csbTxns.filter(t => t.income_expense === "Internal" && t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalSent = Math.abs(csbTxns.filter(t => t.income_expense === "Internal" && t.amount < 0).reduce((s, t) => s + t.amount, 0));
    const baseFee = Math.abs(csbTxns.filter(t => t.type === "Base fee").reduce((s, t) => s + t.amount, 0));
    const externalExpense = Math.abs(csbTxns.filter(t => t.income_expense === "Expense" && t.type !== "Base fee").reduce((s, t) => s + t.amount, 0));
    const balanceBroughtForward = selectedMonth?.crypto_start ?? 0;
    return balanceBroughtForward + totalReceived - totalSent - externalExpense - baseFee;
  }, [allTxns, selectedMonth]);

  const teamPerformance = useMemo(() =>
    teams.map(team => {
      const members = teamToPersons.get(team as string) ?? [];
      const memberTxns = allTxns.filter(t => {
        if (t.income_expense !== "Income" && t.income_expense !== "Expense") return false;
        if (t.type === "Withdraw" || t.type === "Internal") return false;
        if (t.person === "Team Expense" || t.person === "Team") return false;
        return members.includes(t.person);
      });
      const income = memberTxns.filter(t => t.income_expense === "Income").reduce((s, t) => s + t.amount, 0);
      const expense = memberTxns.filter(t => t.income_expense === "Expense").reduce((s, t) => s + t.amount, 0);
      return { team, income, expense: Math.abs(expense), net: income + expense, memberCount: members.length };
    }).sort((a, b) => b.net - a.net)
  , [allTxns, teamToPersons, teams]);

  const walletActivity = useMemo(() =>
    teams.map(team => {
      const wTxns = allTxns.filter(t => t.team === team && t.income_expense !== "Cash");
      return { team, txCount: wTxns.length };
    })
  , [allTxns, teams]);

  const teamExpensePieData = teamPerformance.map(t => ({ name: t.team, value: Math.round(t.expense) }));
  const teamIncomePieData = teamPerformance.map(t => ({ name: t.team, value: Math.round(t.income) }));
  const monthlyComparisonData = monthlyAnalytics.map((row) => ({
    month: row.month,
    income: Math.round(row.income),
    expense: Math.round(row.expense),
    netProfit: Math.round(row.netProfit),
  }));

  const pendingTotal = pendingSettlements.reduce((s, t) => s + t.amount, 0);
  const pendingCount = pendingSettlements.length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Master Dashboard</h2>
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <KPICardSkeleton key={i} className="p-2.5" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Master Dashboard</h2>
          <p className="text-sm text-muted-foreground">Executive view — {selectedMonth?.name ?? "Select month"}</p>
        </div>
        {role === "admin" && (
          <FinanceReport
            transactions={allTxns}
            month={selectedMonth ? {
              name: selectedMonth.name,
              start_date: selectedMonth.start_date,
              end_date: selectedMonth.end_date,
              crypto_start: selectedMonth.crypto_start,
              crypto_end: selectedMonth.crypto_end,
              is_closed: selectedMonth.is_closed,
            } : null}
            teamToPersons={teamToPersons}
          />
        )}
      </div>

      <QuickAddCTA />
      <div className="rounded-lg border bg-card p-1.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="shrink-0 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Team Wallets
          </span>
          {walletActivity.map((w) => (
            <Link
              key={`quick-wallet-${w.team}`}
              to={`/team/${w.team}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs transition-colors hover:bg-muted/30"
            >
              <span className="font-medium text-foreground">{w.team}</span>
              <span className="text-[10px] text-muted-foreground">{w.txCount}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard dense label="Total Income" value={formatCurrency(stats.income)} variant="income" />
        <KPICard dense label="Total Expense" value={formatCurrency(Math.abs(stats.expense))} variant="expense" />
        <KPICard dense label="Net Income" value={formatCurrency(stats.net)} variant={stats.net >= 0 ? "income" : "expense"} />
        <KPICard dense label="CSB Wallet" value={formatCurrency(walletEndingBalance)} variant="default" subtitle="ending balance" />
        <KPICard dense label="Base Fee" value={formatCurrency(Math.abs(stats.baseFee))} variant="default" />
        <KPICard dense label="Team Expense" value={formatCurrency(stats.teamExpense)} variant="expense" />
      </div>

      {/* Pending Settlements Card */}
      {pendingCount > 0 && (
        <Link to="/settlements" className="block rounded-lg border border-withdraw/30 bg-withdraw-bg/40 p-2.5 transition-colors hover:bg-withdraw-bg/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-withdraw uppercase tracking-wider">🟡 Pending Settlements</p>
              <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">{formatCurrency(pendingTotal)}</p>
              <p className="text-xs text-muted-foreground">{pendingCount} pending transaction{pendingCount !== 1 ? "s" : ""}</p>
            </div>
            <span className="text-xs text-muted-foreground">View →</span>
          </div>
        </Link>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TeamPerformanceChart data={teamPerformance} />
        <DistributionCharts expenseData={teamExpensePieData} incomeData={teamIncomePieData} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <MonthlyComparisonChart data={monthlyComparisonData} />

        <div className="rounded-lg border bg-card p-3">
          <h3 className="mb-1 text-sm font-medium text-foreground">Team Averages (Per Member)</h3>
          <p className="mb-3 text-[10px] text-muted-foreground">Total divided by members</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2 text-right">Members</th>
                  <th className="px-3 py-2 text-right">Avg In</th>
                  <th className="px-3 py-2 text-right">Avg Out</th>
                  <th className="px-3 py-2 text-right">Avg Net</th>
                </tr>
              </thead>
              <tbody>
                {teamPerformance.map((t) => {
                  const avgIncome = t.memberCount > 0 ? t.income / t.memberCount : 0;
                  const avgExpense = t.memberCount > 0 ? t.expense / t.memberCount : 0;
                  const avgNet = t.memberCount > 0 ? t.net / t.memberCount : 0;
                  return (
                    <tr key={t.team} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium text-foreground">
                        <Link to={`/team-performance/${t.team}`} className="hover:underline">{t.team}</Link>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{t.memberCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-income">{formatCurrency(avgIncome)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-expense">{formatCurrency(avgExpense)}</td>
                      <td className={cn("px-3 py-2 text-right font-medium tabular-nums", avgNet >= 0 ? "text-income" : "text-expense")}>
                        {formatCurrency(avgNet)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
