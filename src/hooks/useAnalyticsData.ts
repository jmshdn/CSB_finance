import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AnalyticsRow {
  month: string;
  monthId: string;
  startDate: string;
  income: number;
  expense: number;
  baseFee: number;
  cryptoStart: number;
  cryptoEnd: number;
  cryptoSheetBalance: number;
  netProfit: number;
  marginPercent: number;
  cryptoChangePercent: number | null;
}

export function useAnalyticsData() {
  return useQuery({
    queryKey: ["analytics-data"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [
        { data: months, error: mErr },
        { data: summaries, error: sErr },
        { data: wsbRows, error: wErr },
        { data: csbTxs, error: tErr },
      ] = await Promise.all([
        supabase
          .from("months")
          .select("id, name, start_date, crypto_start, crypto_end")
          .order("start_date", { ascending: true }),
        supabase
          .from("monthly_summaries")
          .select("month_id, total_income, total_expense, base_fee, crypto_start, crypto_end"),
        supabase
          .from("wallet_starting_balances")
          .select("month_id, starting_amount")
          .eq("wallet", "CSB"),
        supabase
          .from("transactions")
          .select("month_id, amount, settlement_status, income_expense")
          .eq("team", "CSB")
          .neq("income_expense", "Cash"),
      ]);
      if (mErr) throw mErr;
      if (sErr) throw sErr;
      if (wErr) throw wErr;
      if (tErr) throw tErr;

      const summaryMap = new Map(
        summaries.map((s) => [s.month_id, s])
      );

      // CSB starting balances per month
      const csbStartMap = new Map(
        (wsbRows ?? []).map((w) => [w.month_id, w.starting_amount ?? 0])
      );

      // CSB net transactions per month (excluding pending settlements)
      const csbNetMap = new Map<string, number>();
      for (const tx of csbTxs ?? []) {
        if (!tx.month_id) continue;
        if (tx.settlement_status === "Pending") continue;
        csbNetMap.set(tx.month_id, (csbNetMap.get(tx.month_id) ?? 0) + tx.amount);
      }

      let prevSheetBal: number | null = null;
      const rows: AnalyticsRow[] = [];

      for (const m of months ?? []) {
        const s = summaryMap.get(m.id);
        const income = s?.total_income ?? 0;
        const expense = -(s?.total_expense ?? 0);
        const baseFee = -(s?.base_fee ?? 0);
        const crypto = m.crypto_start ?? 0;

        const netProfit = income + expense + baseFee;
        const marginPercent = income > 0 ? (netProfit / income) * 100 : 0;

        // Sheet balance w/o pending = CSB starting + non-pending CSB txs
        const csbStart = csbStartMap.get(m.id) ?? 0;
        const csbNet = csbNetMap.get(m.id) ?? 0;
        const cryptoSheetBalance = csbStart + csbNet;

        let cryptoChangePercent: number | null = null;
        if (prevSheetBal !== null && prevSheetBal > 0) {
          cryptoChangePercent = ((cryptoSheetBalance - prevSheetBal) / prevSheetBal) * 100;
        }
        prevSheetBal = cryptoSheetBalance;

        rows.push({
          month: m.name,
          monthId: m.id,
          startDate: m.start_date,
          income,
          expense: Math.abs(expense),
          baseFee: Math.abs(baseFee),
          cryptoStart: crypto,
          cryptoEnd: m.crypto_end ?? 0,
          cryptoSheetBalance,
          netProfit,
          marginPercent,
          cryptoChangePercent,
        });
      }

      return rows;
    },
  });
}
