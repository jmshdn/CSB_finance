import { useMemo, useState } from "react";
import { useAnalyticsData, type AnalyticsRow } from "@/hooks/useAnalyticsData";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, ReferenceLine,
} from "recharts";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Analytics() {
  const { data: allRows = [], isLoading } = useAnalyticsData();
  const [rangeStart, setRangeStart] = useState("all");
  const [rangeEnd, setRangeEnd] = useState("all");
  const [mode, setMode] = useState<"absolute" | "percentage">("absolute");

  const rows = useMemo(() => {
    if (allRows.length === 0) return [];
    let start = 0;
    let end = allRows.length - 1;
    if (rangeStart !== "all") {
      const idx = allRows.findIndex((r) => r.monthId === rangeStart);
      if (idx >= 0) start = idx;
    }
    if (rangeEnd !== "all") {
      const idx = allRows.findIndex((r) => r.monthId === rangeEnd);
      if (idx >= 0) end = idx;
    }
    if (start > end) [start, end] = [end, start];
    return allRows.slice(start, end + 1);
  }, [allRows, rangeStart, rangeEnd]);

  // Summaries
  const totals = useMemo(() => {
    const inc = rows.reduce((s, r) => s + r.income, 0);
    const exp = rows.reduce((s, r) => s + r.expense, 0);
    const bf = rows.reduce((s, r) => s + r.baseFee, 0);
    const net = rows.reduce((s, r) => s + r.netProfit, 0);
    const margin = inc > 0 ? (net / inc) * 100 : 0;
    return { inc, exp, bf, net, margin };
  }, [rows]);

  // Waterfall data
  const waterfallData = useMemo(() =>
    rows.map((r) => ({
      month: r.month,
      income: r.income,
      expense: -r.expense,
      baseFee: -r.baseFee,
      netProfit: r.netProfit,
      // For stacked waterfall rendering
      incomeBar: r.income,
      expenseBar: r.expense,
      baseFeeBar: r.baseFee,
    }))
  , [rows]);

  const fmtPct = (v: number) => `${v.toFixed(1)}%`;
  const fmtVal = (v: number) =>
    mode === "percentage" ? fmtPct(v) : formatCurrency(v);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Loading analytics…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Financial Analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Multi-period performance analysis
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>From</span>
            <Select value={rangeStart} onValueChange={setRangeStart}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Earliest</SelectItem>
                {allRows.map((r) => (
                  <SelectItem key={r.monthId} value={r.monthId}>
                    {r.month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>To</span>
            <Select value={rangeEnd} onValueChange={setRangeEnd}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Latest</SelectItem>
                {allRows.map((r) => (
                  <SelectItem key={r.monthId} value={r.monthId}>
                    {r.month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => v && setMode(v as "absolute" | "percentage")}
            className="rounded-md border"
          >
            <ToggleGroupItem value="absolute" className="h-8 px-3 text-xs">
              $
            </ToggleGroupItem>
            <ToggleGroupItem value="percentage" className="h-8 px-3 text-xs">
              %
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryCard label="Total Income" value={formatCurrency(totals.inc)} className="text-income" />
        <SummaryCard label="Total Expense" value={formatCurrency(totals.exp)} className="text-expense" />
        <SummaryCard label="Total Base Fee" value={formatCurrency(totals.bf)} className="text-muted-foreground" />
        <SummaryCard
          label="Net Profit"
          value={formatCurrency(totals.net)}
          className={totals.net >= 0 ? "text-income" : "text-expense"}
        />
        <SummaryCard
          label="Avg Margin"
          value={`${totals.margin.toFixed(1)}%`}
          className={totals.margin >= 0 ? "text-income" : "text-expense"}
        />
      </div>

      {/* Row 1 – Performance Overview */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Net Profit Trend */}
        <ChartCard title="Net Profit Trend">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(_: any, name: string, props: any) => {
                  const r = props.payload as AnalyticsRow;
                  return null; // handled by custom content
                }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as AnalyticsRow;
                  return (
                    <div className="rounded-lg border bg-card p-3 text-xs shadow-md">
                      <p className="mb-1 font-medium text-foreground">{r.month}</p>
                      <p className="text-income">Income: {formatCurrency(r.income)}</p>
                      <p className="text-expense">Expense: {formatCurrency(r.expense)}</p>
                      <p className="text-muted-foreground">Base Fee: {formatCurrency(r.baseFee)}</p>
                      <p className={cn("font-medium", r.netProfit >= 0 ? "text-income" : "text-expense")}>
                        Net: {formatCurrency(r.netProfit)}
                      </p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="netProfit"
                stroke="hsl(var(--income))"
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--income))" }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Profit Margin % */}
        <ChartCard title="Profit Margin %">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [`${value.toFixed(2)}%`, "Margin"]}
              />
              <Line
                type="monotone"
                dataKey="marginPercent"
                stroke="hsl(var(--internal))"
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--internal))" }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2 – Revenue vs Cost */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Grouped Bar: Income vs Expense */}
        <ChartCard title="Income vs Expense">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="income" fill="hsl(var(--income))" radius={[4, 4, 0, 0]} name="Income" isAnimationActive={false} />
              <Bar dataKey="expense" fill="hsl(var(--expense))" radius={[4, 4, 0, 0]} name="Expense" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Stacked Bar: Cost Composition */}
        <ChartCard title="Cost Composition">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="baseFee" stackId="cost" fill="hsl(var(--withdraw))" name="Base Fee" isAnimationActive={false} />
              <Bar dataKey="expense" stackId="cost" fill="hsl(var(--expense))" radius={[4, 4, 0, 0]} name="Variable Expense" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 3 – Crypto Growth */}
      <ChartCard title="Crypto Asset Growth">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as AnalyticsRow;
                return (
                  <div className="rounded-lg border bg-card p-3 text-xs shadow-md">
                    <p className="mb-1 font-medium text-foreground">{r.month}</p>
                    <p>Balance: {formatCurrency(r.cryptoSheetBalance)}</p>
                    {r.cryptoChangePercent !== null && (
                      <p className={r.cryptoChangePercent >= 0 ? "text-income" : "text-expense"}>
                        MoM: {r.cryptoChangePercent >= 0 ? "+" : ""}
                        {r.cryptoChangePercent.toFixed(1)}%
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="cryptoSheetBalance"
              stroke="hsl(var(--internal))"
              strokeWidth={2}
              dot={{ r: 4, fill: "hsl(var(--internal))" }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
              name="Crypto Balance"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Row 4 – Waterfall / Cash Flow Breakdown */}
      <ChartCard title="Monthly Cash Flow Waterfall">
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={waterfallData} barGap={0}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Tooltip
                  contentStyle={tooltipStyle}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-card p-3 text-xs shadow-md">
                        <p className="mb-1 font-medium text-foreground">{d.month}</p>
                        <p className="text-income">+ Income: {formatCurrency(d.income)}</p>
                        <p className="text-expense">− Expense: {formatCurrency(d.expenseBar)}</p>
                        <p className="text-muted-foreground">− Base Fee: {formatCurrency(d.baseFeeBar)}</p>
                        <p className={cn("mt-1 font-medium border-t pt-1", d.netProfit >= 0 ? "text-income" : "text-expense")}>
                          = Net: {formatCurrency(d.netProfit)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="income" fill="hsl(var(--income))" radius={[4, 4, 0, 0]} name="Income" isAnimationActive={false} />
                <Bar dataKey="expense" fill="hsl(var(--expense))" radius={[4, 4, 0, 0]} name="Expense" isAnimationActive={false}>
                  {waterfallData.map((_, i) => (
                    <Cell key={i} fill="hsl(var(--expense))" />
                  ))}
                </Bar>
                <Bar dataKey="baseFee" fill="hsl(var(--withdraw))" radius={[4, 4, 0, 0]} name="Base Fee" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-income" /> Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-expense" /> Expense
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-withdraw" /> Base Fee
          </span>
        </div>
      </ChartCard>

      {/* Detailed Table */}
      <div className="rounded-lg border bg-card p-fluid-card">
        <h3 className="mb-3 text-sm font-medium text-foreground">Period Detail</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Month</th>
                <th className="px-3 py-2 text-right">Income</th>
                <th className="px-3 py-2 text-right">Expense</th>
                <th className="px-3 py-2 text-right">Base Fee</th>
                <th className="px-3 py-2 text-right">Net Profit</th>
                <th className="px-3 py-2 text-right">Margin</th>
                <th className="px-3 py-2 text-right">Crypto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.monthId} className="border-b last:border-0">
                  <td className="px-3 py-2.5 font-medium text-foreground">{r.month}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-income">{formatCurrency(r.income)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-expense">{formatCurrency(r.expense)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatCurrency(r.baseFee)}</td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums font-medium", r.netProfit >= 0 ? "text-income" : "text-expense")}>
                    {formatCurrency(r.netProfit)}
                  </td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", r.marginPercent >= 0 ? "text-income" : "text-expense")}>
                    {r.marginPercent.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(r.cryptoSheetBalance)}
                    {r.cryptoChangePercent !== null && (
                      <span className={cn("ml-1 text-[10px]", r.cryptoChangePercent >= 0 ? "text-income" : "text-expense")}>
                        ({r.cryptoChangePercent >= 0 ? "+" : ""}{r.cryptoChangePercent.toFixed(1)}%)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// -- Sub-components --

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-fluid-card">
      <h3 className="mb-4 text-sm font-medium text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-fluid-card">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-fluid-number font-bold tabular-nums", className)}>
        {value}
      </p>
    </div>
  );
}
