import { useParams, Navigate, Link } from "react-router-dom";
import { useMemo } from "react";
import KPICard from "@/components/KPICard";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMonth } from "@/contexts/MonthContext";
import { useTransactions } from "@/hooks/useTransactions";
import { useTeamPersons, buildTeamToPersonsMap } from "@/hooks/useTeamPersons";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export default function TeamPerformance() {
  const { teamId } = useParams<{ teamId: string }>();
  const validTeam = !!teamId;
  const { selectedMonth, selectedMonthId } = useMonth();
  const { data: allTxns = [], isLoading } = useTransactions(selectedMonthId);
  const { data: teamPersons = [] } = useTeamPersons();

  const teamToPersons = useMemo(() => buildTeamToPersonsMap(teamPersons), [teamPersons]);
  const members = useMemo(() => teamToPersons.get(teamId!) ?? [], [teamToPersons, teamId]);

  // Aggregate person stats across ALL wallets for this team's members
  const personStats = useMemo(() => {
    const eligible = allTxns.filter(t => {
      if (t.income_expense !== "Income" && t.income_expense !== "Expense") return false;
      if (t.type === "Withdraw" || t.type === "Internal") return false;
      if (t.person === "Team Expense" || t.person === "Team") return false;
      if (!members.includes(t.person)) return false;
      return true;
    });

    const map = new Map<string, { income: number; expense: number }>();
    for (const t of eligible) {
      const entry = map.get(t.person) ?? { income: 0, expense: 0 };
      if (t.income_expense === "Income") entry.income += t.amount;
      else entry.expense += Math.abs(t.amount);
      map.set(t.person, entry);
    }

    return Array.from(map.entries())
      .map(([name, { income, expense }]) => ({ name, income, expense, revenue: income - expense }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [allTxns, members]);

  const totals = useMemo(() => {
    const income = personStats.reduce((s, p) => s + p.income, 0);
    const expense = personStats.reduce((s, p) => s + p.expense, 0);
    return { income, expense, revenue: income - expense };
  }, [personStats]);

  const chartData = personStats.map(p => ({
    name: p.name,
    income: Math.round(p.income),
    expense: Math.round(p.expense),
  }));

  if (!validTeam) return <Navigate to="/" replace />;

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading performance…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Team {teamId} — Performance</h2>
        <p className="text-sm text-muted-foreground">
          Aggregated across all wallets — {selectedMonth?.name ?? "Select month"} · {members.length} members
        </p>
      </div>

      <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground">
        📊 Performance is calculated by aggregating each member's income and expenses across all wallets. For wallet transactions, see the <a href={`/team/${teamId}`} className="font-medium text-foreground underline underline-offset-2 hover:text-primary">{teamId} Wallet</a> page.
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KPICard label="Total Income" value={formatCurrency(totals.income)} variant="income" />
        <KPICard label="Total Expense" value={formatCurrency(totals.expense)} variant="expense" />
        <KPICard label="Net Revenue" value={formatCurrency(totals.revenue)} variant={totals.revenue >= 0 ? "income" : "expense"} />
      </div>

      {chartData.length > 0 && (
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 text-sm font-medium text-foreground">Member Income vs Expense</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,90%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(220,10%,46%)" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(220,10%,46%)" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "hsl(0,0%,100%)", border: "1px solid hsl(220,13%,91%)", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Bar dataKey="income" fill="hsl(152,60%,40%)" radius={[4, 4, 0, 0]} name="Income" />
              <Bar dataKey="expense" fill="hsl(0,65%,50%)" radius={[4, 4, 0, 0]} name="Expense" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 w-8">#</th>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3 text-right">Income</th>
              <th className="px-4 py-3 text-right">Expense</th>
              <th className="px-4 py-3 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {personStats.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No performance data for this period.</td></tr>
            ) : personStats.map((p, i) => (
              <tr key={p.name} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-foreground">
                  <Link to={`/person/${encodeURIComponent(p.name)}`} className="hover:text-primary underline-offset-2 hover:underline transition-colors">
                    {p.name}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-income">{formatCurrency(p.income)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-expense">{formatCurrency(p.expense)}</td>
                <td className={cn(
                  "whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums",
                  p.revenue > 0 && "text-income",
                  p.revenue < 0 && "text-expense",
                  p.revenue === 0 && "text-muted-foreground",
                )}>
                  {formatCurrency(p.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
          {personStats.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-foreground">Total</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-income">{formatCurrency(totals.income)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-expense">{formatCurrency(totals.expense)}</td>
                <td className={cn(
                  "whitespace-nowrap px-4 py-3 text-right tabular-nums",
                  totals.revenue > 0 && "text-income",
                  totals.revenue < 0 && "text-expense",
                )}>
                  {formatCurrency(totals.revenue)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
