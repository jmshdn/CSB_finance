import { useMonth } from "@/contexts/MonthContext";
import { Lock, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MonthSelector() {
  const { months, selectedMonthId, setSelectedMonthId, isLoading, isCurrentMonthClosed } = useMonth();

  if (isLoading) {
    return <span className="text-xs text-muted-foreground">Loading…</span>;
  }

  if (months.length === 0) {
    return <span className="text-xs text-muted-foreground">No months</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={selectedMonthId ?? ""}
        onChange={(e) => setSelectedMonthId(e.target.value)}
        className="h-7 rounded-md border bg-card px-2 text-xs font-medium text-foreground outline-none"
      >
        {months.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} {m.is_closed ? "🔒" : ""}
          </option>
        ))}
      </select>
      {isCurrentMonthClosed && (
        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Lock className="h-3 w-3" />
          Closed
        </span>
      )}
    </div>
  );
}
