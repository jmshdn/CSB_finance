import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Download, TrendingUp } from "lucide-react";
import { useMonth } from "@/contexts/MonthContext";
import { useTransactions } from "@/hooks/useTransactions";

interface EarningRow {
  name: string;
  totalIncome: number;
  totalExpense: number;
  revenue: number;
}

export default function Earnings() {
  const { selectedMonth, selectedMonthId } = useMonth();
  const { data: allTxns = [], isLoading } = useTransactions(selectedMonthId);

  const rows = useMemo<EarningRow[]>(() => {
    const eligible = allTxns.filter(t => {
      if (t.income_expense === "Internal") return false;
      if (t.type === "Withdraw") return false;
      if (t.type === "Internal") return false;
      if (t.person === "Team Expense" || t.person === "Team") return false;
      if (t.income_expense !== "Income" && t.income_expense !== "Expense") return false;
      return true;
    });

    const map = new Map<string, { income: number; expense: number }>();
    for (const t of eligible) {
      const entry = map.get(t.person) ?? { income: 0, expense: 0 };
      if (t.income_expense === "Income") entry.income += t.amount;
      else if (t.income_expense === "Expense") entry.expense += Math.abs(t.amount);
      map.set(t.person, entry);
    }

    const result: EarningRow[] = [];
    for (const [name, { income, expense }] of map) {
      result.push({ name, totalIncome: income, totalExpense: expense, revenue: income - expense });
    }
    result.sort((a, b) => b.revenue - a.revenue);
    return result;
  }, [allTxns]);

  const totals = useMemo(() => {
    const income = rows.reduce((s, r) => s + r.totalIncome, 0);
    const expense = rows.reduce((s, r) => s + r.totalExpense, 0);
    return { income, expense, revenue: income - expense };
  }, [rows]);

  const exportCSV = () => {
    const header = "Member,Total Income,Total Expense,Revenue\n";
    const csvRows = rows.map(r =>
      `${r.name},${r.totalIncome.toFixed(2)},${r.totalExpense.toFixed(2)},${r.revenue.toFixed(2)}`
    ).join("\n");
    const blob = new Blob([header + csvRows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `member-earnings.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading earnings…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Member Earnings
          </h2>
          <p className="text-sm text-muted-foreground">
            {selectedMonth?.name ?? "Select month"} · {rows.length} members
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 w-8">#</th>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3 text-right">Total Income</th>
              <th className="px-4 py-3 text-right">Total Expense</th>
              <th className="px-4 py-3 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No earnings data for this period.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.name} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                  <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    <Link to={`/person/${encodeURIComponent(r.name)}`} className="hover:text-primary underline-offset-2 hover:underline transition-colors">
                      {r.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-income">
                    {formatCurrency(r.totalIncome)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-expense">
                    {formatCurrency(r.totalExpense)}
                  </td>
                  <td className={cn(
                    "whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums text-base",
                    r.revenue > 0 && "text-income",
                    r.revenue < 0 && "text-expense",
                    r.revenue === 0 && "text-muted-foreground",
                  )}>
                    {formatCurrency(r.revenue)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-foreground">Total</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-income">
                  {formatCurrency(totals.income)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-expense">
                  {formatCurrency(totals.expense)}
                </td>
                <td className={cn(
                  "whitespace-nowrap px-4 py-3 text-right tabular-nums text-base",
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