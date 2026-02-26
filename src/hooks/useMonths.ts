import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Month {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  closed_at: string | null;
  crypto_start: number;
  crypto_end: number;
  created_at: string;
}

export function useMonths() {
  return useQuery({
    queryKey: ["months"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("months")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as Month[];
    },
  });
}

export function useCreateMonth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      start_date: string;
      end_date: string;
      crypto_start: number;
    }) => {
      const { data, error } = await supabase
        .from("months")
        .insert(input)
        .select()
        .single();
      if (error) throw error;

      // Carry forward wallet balances from previous month + set CSB starting from crypto_start
      if (data) {
        const { error: carryError } = await supabase.rpc("carry_forward_wallet_balances" as any, {
          _new_month_id: data.id,
          _crypto_start: input.crypto_start,
        });
        if (carryError) throw carryError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["months"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-starting-balance"] });
      toast({ title: "Month created", description: "New month period has been added." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useCloseMonth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (monthId: string) => {
      const { error } = await supabase.rpc("close_month", { _month_id: monthId });
      if (error) throw error;
      return monthId;
    },
    onSuccess: (monthId) => {
      queryClient.setQueryData<Month[] | undefined>(["months"], (current) =>
        current?.map((month) =>
          month.id === monthId ? { ...month, is_closed: true } : month,
        ),
      );
      queryClient.invalidateQueries({ queryKey: ["months"] });
      queryClient.invalidateQueries({ queryKey: ["monthly_summaries"] });
      queryClient.invalidateQueries({ queryKey: ["person_monthly_summaries"] });
      toast({ title: "Month closed", description: "Summaries generated and month locked." });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["months"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error closing month", description: err.message, variant: "destructive" });
    },
  });
}

export function useUnlockMonth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (monthId: string) => {
      const { error } = await supabase
        .from("months")
        .update({ is_closed: false, closed_at: null })
        .eq("id", monthId);
      if (error) throw error;
      return monthId;
    },
    onSuccess: (monthId) => {
      queryClient.setQueryData<Month[] | undefined>(["months"], (current) =>
        current?.map((month) =>
          month.id === monthId ? { ...month, is_closed: false, closed_at: null } : month,
        ),
      );
      queryClient.invalidateQueries({ queryKey: ["months"] });
      toast({ title: "Month unlocked", description: "Transactions can now be edited again." });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["months"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error unlocking month", description: err.message, variant: "destructive" });
    },
  });
}
