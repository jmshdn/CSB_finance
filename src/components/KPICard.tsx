import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  subtitle?: string;
  variant?: "default" | "income" | "expense" | "internal";
  dense?: boolean;
  className?: string;
}

export default function KPICard({ label, value, subtitle, variant = "default", dense = false, className }: KPICardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border animate-fade-in",
        dense ? "p-2.5" : "p-fluid-card",
        variant === "income" && "border-income/20 bg-income-bg",
        variant === "expense" && "border-expense/20 bg-expense-bg",
        variant === "internal" && "border-internal/20 bg-internal-bg",
        variant === "default" && "bg-card",
        className
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          dense ? "mt-0.5 text-base font-semibold tracking-tight" : "mt-1.5 text-fluid-number-lg font-semibold tracking-tight",
          variant === "income" && "text-income",
          variant === "expense" && "text-expense",
          variant === "internal" && "text-internal",
          variant === "default" && "text-foreground"
        )}
      >
        {value}
      </p>
      {subtitle && <p className={cn("text-xs text-muted-foreground", dense ? "mt-0 leading-tight" : "mt-0.5")}>{subtitle}</p>}
    </div>
  );
}
