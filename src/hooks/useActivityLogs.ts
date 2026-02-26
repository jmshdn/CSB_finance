import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export function useActivityLogs(targetUserId?: string) {
  const { user, role } = useAuth();
  const userId = targetUserId || user?.id;

  return useQuery({
    queryKey: ["activity-logs", userId],
    queryFn: async () => {
      if (!userId) return [];
      let query = supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (targetUserId && role === "admin") {
        query = query.eq("user_id", targetUserId);
      } else {
        query = query.eq("user_id", userId);
      }

      const { data } = await query;
      return (data ?? []) as ActivityLog[];
    },
    enabled: !!userId,
  });
}

export async function logActivity(userId: string, action: string, details?: string) {
  await supabase.from("activity_logs").insert({
    user_id: userId,
    action,
    details: details ?? null,
  });
}
