import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useMonths, type Month } from "@/hooks/useMonths";

interface MonthContextValue {
  months: Month[];
  selectedMonth: Month | null;
  selectedMonthId: string | null;
  setSelectedMonthId: (id: string) => void;
  isLoading: boolean;
  isCurrentMonthClosed: boolean;
  /** Date prefix for filtering local data e.g. "2026-02" */
  monthPrefix: string;
}

const MonthContext = createContext<MonthContextValue | null>(null);

export function MonthProvider({ children }: { children: ReactNode }) {
  const { data: months = [], isLoading } = useMonths();
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null);

  // Auto-select first open month, or latest month
  useEffect(() => {
    if (months.length > 0 && !selectedMonthId) {
      const openMonth = months.find((m) => !m.is_closed);
      setSelectedMonthId(openMonth?.id ?? months[0].id);
    }
  }, [months, selectedMonthId]);

  const selectedMonth = months.find((m) => m.id === selectedMonthId) ?? null;

  // Derive a YYYY-MM prefix from start_date for local data filtering
  const monthPrefix = selectedMonth
    ? selectedMonth.start_date.slice(0, 7)
    : new Date().toISOString().slice(0, 7);

  return (
    <MonthContext.Provider
      value={{
        months,
        selectedMonth,
        selectedMonthId,
        setSelectedMonthId,
        isLoading,
        isCurrentMonthClosed: selectedMonth?.is_closed ?? false,
        monthPrefix,
      }}
    >
      {children}
    </MonthContext.Provider>
  );
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth must be used within MonthProvider");
  return ctx;
}
