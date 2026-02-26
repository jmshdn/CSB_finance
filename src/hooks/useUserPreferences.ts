import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserPreferences {
  id: string;
  user_id: string;
  theme: string;
  accent_color: string;
  compact_mode: boolean;
  default_landing_page: string;
  default_month: string | null;
  currency_format: string;
  table_density: string;
  dashboard_layout: string;
}

const defaults: Omit<UserPreferences, "id" | "user_id"> = {
  theme: "system",
  accent_color: "blue",
  compact_mode: false,
  default_landing_page: "/overview",
  default_month: null,
  currency_format: "USD",
  table_density: "normal",
  dashboard_layout: "default",
};

export function useUserPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["user-preferences", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!data) {
        // Create default preferences
        const { data: newData } = await supabase
          .from("user_preferences")
          .insert({ user_id: user.id, ...defaults })
          .select()
          .single();
        return newData as UserPreferences;
      }
      return data as UserPreferences;
    },
    enabled: !!user,
  });

  const updatePreferences = useMutation({
    mutationFn: async (updates: Partial<Omit<UserPreferences, "id" | "user_id">>) => {
      if (!user) return;
      await supabase
        .from("user_preferences")
        .update(updates)
        .eq("user_id", user.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-preferences"] }),
  });

  return { preferences, isLoading, updatePreferences };
}
