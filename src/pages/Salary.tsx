import { useMemo, useState, useCallback, useEffect } from "react";
import { useMonth } from "@/contexts/MonthContext";
import { PersonName } from "@/components/PersonName";
import { useTeamPersons, buildPersonToTeamMap } from "@/hooks/useTeamPersons";
import { TEAMS, TEAM_PERSONS } from "@/lib/constants";
import { useTeams } from "@/hooks/useTeams";
import { useSalarySettings, useUpsertSalarySettings, SALARY_DEFAULTS } from "@/hooks/useSalarySettings";
import { usePreviousMonthDeficits } from "@/hooks/useSalaryData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, Info, Trophy, TrendingDown, Target, Save, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { fmt, fmtRound, pct } from "@/lib/format";

type SortKey = "person" | "team" | "income" | "expense" | "revenue" | "baseFee" | "prevDeficit" | "adjustedRevenue" | "rate" | "salary" | "carryForward";
type SortDir = "asc" | "desc";

export default function Salary() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const { selectedMonthId, selectedMonth, months, isCurrentMonthClosed } = useMonth();
  const { data: teamPersons = [] } = useTeamPersons();
  const { data: dynamicTeams = [] } = useTeams();
  const personToTeam = useMemo(() => {
    // Start with static TEAM_PERSONS mapping
    const map = new Map<string, string>();
    for (const team of TEAMS) {
      const members = TEAM_PERSONS[team] ?? [];
      for (const p of members) {
        if (p !== "Team") map.set(p, team);
      }
    }
    // Override with DB team_persons if available
    for (const tp of teamPersons) {
      map.set(tp.person_name, tp.team);
    }
    return map;
  }, [teamPersons]);

  const { data: settings } = useSalarySettings(selectedMonthId);
  const upsert = useUpsertSalarySettings();

  const { data: prevDeficits = [] } = usePreviousMonthDeficits(selectedMonthId, months);
  const prevDeficitMap = useMemo(() => {
    const m = new Map<string, number>();
    prevDeficits.forEach((d) => m.set(d.person, d.carry_forward_deficit));
    return m;
  }, [prevDeficits]);

  // Person monthly summaries for current month
  const { data: personSummaries = [] } = useQuery({
    queryKey: ["person_monthly_summaries", selectedMonthId],
    enabled: !!selectedMonthId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("person_monthly_summaries")
        .select("*")
        .eq("month_id", selectedMonthId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // For open months, compute from live transactions
  const { data: liveTransactions = [] } = useQuery({
    queryKey: ["transactions_for_salary", selectedMonthId],
    enabled: !!selectedMonthId && !isCurrentMonthClosed,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("person, income_expense, amount, type")
        .eq("month_id", selectedMonthId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Derive person revenue data — include ALL team persons so base fee always applies
  const personData = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();

    // Seed all known team persons from static TEAM_PERSONS (excluding CSB-only & Team)
    const seenPersons = new Set<string>();
    for (const team of dynamicTeams) {
      const members = TEAM_PERSONS[team] ?? [];
      for (const p of members) {
        if (p === "Team" || p === "ACN") continue;
        if (!seenPersons.has(p)) {
          map.set(p, { income: 0, expense: 0 });
          seenPersons.add(p);
        }
      }
    }

    // Also seed from DB team_persons if available
    for (const tp of teamPersons) {
      if (tp.person_name === "ACN") continue;
      if (!map.has(tp.person_name)) {
        map.set(tp.person_name, { income: 0, expense: 0 });
      }
    }

    if (isCurrentMonthClosed && personSummaries.length > 0) {
      for (const p of personSummaries) {
        if (p.person === "ACN") continue;
        const cur = map.get(p.person) ?? { income: 0, expense: 0 };
        map.set(p.person, { income: Number(p.income), expense: Number(p.expense) });
      }
    } else {
      // From live transactions
      for (const t of liveTransactions) {
        if (["Internal", "Team", "All", "ACN"].includes(t.person)) continue;
        if (["Internal", "Withdraw"].includes(t.type)) continue;
        if (!["Income", "Expense"].includes(t.income_expense)) continue;
        const cur = map.get(t.person) ?? { income: 0, expense: 0 };
        if (t.income_expense === "Income") cur.income += Number(t.amount);
        else cur.expense += Number(t.amount);
        map.set(t.person, cur);
      }
    }

    return Array.from(map.entries())
      .map(([person, v]) => ({
        person,
        income: v.income,
        expense: v.expense,
        revenue: v.income + v.expense,
      }));
  }, [isCurrentMonthClosed, personSummaries, liveTransactions, teamPersons, dynamicTeams]);

  const s = settings ?? { ...SALARY_DEFAULTS, month_id: selectedMonthId ?? "" };

  // Local draft state for settings (only saved on button click)
  const [draft, setDraft] = useState({
    base_fee_per_person: s.base_fee_per_person,
    team_target: s.team_target,
    base_rate: s.base_rate,
    below_target_rate: s.below_target_rate,
    top_performer_rate: s.top_performer_rate,
  });

  // Sync draft when settings load or month changes
  useEffect(() => {
    setDraft({
      base_fee_per_person: s.base_fee_per_person,
      team_target: s.team_target,
      base_rate: s.base_rate,
      below_target_rate: s.below_target_rate,
      top_performer_rate: s.top_performer_rate,
    });
  }, [s.base_fee_per_person, s.team_target, s.base_rate, s.below_target_rate, s.top_performer_rate]);

  const isDirty = draft.base_fee_per_person !== s.base_fee_per_person ||
    draft.team_target !== s.team_target ||
    draft.base_rate !== s.base_rate ||
    draft.below_target_rate !== s.below_target_rate ||
    draft.top_performer_rate !== s.top_performer_rate;

  // Salary rows use saved settings (s), not draft
  const salaryRows = useMemo(() => {
    if (!personData.length) return [];

    // Group by team and compute team averages
    const teamRevenues = new Map<string, number[]>();
    const rows = personData.map((p) => {
      const team = personToTeam.get(p.person) ?? "Unknown";
      const prevDef = prevDeficitMap.get(p.person) ?? 0;
      const adjRevenue = p.revenue - s.base_fee_per_person - prevDef;
      if (!teamRevenues.has(team)) teamRevenues.set(team, []);
      teamRevenues.get(team)!.push(p.revenue);
      return { ...p, team, prevDeficit: prevDef, adjustedRevenue: adjRevenue };
    });

    const teamAvgs = new Map<string, number>();
    const teamMaxRevenue = new Map<string, number>();
    teamRevenues.forEach((revs, team) => {
      teamAvgs.set(team, revs.reduce((a, b) => a + b, 0) / revs.length);
      teamMaxRevenue.set(team, Math.max(...revs));
    });

    // Find the single top performer across ALL teams (highest revenue overall, among teams that met target)
    const teamMetTargetSet = new Set<string>();
    teamAvgs.forEach((avg, team) => {
      if (avg >= s.team_target) teamMetTargetSet.add(team);
    });

    // Only candidates from teams that met target
    let topPerformerPerson: string | null = null;
    let topPerformerRevenue = -Infinity;
    rows.forEach((r) => {
      if (teamMetTargetSet.has(r.team) && r.revenue > topPerformerRevenue) {
        topPerformerRevenue = r.revenue;
        topPerformerPerson = r.person;
      } else if (teamMetTargetSet.has(r.team) && r.revenue === topPerformerRevenue && topPerformerPerson && r.person.localeCompare(topPerformerPerson) < 0) {
        topPerformerPerson = r.person;
      }
    });

    return rows
      .map((r) => {
        const teamAvg = teamAvgs.get(r.team) ?? 0;
        const teamMetTarget = teamMetTargetSet.has(r.team);
        const isTopPerformer = r.person === topPerformerPerson;
        let rate = s.below_target_rate;
        if (teamMetTarget) rate = s.base_rate;
        if (isTopPerformer) rate = s.top_performer_rate;

        const salary = r.adjustedRevenue > 0 ? r.adjustedRevenue * rate : 0;
        const carryForward = r.adjustedRevenue <= 0 ? Math.abs(r.adjustedRevenue) : 0;

        return {
          ...r,
          teamAvg,
          rate,
          salary,
          carryForward,
          isTopPerformer,
          teamMetTarget,
        };
      })
      .sort((a, b) => b.salary - a.salary);
  }, [personData, personToTeam, prevDeficitMap, s]);

  const [sortKey, setSortKey] = useState<SortKey>("salary");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir(key === "person" || key === "team" ? "asc" : "desc");
      return key;
    });
  }, []);

  const sortedRows = useMemo(() => {
    const rows = [...salaryRows];
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case "person": va = a.person; vb = b.person; break;
        case "team": va = a.team; vb = b.team; break;
        case "income": va = a.income; vb = b.income; break;
        case "expense": va = a.expense; vb = b.expense; break;
        case "revenue": va = a.revenue; vb = b.revenue; break;
        case "baseFee": va = s.base_fee_per_person; vb = s.base_fee_per_person; break;
        case "prevDeficit": va = a.prevDeficit; vb = b.prevDeficit; break;
        case "adjustedRevenue": va = a.adjustedRevenue; vb = b.adjustedRevenue; break;
        case "rate": va = a.rate; vb = b.rate; break;
        case "salary": va = a.salary; vb = b.salary; break;
        case "carryForward": va = a.carryForward; vb = b.carryForward; break;
        default: va = 0; vb = 0;
      }
      if (typeof va === "string") return dir * va.localeCompare(vb as string);
      return dir * ((va as number) - (vb as number));
    });
    return rows;
  }, [salaryRows, sortKey, sortDir, s.base_fee_per_person]);

  const handleSaveSettings = useCallback(() => {
    if (!selectedMonthId || isCurrentMonthClosed) return;
    upsert.mutate({
      month_id: selectedMonthId,
      ...draft,
    });
  }, [selectedMonthId, isCurrentMonthClosed, draft, upsert]);

  if (!selectedMonthId) {
    return <p className="text-muted-foreground py-10 text-center">Select a month to view salary data.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Salary</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["person_monthly_summaries", selectedMonthId] });
              queryClient.invalidateQueries({ queryKey: ["transactions_for_salary", selectedMonthId] });
              queryClient.invalidateQueries({ queryKey: ["person_salary_balances"] });
              queryClient.invalidateQueries({ queryKey: ["salary_settings", selectedMonthId] });
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Table
          </Button>
          {isCurrentMonthClosed && (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" /> Closed — Read Only
            </Badge>
          )}
        </div>
      </div>

      {/* Explanation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-muted-foreground" />
            Salary Calculation Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• <strong>Revenue</strong> = Income − Expense</p>
          <p>• <strong>Base Fee</strong> ({fmt(s.base_fee_per_person)}) deducted per person</p>
          <p>• Previous month deficit deducted from revenue</p>
          <p>• Team avg revenue determines rate: below target → <strong>{pct(s.below_target_rate)}</strong>, at/above target ({fmt(s.team_target)}) → <strong>{pct(s.base_rate)}</strong></p>
          <p>• Highest performer across all teams (if their team met target) → <strong>{pct(s.top_performer_rate)}</strong></p>
          <p>• If adjusted revenue ≤ 0 → salary = 0 and deficit carries forward</p>
          <p>• <strong>Final Salary</strong> = Adjusted Revenue × Applied Rate</p>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Settings {isCurrentMonthClosed && "(locked)"} {!isAdmin && !isCurrentMonthClosed && "(view only)"}</CardTitle>
          {!isCurrentMonthClosed && isAdmin && (
            <Button
              size="sm"
              disabled={!isDirty || upsert.isPending}
              onClick={handleSaveSettings}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              Save Settings
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {([
              { label: "Base Fee / Person", field: "base_fee_per_person" as const },
              { label: "Team Target", field: "team_target" as const },
              { label: "Base Rate", field: "base_rate" as const },
              { label: "Below Target Rate", field: "below_target_rate" as const },
              { label: "Top Performer Rate", field: "top_performer_rate" as const },
            ]).map((item) => (
              <div key={item.field}>
                <Label className="text-xs text-muted-foreground">{item.label}</Label>
                <Input
                  type="number"
                  step="any"
                  value={draft[item.field]}
                  disabled={isCurrentMonthClosed || !isAdmin}
                  onChange={(e) => {
                    const num = parseFloat(e.target.value);
                    if (!isNaN(num)) setDraft((prev) => ({ ...prev, [item.field]: num }));
                  }}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {([
                  { key: "person" as SortKey, label: "Person", align: "" },
                  { key: "team" as SortKey, label: "Team", align: "" },
                  { key: "income" as SortKey, label: "Income", align: "text-right" },
                  { key: "expense" as SortKey, label: "Expense", align: "text-right" },
                  { key: "revenue" as SortKey, label: "Revenue", align: "text-right" },
                  { key: "baseFee" as SortKey, label: "Base Fee", align: "text-right" },
                  { key: "prevDeficit" as SortKey, label: "Prev Deficit", align: "text-right" },
                  { key: "adjustedRevenue" as SortKey, label: "Revenue After Fees", align: "text-right" },
                  { key: "rate" as SortKey, label: "Rate", align: "text-right" },
                  { key: "salary" as SortKey, label: "Final Salary", align: "text-right" },
                  { key: "carryForward" as SortKey, label: "Carry Forward", align: "text-right" },
                ]).map((col) => (
                  <TableHead
                    key={col.key}
                    className={`${col.align} cursor-pointer select-none hover:text-foreground transition-colors`}
                    onClick={() => toggleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    No salary data for this month.
                  </TableCell>
                </TableRow>
              )}
              {sortedRows.map((r) => (
                <TableRow key={r.person}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      <PersonName name={r.person} team={r.team} />
                      {r.isTopPerformer && (
                        <Badge className="bg-amber-500/20 text-amber-700 border-amber-300 text-[10px] px-1 py-0">
                          <Trophy className="h-3 w-3 mr-0.5" /> Top
                        </Badge>
                      )}
                      {r.teamMetTarget && !r.isTopPerformer && (
                        <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-300 text-[10px] px-1 py-0">
                          <Target className="h-3 w-3 mr-0.5" /> Target
                        </Badge>
                      )}
                      {r.carryForward > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1 py-0">
                          <TrendingDown className="h-3 w-3 mr-0.5" /> Deficit
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{r.team}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.income)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(Math.abs(r.expense))}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(s.base_fee_per_person)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${r.prevDeficit > 0 ? "text-destructive" : ""}`}>{r.prevDeficit > 0 ? `-${fmt(r.prevDeficit)}` : fmt(0)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${r.adjustedRevenue > 0 ? "text-emerald-600 dark:text-emerald-400" : r.adjustedRevenue < 0 ? "text-destructive" : ""}`}>
                    {fmt(r.adjustedRevenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{pct(r.rate)}</TableCell>
                  <TableCell className={`text-right tabular-nums font-bold text-lg ${r.salary === 0 ? "text-muted-foreground" : ""}`}>
                    {fmtRound(r.salary)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${r.carryForward > 0 ? "text-destructive font-medium" : ""}`}>
                    {fmt(r.carryForward)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
