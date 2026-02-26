import { Link } from "react-router-dom";
import { getTeamColors } from "@/lib/team-colors";
import { cn } from "@/lib/utils";

interface PersonNameProps {
  name: string;
  team?: string;
  linkable?: boolean;
  className?: string;
}

/**
 * Displays a person's name with their team color.
 * Supports both Tailwind class-based colors (built-in teams) and inline styles (dynamic teams).
 */
export function PersonName({ name, team, linkable = true, className }: PersonNameProps) {
  const colors = team ? getTeamColors(team) : { text: "text-foreground", bg: "bg-muted/50", border: "border-border" };
  const isInline = "isInline" in colors && colors.isInline;

  const badge = isInline ? (
    <span
      className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-semibold", className)}
      style={{
        color: colors.text,
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
    >
      {name}
    </span>
  ) : (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-semibold",
        colors.bg,
        colors.text,
        colors.border,
        className,
      )}
    >
      {name}
    </span>
  );

  if (linkable) {
    return (
      <Link
        to={`/person/${encodeURIComponent(name)}`}
        className="hover:opacity-80 transition-opacity"
      >
        {badge}
      </Link>
    );
  }

  return badge;
}
