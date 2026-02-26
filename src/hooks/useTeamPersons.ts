import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeamPerson {
  team: string;
  person_name: string;
}

export function useTeamPersons(includeCSB = false) {
  return useQuery({
    queryKey: ["team_persons", includeCSB],
    queryFn: async () => {
      let query = supabase.from("team_persons").select("team, person_name");
      if (!includeCSB) query = query.neq("team", "CSB");
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as TeamPerson[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Build a map: person_name -> team (prefers non-CSB teams) */
export function buildPersonToTeamMap(teamPersons: TeamPerson[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const tp of teamPersons) {
    // Skip CSB so real team assignments take precedence
    if (tp.team === "CSB") continue;
    map.set(tp.person_name, tp.team);
  }
  return map;
}

/** Build a map: team -> person_name[] (excluding CSB) */
export function buildTeamToPersonsMap(teamPersons: TeamPerson[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const tp of teamPersons) {
    const list = map.get(tp.team) ?? [];
    list.push(tp.person_name);
    map.set(tp.team, list);
  }
  return map;
}
