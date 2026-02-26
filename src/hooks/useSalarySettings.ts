import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SalarySettings {
  id: string;
  month_id: string;
  base_fee_per_person: number;
  team_target: number;
  base_rate: number;
  below_target_rate: number;
  top_performer_rate: number;
  created_at: string;
}

const DEFAULTS: Omit<SalarySettings, "id" | "month_id" | "created_at"> = {
  base_fee_per_person: 0,
  team_target: 2500,
  base_rate: 0.15,
  below_target_rate: 0.13,
  top_performer_rate: 0.17,
};

export function useSalarySettings(monthId: string | null) {
  return useQuery({
    queryKey: ["salary_settings", monthId],
    enabled: !!monthId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_settings")
        .select("*")
        .eq("month_id", monthId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { ...DEFAULTS, month_id: monthId! } as SalarySettings;
      return data as SalarySettings;
    },
  });
}

export function useUpsertSalarySettings() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      month_id: string;
      base_fee_per_person: number;
      team_target: number;
      base_rate: number;
      below_target_rate: number;
      top_performer_rate: number;
    }) => {
      const { data, error } = await supabase
        .from("salary_settings")
        .upsert(input, { onConflict: "month_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["salary_settings", vars.month_id] });
      toast({ title: "Settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export { DEFAULTS as SALARY_DEFAULTS };
