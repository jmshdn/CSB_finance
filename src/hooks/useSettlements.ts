import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { DbTransaction } from "./useTransactions";
import { getServerDateOnlyNow } from "@/lib/format";

const FIVE_MINUTES = 5 * 60 * 1000;

export function usePendingSettlements() {
  return useQuery({
    queryKey: ["settlements", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("settlement_status", "Pending")
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DbTransaction[];
    },
    staleTime: FIVE_MINUTES,
  });
}

export function useAllSettlements() {
  return useQuery({
    queryKey: ["settlements", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .not("settlement_status", "is", null)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DbTransaction[];
    },
    staleTime: FIVE_MINUTES,
  });
}

export function useSettleTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      transaction,
      settledAmount,
      currentMonthId,
    }: {
      transaction: DbTransaction;
      settledAmount: number;
      currentMonthId: string;
    }) => {
      // 1. Update original transaction
      const { error: updateError } = await supabase
        .from("transactions")
        .update({
          settlement_status: "Settled",
          settled_amount: settledAmount,
          settlement_month_id: currentMonthId,
        })
        .eq("id", transaction.id);
      if (updateError) throw updateError;

      // 2. Create adjustment if difference exists
      const difference = transaction.amount - settledAmount;
      if (Math.abs(difference) > 0.01) {
        const { error: adjError } = await supabase
          .from("transactions")
          .insert({
            date: getServerDateOnlyNow(),
            team: transaction.team,
            income_expense: difference > 0 ? "Expense" : "Income",
            type: "Settlement Adjustment",
            person: transaction.person,
            note: `Settlement adjustment for ${transaction.transaction_id} (earned $${transaction.amount}, settled $${settledAmount})`,
            amount: -difference,
            transaction_id: `${transaction.transaction_id}-SA`,
            category: "Settlement Adjustment",
            month_id: currentMonthId,
            original_transaction_id: transaction.id,
            settlement_status: "Settled",
            source_type: transaction.source_type,
          });
        if (adjError) throw adjError;
      }
    },
    onMutate: async ({ transaction }) => {
      await queryClient.cancelQueries({ queryKey: ["settlements"] });

      // Optimistically mark as "Processing" in settlement caches
      const prevAll = queryClient.getQueryData<DbTransaction[]>(["settlements", "all"]);
      const prevPending = queryClient.getQueryData<DbTransaction[]>(["settlements", "pending"]);

      if (prevAll) {
        queryClient.setQueryData<DbTransaction[]>(["settlements", "all"],
          prevAll.map(t => t.id === transaction.id ? { ...t, settlement_status: "Processing" } : t)
        );
      }
      if (prevPending) {
        queryClient.setQueryData<DbTransaction[]>(["settlements", "pending"],
          prevPending.map(t => t.id === transaction.id ? { ...t, settlement_status: "Processing" } : t)
        );
      }

      return { prevAll, prevPending };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      toast({ title: "Settlement recorded", description: "Transaction has been settled." });
    },
    onError: (err: Error, _vars, context) => {
      // Rollback
      if (context?.prevAll !== undefined) {
        queryClient.setQueryData(["settlements", "all"], context.prevAll);
      }
      if (context?.prevPending !== undefined) {
        queryClient.setQueryData(["settlements", "pending"], context.prevPending);
      }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

/** Edit the settled amount on a Settlement Adjustment — updates adjustment amount + original's settled_amount */
export function useEditSettlementAdjustment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      adjustment,
      newSettledAmount,
    }: {
      adjustment: DbTransaction;
      newSettledAmount: number;
    }) => {
      if (!adjustment.original_transaction_id) throw new Error("No linked original transaction");

      // Fetch original transaction to get original earned amount
      const { data: original, error: fetchErr } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", adjustment.original_transaction_id)
        .single();
      if (fetchErr || !original) throw new Error("Original transaction not found");

      const earnedAmount = original.amount;
      const difference = earnedAmount - newSettledAmount;

      // Update original transaction's settled_amount
      const { error: origErr } = await supabase
        .from("transactions")
        .update({ settled_amount: newSettledAmount })
        .eq("id", adjustment.original_transaction_id);
      if (origErr) throw origErr;

      if (Math.abs(difference) > 0.01) {
        // Update adjustment transaction
        const { error: adjErr } = await supabase
          .from("transactions")
          .update({
            amount: -difference,
            income_expense: difference > 0 ? "Expense" : "Income",
            note: `Settlement adjustment for ${original.transaction_id} (earned $${earnedAmount}, settled $${newSettledAmount})`,
          })
          .eq("id", adjustment.id);
        if (adjErr) throw adjErr;
      } else {
        // No difference anymore — delete the adjustment
        const { error: delErr } = await supabase
          .from("transactions")
          .delete()
          .eq("id", adjustment.id);
        if (delErr) throw delErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      toast({ title: "Settlement updated", description: "Adjustment has been recalculated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

/** Delete a Settlement Adjustment — reverts original transaction back to Pending */
export function useDeleteSettlementAdjustment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ adjustment }: { adjustment: DbTransaction }) => {
      if (!adjustment.original_transaction_id) throw new Error("No linked original transaction");

      // Revert original transaction to Pending
      const { error: revertErr } = await supabase
        .from("transactions")
        .update({
          settlement_status: "Pending",
          settled_amount: null,
          settlement_month_id: null,
        })
        .eq("id", adjustment.original_transaction_id);
      if (revertErr) throw revertErr;

      // Delete the adjustment transaction
      const { error: delErr } = await supabase
        .from("transactions")
        .delete()
        .eq("id", adjustment.id);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      toast({ title: "Settlement reverted", description: "Original transaction is now pending again." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}
