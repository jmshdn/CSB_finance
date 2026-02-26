import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getServerDateOnlyNow } from "@/lib/format";

export function useWalletStartingBalance(wallet: string, monthId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["wallet-starting-balance", wallet, monthId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!monthId) return { starting_amount: 0, carry_forward_amount: 0, real_balance: null, real_balance_date: null };
      const { data, error } = await supabase
        .from("wallet_starting_balances" as any)
        .select("starting_amount, carry_forward_amount, real_balance, real_balance_date")
        .eq("month_id", monthId)
        .eq("wallet", wallet)
        .maybeSingle();
      if (error) throw error;
      return {
        starting_amount: (data as any)?.starting_amount ?? 0,
        carry_forward_amount: (data as any)?.carry_forward_amount ?? 0,
        real_balance: (data as any)?.real_balance ?? null,
        real_balance_date: (data as any)?.real_balance_date ?? null,
      };
    },
    enabled: !!monthId && !!wallet,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["wallet-starting-balance", wallet, monthId] });

  const upsertMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!monthId) throw new Error("No month selected");
      const { error } = await supabase
        .from("wallet_starting_balances" as any)
        .upsert(
          { month_id: monthId, wallet, starting_amount: amount } as any,
          { onConflict: "month_id,wallet" }
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const upsertRealBalance = useMutation({
    mutationFn: async (amount: number) => {
      if (!monthId) throw new Error("No month selected");
      const today = getServerDateOnlyNow();
      const { error } = await supabase
        .from("wallet_starting_balances" as any)
        .upsert(
          { month_id: monthId, wallet, real_balance: amount, real_balance_date: today } as any,
          { onConflict: "month_id,wallet" }
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    startingAmount: query.data?.starting_amount ?? 0,
    carryForwardAmount: query.data?.carry_forward_amount ?? 0,
    realBalance: query.data?.real_balance as number | null,
    realBalanceDate: query.data?.real_balance_date as string | null,
    isLoading: query.isLoading,
    upsert: upsertMutation.mutate,
    isUpserting: upsertMutation.isPending,
    upsertRealBalance: upsertRealBalance.mutate,
    isUpsertingReal: upsertRealBalance.isPending,
  };
}
