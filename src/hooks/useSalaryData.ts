import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PersonSalaryBalance {
  id: string;
  person: string;
  month_id: string;
  carry_forward_deficit: number;
  created_at: string;
}

export function usePersonSalaryBalances(monthId: string | null) {
  return useQuery({
    queryKey: ["person_salary_balances", monthId],
    enabled: !!monthId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("person_salary_balances")
        .select("*")
        .eq("month_id", monthId!);
      if (error) throw error;
      return (data ?? []) as PersonSalaryBalance[];
    },
  });
}

/** Fetch deficits from previous month based on month ordering */
export function usePreviousMonthDeficits(
  currentMonthId: string | null,
  months: { id: string; start_date: string }[]
) {
  // Find previous month id
  const sorted = [...months].sort(
    (a, b) => a.start_date.localeCompare(b.start_date)
  );
  const idx = sorted.findIndex((m) => m.id === currentMonthId);
  const prevMonthId = idx > 0 ? sorted[idx - 1].id : null;

  return useQuery({
    queryKey: ["person_salary_balances", prevMonthId],
    enabled: !!prevMonthId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("person_salary_balances")
        .select("*")
        .eq("month_id", prevMonthId!);
      if (error) throw error;
      return (data ?? []) as PersonSalaryBalance[];
    },
  });
}
