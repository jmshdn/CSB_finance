import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PersonName } from "@/components/PersonName";
import { formatCurrency } from "@/lib/format";
import { useTeams } from "@/hooks/useTeams";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, Legend,
} from "recharts";
import { Trophy, TrendingDown, TrendingUp, User, Search } from "lucide-react";
import { getTeamDotColor, getTeamDotStyle } from "@/lib/team-colors";
import { useMonth } from "@/contexts/MonthContext";
import { useTransactions } from "@/hooks/useTransactions";
import { useTeamPersons, buildPersonToTeamMap } from "@/hooks/useTeamPersons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

interface TeamStats {
  team: string;
  income: number;
  expense: number;
  net: number;
  txCount: number;
}

interface PersonStat {
  name: string;
  income: number;
  expense: number;
  revenue: number;
  team: string;
  txCount: number;
  incomeShare: number; // % of total income
}

export default function Teams() {
  const { selectedMonth, selectedMonthId } = useMonth();
  const { data: allTxns = [], isLoading } = useTransactions(selectedMonthId);
  const { data: teamPersons = [] } = useTeamPersons();
  const { data: teams = [] } = useTeams();
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  const personToTeam = useMemo(() => buildPersonToTeamMap(teamPersons), [teamPersons]);

  // Wallet-bound team stats
  const teamStats = useMemo(() => {
    return teams.map<TeamStats>(team => {
      const teamTxns = allTxns.filter(t => t.team === team && t.income_expense !== "Internal" && t.income_expense !== "Cash");
      const income = teamTxns.filter(t => t.income_expense === "Income").reduce((s, t) => s + t.amount, 0);
      const expense = teamTxns.filter(t => t.income_expense === "Expense").reduce((s, t) => s + t.amount, 0);
      return { team, income, expense: Math.abs(expense), net: income + expense, txCount: teamTxns.length };
    }).sort((a, b) => b.net - a.net);
  }, [allTxns, teams]);

  // Individual stats across ALL wallets
  const personStats = useMemo(() => {
    const eligible = allTxns.filter(t =>
      t.income_expense !== "Internal" &&
      t.type !== "Withdraw" &&
      t.type !== "Internal" &&
      t.person !== "Team Expense" &&
      t.person !== "Team" &&
      (t.income_expense === "Income" || t.income_expense === "Expense")
    );
    const map = new Map<string, { income: number; expense: number; txCount: number }>();
    for (const t of eligible) {
      const entry = map.get(t.person) ?? { income: 0, expense: 0, txCount: 0 };
      if (t.income_expense === "Income") entry.income += t.amount;
      else entry.expense += Math.abs(t.amount);
      entry.txCount += 1;
      map.set(t.person, entry);
    }
    const totalIncome = Array.from(map.values()).reduce((s, e) => s + e.income, 0);
    return Array.from(map.entries())
      .map(([name, { income, expense, txCount }]) => ({
        name, income, expense, txCount,
        revenue: income - expense,
        team: personToTeam.get(name) ?? "—",
        incomeShare: totalIncome > 0 ? (income / totalIncome) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue) as PersonStat[];
  }, [allTxns, personToTeam]);

  const topPerformer = personStats[0];
  const topExpenser = [...personStats].sort((a, b) => b.expense - a.expense)[0];
  const mostActive = [...personStats].sort((a, b) => b.txCount - a.txCount)[0];

  const filteredPersons = useMemo(() =>
    personStats.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.team.toLowerCase().includes(search.toLowerCase())),
    [personStats, search]
  );

  const selectedStat = selectedPerson ? personStats.find(p => p.name === selectedPerson) : null;

  const chartData = teamStats.map(t => ({
    team: t.team,
    income: Math.round(t.income),
    expense: Math.round(t.expense),
  }));

  // Per-team comparison for individual tab
  const teamGrouped = useMemo(() => {
    return teams.map(team => {
      const members = personStats.filter(p => p.team === team);
      return {
        team,
        income: members.reduce((s, p) => s + p.income, 0),
        expense: members.reduce((s, p) => s + p.expense, 0),
        revenue: members.reduce((s, p) => s + p.revenue, 0),
        memberCount: members.length,
      };
    });
  }, [personStats, teams]);

  const topTeam = teamStats[0];

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading teams…</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Teams</h2>
        <p className="text-sm text-muted-foreground">Performance breakdown — {selectedMonth?.name ?? "Select month"}</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1">Team Overview</TabsTrigger>
          <TabsTrigger value="individual" className="flex-1">Individual Performance</TabsTrigger>
        </TabsList>

        {/* ── TEAM OVERVIEW TAB ── */}
        <TabsContent value="overview" className="space-y-5 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-lg border bg-income-bg p-4">
              <Trophy className="h-5 w-5 text-income" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Top Performer</p>
                <p className="text-sm font-semibold text-foreground">{topTeam?.team}</p>
                <p className="text-xs text-income">{formatCurrency(topTeam?.net ?? 0)} net</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-expense-bg p-4">
              <TrendingDown className="h-5 w-5 text-expense" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Highest Expense</p>
                <p className="text-sm font-semibold text-foreground">{teamStats.reduce((max, t) => t.expense > max.expense ? t : max, teamStats[0])?.team}</p>
                <p className="text-xs text-expense">{formatCurrency(teamStats.reduce((max, t) => t.expense > max.expense ? t : max, teamStats[0])?.expense ?? 0)} spent</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h3 className="mb-4 text-sm font-medium text-foreground">Income vs Expense by Team</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="team" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="income" fill="hsl(152,60%,40%)" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expense" fill="hsl(0,65%,50%)" radius={[4, 4, 0, 0]} name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teamStats.map(t => (
              <div key={t.team} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className={`h-3 w-3 rounded-full ${getTeamDotColor(t.team)}`} style={getTeamDotStyle(t.team)} />
                    {t.team}
                  </span>
                  <span className="text-xs text-muted-foreground">{t.txCount} txns</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">In</p>
                    <p className="text-sm font-medium text-income">{formatCurrency(t.income)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Out</p>
                    <p className="text-sm font-medium text-expense">{formatCurrency(t.expense)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net</p>
                    <p className={cn("text-sm font-medium", t.net >= 0 ? "text-income" : "text-expense")}>{formatCurrency(t.net)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h3 className="mb-3 text-sm font-medium text-foreground">Individual Leaderboard</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Person</th>
                    <th className="px-3 py-2">Team</th>
                    <th className="px-3 py-2 text-right">Income</th>
                    <th className="px-3 py-2 text-right">Expense</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {personStats.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No data yet.</td></tr>
                  ) : personStats.map((p, i) => (
                    <tr key={p.name} className="border-b last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-foreground">
                        <PersonName name={p.name} team={p.team} />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{p.team}</td>
                      <td className="px-3 py-2 text-right text-income tabular-nums">{formatCurrency(p.income)}</td>
                      <td className="px-3 py-2 text-right text-expense tabular-nums">{formatCurrency(p.expense)}</td>
                      <td className={cn("px-3 py-2 text-right font-medium tabular-nums", p.revenue >= 0 ? "text-income" : "text-expense")}>
                        {formatCurrency(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── INDIVIDUAL PERFORMANCE TAB ── */}
        <TabsContent value="individual" className="space-y-5 mt-4">
          {/* Highlight cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1 rounded-lg border bg-income-bg p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Trophy className="h-3.5 w-3.5 text-income" /> Top Earner
              </div>
              <p className="text-sm font-semibold text-foreground">{topPerformer?.name ?? "—"}</p>
              <p className="text-xs text-income">{formatCurrency(topPerformer?.revenue ?? 0)}</p>
              <p className="text-[11px] text-muted-foreground">{topPerformer?.team}</p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border bg-expense-bg p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <TrendingDown className="h-3.5 w-3.5 text-expense" /> Most Expenses
              </div>
              <p className="text-sm font-semibold text-foreground">{topExpenser?.name ?? "—"}</p>
              <p className="text-xs text-expense">{formatCurrency(topExpenser?.expense ?? 0)}</p>
              <p className="text-[11px] text-muted-foreground">{topExpenser?.team}</p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border bg-card p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> Most Active
              </div>
              <p className="text-sm font-semibold text-foreground">{mostActive?.name ?? "—"}</p>
              <p className="text-xs text-primary">{mostActive?.txCount ?? 0} txns</p>
              <p className="text-[11px] text-muted-foreground">{mostActive?.team}</p>
            </div>
          </div>

          {/* Revenue by team (individual aggregated) */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="mb-4 text-sm font-medium text-foreground">Revenue by Group (Individual Aggregated)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={teamGrouped} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="team" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} width={36} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="income" fill="hsl(152,60%,40%)" radius={[0, 4, 4, 0]} name="Income" />
                <Bar dataKey="expense" fill="hsl(0,65%,50%)" radius={[0, 4, 4, 0]} name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Individual income chart */}
          {personStats.length > 0 && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="mb-4 text-sm font-medium text-foreground">Individual Income vs Expense</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={personStats.map(p => ({ name: p.name, income: Math.round(p.income), expense: Math.round(p.expense) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-35} textAnchor="end" height={48} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" fill="hsl(152,60%,40%)" radius={[4, 4, 0, 0]} name="Income" />
                  <Bar dataKey="expense" fill="hsl(0,65%,50%)" radius={[4, 4, 0, 0]} name="Expense" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Searchable ranked table */}
          <div className="rounded-lg border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Individual Rankings</h3>
              <div className="relative w-44">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Person</th>
                    <th className="px-3 py-2">Group</th>
                    <th className="px-3 py-2 text-right">Txns</th>
                    <th className="px-3 py-2 text-right">Income</th>
                    <th className="px-3 py-2 text-right">Expense</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                    <th className="px-3 py-2 text-right">Income %</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPersons.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No data found.</td></tr>
                  ) : filteredPersons.map((p, i) => {
                    const rank = personStats.findIndex(ps => ps.name === p.name) + 1;
                    return (
                      <tr
                        key={p.name}
                        className={cn(
                          "border-b last:border-0 cursor-pointer transition-colors hover:bg-muted/40",
                          selectedPerson === p.name && "bg-primary/5"
                        )}
                        onClick={() => setSelectedPerson(prev => prev === p.name ? null : p.name)}
                      >
                        <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{rank}</td>
                        <td className="px-3 py-2.5 font-medium text-foreground">
                          <PersonName name={p.name} team={p.team} />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{p.team}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{p.txCount}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-income">{formatCurrency(p.income)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-expense">{formatCurrency(p.expense)}</td>
                        <td className={cn("px-3 py-2.5 text-right font-semibold tabular-nums", p.revenue >= 0 ? "text-income" : "text-expense")}>
                          {formatCurrency(p.revenue)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                          {p.incomeShare.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Expanded detail panel */}
            {selectedStat && (
              <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedStat.name}</p>
                    <p className="text-xs text-muted-foreground">Group {selectedStat.team} · {selectedStat.txCount} transactions</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md bg-income-bg p-3 text-center">
                    <p className="text-[11px] text-muted-foreground mb-0.5">Income</p>
                    <p className="text-sm font-semibold text-income">{formatCurrency(selectedStat.income)}</p>
                  </div>
                  <div className="rounded-md bg-expense-bg p-3 text-center">
                    <p className="text-[11px] text-muted-foreground mb-0.5">Expense</p>
                    <p className="text-sm font-semibold text-expense">{formatCurrency(selectedStat.expense)}</p>
                  </div>
                  <div className={cn("rounded-md p-3 text-center", selectedStat.revenue >= 0 ? "bg-income-bg" : "bg-expense-bg")}>
                    <p className="text-[11px] text-muted-foreground mb-0.5">Revenue</p>
                    <p className={cn("text-sm font-semibold", selectedStat.revenue >= 0 ? "text-income" : "text-expense")}>{formatCurrency(selectedStat.revenue)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">Income share:</span> {selectedStat.incomeShare.toFixed(1)}% of all individual income
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Expense ratio:</span> {selectedStat.income > 0 ? ((selectedStat.expense / selectedStat.income) * 100).toFixed(1) : "—"}% of income
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Overall rank:</span> #{personStats.findIndex(p => p.name === selectedStat.name) + 1} of {personStats.length}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Net margin:</span> {selectedStat.income > 0 ? ((selectedStat.revenue / selectedStat.income) * 100).toFixed(1) : "—"}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
