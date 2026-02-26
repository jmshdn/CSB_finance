import { useMemo, useRef } from "react";
import { PersonName } from "@/components/PersonName";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, TrendingUp, TrendingDown, DollarSign, Users, Printer } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useTeams } from "@/hooks/useTeams";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useMonth } from "@/contexts/MonthContext";
import { useQuery } from "@tanstack/react-query";
import type { DbTransaction } from "@/hooks/useTransactions";

interface FinanceReportProps {
  transactions: DbTransaction[];
  month: { name: string; start_date: string; end_date: string; crypto_start: number; crypto_end: number; is_closed: boolean } | null;
  teamToPersons: Map<string, string[]>;
}

type WalletStartingBalance = {
  wallet: string;
  starting_amount: number;
  real_balance: number | null;
};

type TeamStat = {
  team: string;
  members: number;
  income: number;
  expense: number;
  net: number;
  avgIncome: number;
  avgExpense: number;
  avgNet: number;
};

type PerformerStat = {
  person: string;
  income: number;
  expense: number;
  net: number;
};

type ReportData = {
  totalIncome: number;
  totalExpense: number;
  totalBaseFee: number;
  netIncome: number;
  txCount: number;
  incomeByType: Record<string, number>;
  expenseByType: Record<string, number>;
  teamStats: TeamStat[];
  allPerformers: PerformerStat[];
  totalOpeningBalance: number;
  totalEndingBalance: number;
  totalNetTransactions: number;
  totalRealBalance: number;
  hasRealBalance: boolean;
};

export default function FinanceReport({ transactions, month, teamToPersons }: FinanceReportProps) {
  const { selectedMonthId } = useMonth();
  const { data: rawTeams = [] } = useTeams();
  const teams = useMemo(() => rawTeams.filter((team): team is string => typeof team === "string"), [rawTeams]);
  const allWallets = useMemo(() => ["CSB", ...teams], [teams]);
  const { data: walletBalances = [] } = useQuery<WalletStartingBalance[]>({
    queryKey: ["all-wallet-starting-balances", selectedMonthId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!selectedMonthId) return [];
      const { data, error } = await supabase
        .from("wallet_starting_balances")
        .select("wallet, starting_amount, real_balance")
        .eq("month_id", selectedMonthId);
      if (error) throw error;
      return (data ?? []) as WalletStartingBalance[];
    },
    enabled: !!selectedMonthId,
  });
  const reportRef = useRef<HTMLDivElement>(null);

  const report = useMemo<ReportData>(() => {
    const ops = transactions.filter(t => t.income_expense !== "Cash");

    // Overall
    const totalIncome = ops.filter(t => t.income_expense === "Income").reduce((s, t) => s + t.amount, 0);
    const totalBaseFee = ops.filter(t => t.type === "Base fee").reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalExpense = ops.filter(t => t.income_expense === "Expense" && t.type !== "Base fee").reduce((s, t) => s + Math.abs(t.amount), 0);
    const netIncome = totalIncome - totalExpense - totalBaseFee;
    const txCount = ops.length;

    // By income type
    const incomeByType: Record<string, number> = {};
    ops.filter(t => t.income_expense === "Income").forEach(t => {
      incomeByType[t.type] = (incomeByType[t.type] ?? 0) + t.amount;
    });

    // By expense type (excluding base fee separately)
    const expenseByType: Record<string, number> = {};
    ops.filter(t => t.income_expense === "Expense").forEach(t => {
      expenseByType[t.type] = (expenseByType[t.type] ?? 0) + Math.abs(t.amount);
    });

    // Team breakdown
    const teamStats = teams.map(team => {
      const members = teamToPersons.get(team) ?? [];
      const memberTxns = ops.filter(t => {
        if (t.income_expense !== "Income" && t.income_expense !== "Expense") return false;
        if (t.type === "Withdraw" || t.type === "Internal") return false;
        if (t.person === "Team Expense" || t.person === "Team") return false;
        return members.includes(t.person);
      });
      const income = memberTxns.filter(t => t.income_expense === "Income").reduce((s, t) => s + t.amount, 0);
      const expense = memberTxns.filter(t => t.income_expense === "Expense").reduce((s, t) => s + Math.abs(t.amount), 0);
      const net = income - expense;
      const avgIncome = members.length > 0 ? income / members.length : 0;
      const avgExpense = members.length > 0 ? expense / members.length : 0;
      const avgNet = members.length > 0 ? net / members.length : 0;
      return { team, members: members.length, income, expense, net, avgIncome, avgExpense, avgNet };
    }).sort((a, b) => b.avgNet - a.avgNet);

    // Top performers (by person revenue)
    const personRevenue: Record<string, { income: number; expense: number }> = {};
    ops.filter(t => {
      if (t.income_expense !== "Income" && t.income_expense !== "Expense") return false;
      if (t.type === "Withdraw" || t.type === "Internal") return false;
      if (["Team Expense", "Team", "Internal", "All"].includes(t.person)) return false;
      return true;
    }).forEach(t => {
      if (!personRevenue[t.person]) personRevenue[t.person] = { income: 0, expense: 0 };
      if (t.income_expense === "Income") personRevenue[t.person].income += t.amount;
      else personRevenue[t.person].expense += Math.abs(t.amount);
    });

    const allPerformers = Object.entries(personRevenue)
      .map(([person, r]) => ({ person, income: r.income, expense: r.expense, net: r.income - r.expense }))
      .sort((a, b) => b.net - a.net);

    // Whole-team wallet summary (all wallets combined)
    const totalOpeningBalance = walletBalances.reduce((s, w) => s + (w.starting_amount ?? 0), 0);

    // Per-wallet net transactions
    const walletNets: Record<string, number> = {};
    for (const wallet of allWallets) walletNets[wallet] = 0;
    for (const t of transactions) {
      if (t.team && walletNets[t.team] !== undefined) {
        walletNets[t.team] += t.amount;
      }
    }

    const totalNetTransactions = Object.values(walletNets).reduce((s, v) => s + v, 0);
    const totalEndingBalance = totalOpeningBalance + totalNetTransactions;
    const totalRealBalance = walletBalances.reduce((s, w) => s + (w.real_balance ?? 0), 0);
    const hasRealBalance = walletBalances.some(w => w.real_balance !== null);

    return {
      totalIncome, totalExpense, totalBaseFee, netIncome, txCount,
      incomeByType, expenseByType, teamStats, allPerformers,
      totalOpeningBalance, totalEndingBalance, totalNetTransactions, totalRealBalance, hasRealBalance,
    };
  }, [allWallets, teamToPersons, teams, transactions, walletBalances]);

  const handlePrint = () => {
    const content = reportRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Finance Report — ${month?.name}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px; color: #1a1a2e; font-size: 13px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 15px; margin: 20px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        h3 { font-size: 13px; margin: 12px 0 6px; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        th, td { text-align: left; padding: 5px 10px; border-bottom: 1px solid #f0f0f0; font-size: 12px; }
        th { font-weight: 600; background: #f9fafb; }
        .right { text-align: right; }
        .green { color: #22815a; }
        .red { color: #dc2626; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 12px 0; }
        .summary-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
        .summary-card .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
        .summary-card .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
        .badge-closed { background: #dcfce7; color: #166534; }
        .badge-open { background: #fef3c7; color: #92400e; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
        @media print { body { padding: 16px; } }
      </style></head><body>
      ${content.innerHTML}
      <div class="footer">Generated on ${formatDateTime(new Date())} — CSB Finance System</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className="gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-md hover:shadow-lg transition-all"
          size="sm"
        >
          <FileText className="h-4 w-4" />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">Finance Report</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {month?.name} ({month?.start_date} — {month?.end_date})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={month?.is_closed ? "default" : "outline"} className="text-[10px]">
                {month?.is_closed ? "Closed" : "Open"}
              </Badge>
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div ref={reportRef} className="space-y-6 mt-2">
          {/* Header for print */}
          <div className="hidden print:block">
            <h1>CSB Finance Report — {month?.name}</h1>
            <p>Period: {month?.start_date} — {month?.end_date} <span className={`badge ${month?.is_closed ? 'badge-closed' : 'badge-open'}`}>{month?.is_closed ? 'CLOSED' : 'OPEN'}</span></p>
          </div>

          {/* ===== EXECUTIVE SUMMARY ===== */}
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <DollarSign className="h-4 w-4 text-primary" /> Executive Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard label="Total Income" value={formatCurrency(report.totalIncome)} variant="income" />
              <SummaryCard label="Total Expense" value={formatCurrency(report.totalExpense)} variant="expense" />
              <SummaryCard label="Net Income" value={formatCurrency(report.netIncome)} variant={report.netIncome >= 0 ? "income" : "expense"} />
              <SummaryCard label="Total Base Fee" value={formatCurrency(report.totalBaseFee)} variant="neutral" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">{report.txCount} transactions processed</p>
          </div>

          <Separator />

          {/* ===== INCOME BREAKDOWN ===== */}
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <TrendingUp className="h-4 w-4 text-income" /> Income Breakdown
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(report.incomeByType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, amount]) => (
                    <tr key={type} className="border-b last:border-0">
                      <td className="px-3 py-2">{type}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-income font-medium">{formatCurrency(amount)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {report.totalIncome > 0 ? ((amount / report.totalIncome) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* ===== EXPENSE BREAKDOWN ===== */}
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <TrendingDown className="h-4 w-4 text-expense" /> Expense Breakdown
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(report.expenseByType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, amount]) => (
                    <tr key={type} className="border-b last:border-0">
                      <td className="px-3 py-2">{type}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-expense font-medium">{formatCurrency(amount)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {report.totalExpense > 0 ? ((amount / report.totalExpense) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <Separator />

          {/* ===== TEAM PERFORMANCE ===== */}
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <Users className="h-4 w-4 text-primary" /> Team Performance (Ranked by Avg Net)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Team</th>
                    <th className="px-3 py-2 text-right">Members</th>
                    <th className="px-3 py-2 text-right">Income</th>
                    <th className="px-3 py-2 text-right">Expense</th>
                    <th className="px-3 py-2 text-right">Net</th>
                    <th className="px-3 py-2 text-right">Avg/Member</th>
                  </tr>
                </thead>
                <tbody>
                  {report.teamStats.map((t, i) => (
                    <tr key={t.team} className="border-b last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{t.team}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{t.members}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-income">{formatCurrency(t.income)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-expense">{formatCurrency(t.expense)}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums font-medium", t.net >= 0 ? "text-income" : "text-expense")}>
                        {formatCurrency(t.net)}
                      </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums font-medium", t.avgNet >= 0 ? "text-income" : "text-expense")}>
                        {formatCurrency(t.avgNet)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Separator />

          {/* ===== ALL PERFORMERS ===== */}
          <div>
            <h2 className="text-sm font-semibold mb-3">🏆 Individual Performance ({report.allPerformers.length} members)</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Person</th>
                  <th className="px-3 py-2 text-right">Income</th>
                  <th className="px-3 py-2 text-right">Expense</th>
                  <th className="px-3 py-2 text-right">Net Revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.allPerformers.map((p, i) => {
                  // Find team for this person
                  let personTeam = "—";
                  teamToPersons.forEach((members, team) => {
                    if (members.includes(p.person)) personTeam = team;
                  });
                  return (
                  <tr key={p.person} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">
                      <PersonName name={p.person} team={personTeam} linkable={false} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-income">{formatCurrency(p.income)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-expense">{formatCurrency(p.expense)}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums font-medium", p.net >= 0 ? "text-income" : "text-expense")}>
                      {formatCurrency(p.net)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Separator />

          {/* ===== OVERALL WALLET SUMMARY ===== */}
          <div>
            <h2 className="text-sm font-semibold mb-3">🏦 Overall Wallet Summary (All Teams)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <SummaryCard label="Total Opening Balance" value={formatCurrency(report.totalOpeningBalance)} variant="neutral" />
              <SummaryCard label="Total Expenses" value={formatCurrency(report.totalExpense)} variant="expense" />
              <SummaryCard label="Base Fee Paid" value={formatCurrency(report.totalBaseFee)} variant="expense" />
              <SummaryCard label="Net Transactions" value={formatCurrency(report.totalNetTransactions)} variant={report.totalNetTransactions >= 0 ? "income" : "expense"} />
              <SummaryCard label="Sheet Ending Balance" value={formatCurrency(report.totalEndingBalance)} variant={report.totalEndingBalance >= 0 ? "income" : "expense"} />
              {report.hasRealBalance && (
                <SummaryCard label="Total Real Balance" value={formatCurrency(report.totalRealBalance)} variant="neutral" />
              )}
            </div>
          </div>

          <Separator />

          {/* ===== ANALYTICAL SUMMARY ===== */}
          <div>
            <h2 className="text-sm font-semibold mb-3">📋 Analytical Summary</h2>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed space-y-2">
              <p>
                In <strong>{month?.name}</strong>, operations generated{" "}
                <strong className="text-income">{formatCurrency(report.totalIncome)}</strong> in revenue across{" "}
                <strong>{report.txCount}</strong> transactions, with{" "}
                <strong className="text-expense">{formatCurrency(report.totalExpense)}</strong> in total outflows—yielding a{" "}
                {report.netIncome >= 0 ? "net surplus" : "net deficit"} of{" "}
                <strong className={report.netIncome >= 0 ? "text-income" : "text-expense"}>
                  {formatCurrency(Math.abs(report.netIncome))}
                </strong>{" "}
                ({report.totalIncome > 0 ? ((report.netIncome / report.totalIncome) * 100).toFixed(1) : "0"}% margin).
                Base fees of <strong className="text-expense">{formatCurrency(report.totalBaseFee)}</strong> were paid out,
                accounting for {report.totalExpense > 0 ? ((report.totalBaseFee / report.totalExpense) * 100).toFixed(1) : "0"}% of total expenses.
              </p>
              <p>
                {report.teamStats.length > 0 && (() => {
                  const top = report.teamStats[0];
                  const bottom = report.teamStats[report.teamStats.length - 1];
                  const teamsAboveZero = report.teamStats.filter(t => t.net > 0).length;
                  return (
                    <>
                      <strong>{teamsAboveZero}</strong> of {report.teamStats.length} teams operated profitably.{" "}
                      <strong>{top.team}</strong> led with{" "}
                      <strong className="text-income">{formatCurrency(top.avgNet)}</strong>/member avg net revenue
                      {report.teamStats.length > 1 && bottom.team !== top.team && (
                        <>, while <strong>{bottom.team}</strong> trailed at{" "}
                        <strong className={bottom.avgNet >= 0 ? "text-income" : "text-expense"}>
                          {formatCurrency(bottom.avgNet)}
                        </strong>/member</>
                      )}
                      —a spread of <strong>{formatCurrency(Math.abs(top.avgNet - bottom.avgNet))}</strong>.
                    </>
                  );
                })()}
              </p>
              <p>
                {report.allPerformers.length > 0 && (() => {
                  const top = report.allPerformers[0];
                  const profitable = report.allPerformers.filter(p => p.net > 0).length;
                  const avgRevenue = report.allPerformers.reduce((s, p) => s + p.net, 0) / report.allPerformers.length;
                  return (
                    <>
                      Of <strong>{report.allPerformers.length}</strong> active members,{" "}
                      <strong>{profitable}</strong> ({((profitable / report.allPerformers.length) * 100).toFixed(0)}%) were net-positive.{" "}
                      Top performer <strong>{top.person}</strong> contributed{" "}
                      <strong className="text-income">{formatCurrency(top.net)}</strong> in net revenue.{" "}
                      The organization-wide average was{" "}
                      <strong className={avgRevenue >= 0 ? "text-income" : "text-expense"}>
                        {formatCurrency(avgRevenue)}
                      </strong>/member.
                    </>
                  );
                })()}
              </p>
              <p>
                Overall wallets opened at{" "}
                <strong>{formatCurrency(report.totalOpeningBalance)}</strong> and closed at{" "}
                <strong className={report.totalEndingBalance >= 0 ? "text-income" : "text-expense"}>
                  {formatCurrency(report.totalEndingBalance)}
                </strong>{" "}
                ({report.totalEndingBalance >= report.totalOpeningBalance ? "+" : ""}{formatCurrency(report.totalEndingBalance - report.totalOpeningBalance)}).
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value, variant }: { label: string; value: string; variant: "income" | "expense" | "neutral" }) {
  return (
    <div className="rounded-lg border bg-card p-fluid-card">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn(
        "mt-1 text-fluid-number font-bold tabular-nums",
        variant === "income" && "text-income",
        variant === "expense" && "text-expense",
        variant === "neutral" && "text-foreground",
      )}>
        {value}
      </p>
    </div>
  );
}
