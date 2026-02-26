import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CustomCategory {
  id: string;
  name: string;
  type: string;
}

export function useCustomCategories() {
  const queryClient = useQueryClient();

  const { data: customCategories = [], isLoading } = useQuery({
    queryKey: ["custom-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as CustomCategory[];
    },
  });

  const addCategory = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: string }) => {
      const { error } = await supabase
        .from("custom_categories")
        .insert({ name: name.trim(), type });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-categories"] }),
  });

  const incomeCategories = customCategories.filter(c => c.type === "Income").map(c => c.name);
  const expenseCategories = customCategories.filter(c => c.type === "Expense").map(c => c.name);

  return { customCategories, incomeCategories, expenseCategories, addCategory, isLoading };
}
