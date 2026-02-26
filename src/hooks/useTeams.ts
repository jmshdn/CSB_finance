import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TEAMS } from "@/lib/constants";

/**
 * Fetches all team names from the `teams` table (excluding CSB),
 * merges with the static TEAMS constant as fallback, and returns a sorted, deduplicated list.
 */
export function useTeams() {
  return useQuery({
    queryKey: ["teams_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("name")
        .neq("name", "CSB");
      if (error) throw error;
      const dbTeams = new Set((data ?? []).map(d => d.name));
      // Merge with static fallback
      for (const t of TEAMS) dbTeams.add(t);
      return Array.from(dbTeams).sort();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Non-hook utility: merge static + DB teams from already-fetched teamPersons data */
export function mergeTeams(dbTeams: string[]): string[] {
  const set = new Set(dbTeams);
  for (const t of TEAMS) set.add(t);
  return Array.from(set).sort();
}
