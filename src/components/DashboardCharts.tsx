import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import { formatCurrency } from "@/lib/format";

const CHART_COLORS = {
  income: "hsl(152, 60%, 40%)",
  expense: "hsl(0, 65%, 50%)",
};

const PIE_COLORS = ["hsl(215,60%,50%)", "hsl(152,60%,40%)", "hsl(0,65%,50%)", "hsl(45,80%,50%)", "hsl(280,50%,50%)"];

interface TeamPerfData {
  team: string;
  income: number;
  expense: number;
}

interface MonthlyComparisonData {
  month: string;
  income: number;
  expense: number;
  netProfit: number;
}

export function TeamPerformanceChart({ data }: { data: TeamPerfData[] }) {
  const chartData = data.map(t => ({
    team: t.team,
    income: Math.round(t.income),
    expense: Math.round(t.expense),
  }));

  return (
    <div className="rounded-lg border bg-card p-3">
      <h3 className="mb-2 text-sm font-medium text-foreground">Team Performance Comparison</h3>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,90%)" />
          <XAxis dataKey="team" tick={{ fontSize: 12, fill: "hsl(220,10%,46%)" }} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(220,10%,46%)" }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ background: "hsl(0,0%,100%)", border: "1px solid hsl(220,13%,91%)", borderRadius: 8, fontSize: 12 }}
            formatter={(value: number) => formatCurrency(value)}
          />
          <Bar dataKey="income" fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} name="Income" />
          <Bar dataKey="expense" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} name="Expense" />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[10px] text-muted-foreground">* Aggregated by member across all wallets</p>
    </div>
  );
}

function MiniPieChart({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <div className="min-w-0 rounded-md bg-background/40 p-2">
      <h4 className="mb-1 text-xs font-medium text-muted-foreground">{title}</h4>
      <div className="grid items-center gap-2 sm:grid-cols-[minmax(128px,148px)_minmax(0,1fr)]">
        <div className="mx-auto h-32 w-32 sm:h-36 sm:w-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={52} paddingAngle={2}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(0,0%,100%)", border: "1px solid hsl(220,13%,91%)", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number) => formatCurrency(value)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="font-medium text-foreground">{formatCurrency(d.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DistributionCharts({ expenseData, incomeData }: { expenseData: { name: string; value: number }[]; incomeData: { name: string; value: number }[] }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <h3 className="mb-2 text-sm font-medium text-foreground">Distribution by Team</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <MiniPieChart title="Expense" data={expenseData} />
        <MiniPieChart title="Income" data={incomeData} />
      </div>
    </div>
  );
}

export function MonthlyComparisonChart({ data }: { data: MonthlyComparisonData[] }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <h3 className="mb-2 text-sm font-medium text-foreground">Monthly Comparison</h3>
      {data.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">No month data available.</div>
      ) : (
        <ResponsiveContainer width="100%" height={196}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,90%)" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(220,10%,46%)" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(220,10%,46%)" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: "hsl(0,0%,100%)", border: "1px solid hsl(220,13%,91%)", borderRadius: 8, fontSize: 12 }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="income" stroke="hsl(152,60%,40%)" strokeWidth={2} dot={{ r: 2 }} name="Income" />
            <Line type="monotone" dataKey="expense" stroke="hsl(0,65%,50%)" strokeWidth={2} dot={{ r: 2 }} name="Expense" />
            <Line type="monotone" dataKey="netProfit" stroke="hsl(215,60%,50%)" strokeWidth={2} dot={{ r: 2 }} name="Net" />
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">* Includes all available months</p>
    </div>
  );
}
