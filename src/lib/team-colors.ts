/** Team color mapping - returns tailwind class names or inline styles for dynamic teams */

interface TeamColorSet {
  text: string;
  bg: string;
  border: string;
  /** If true, values are CSS color strings for inline styles, not Tailwind classes */
  isInline?: boolean;
}

const TEAM_COLOR_MAP: Record<string, TeamColorSet> = {
  AAA: { text: "text-team-aaa", bg: "bg-team-aaa-bg", border: "border-team-aaa/30" },
  BBB: { text: "text-team-bbb", bg: "bg-team-bbb-bg", border: "border-team-bbb/30" },
  CCC: { text: "text-team-ccc", bg: "bg-team-ccc-bg", border: "border-team-ccc/30" },
  DDD: { text: "text-team-ddd", bg: "bg-team-ddd-bg", border: "border-team-ddd/30" },
  EEE: { text: "text-team-eee", bg: "bg-team-eee-bg", border: "border-team-eee/30" },
  CSB: { text: "text-team-csb", bg: "bg-team-csb-bg", border: "border-team-csb/30" },
};

/** Generate a deterministic hue from a team name string */
function hashHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ((hash % 360) + 360) % 360;
}

/** Generate dynamic colors for unknown teams */
function generateTeamColor(team: string): TeamColorSet {
  const hue = hashHue(team);
  return {
    text: `hsl(${hue}, 60%, 40%)`,
    bg: `hsl(${hue}, 50%, 95%)`,
    border: `hsl(${hue}, 50%, 70%)`,
    isInline: true,
  };
}

export function getTeamColors(team: string): TeamColorSet {
  return TEAM_COLOR_MAP[team] ?? generateTeamColor(team);
}

export function getTeamDotColor(team: string): string {
  const dotMap: Record<string, string> = {
    AAA: "bg-team-aaa",
    BBB: "bg-team-bbb",
    CCC: "bg-team-ccc",
    DDD: "bg-team-ddd",
    EEE: "bg-team-eee",
    CSB: "bg-team-csb",
  };
  return dotMap[team] ?? "";
}

/** For dynamic teams, returns inline style for dot color */
export function getTeamDotStyle(team: string): React.CSSProperties | undefined {
  if (TEAM_COLOR_MAP[team]) return undefined;
  const hue = hashHue(team);
  return { backgroundColor: `hsl(${hue}, 60%, 45%)` };
}
