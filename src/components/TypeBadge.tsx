import { cn } from "@/lib/utils";
import type { DbTransaction } from "@/hooks/useTransactions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Renders a colored badge for transaction type (Income/Expense/Internal/Withdraw) */
export function TypeBadge({ transaction }: { transaction: Pick<DbTransaction, "income_expense" | "type" | "settlement_status" | "source_type"> }) {
  const isWithdraw = transaction.type === "Withdraw";
  const isBaseFee = transaction.type === "Base fee";
  const isSettlementAdj = transaction.type === "Settlement Adjustment";
  return (
    <div className="flex items-center gap-1">
      <span className={cn(
        "rounded px-1.5 py-0.5 text-xs font-medium",
        transaction.income_expense === "Income" && !isSettlementAdj && "bg-income-bg text-income",
        transaction.income_expense === "Expense" && !isWithdraw && !isBaseFee && !isSettlementAdj && "bg-expense-bg text-expense",
        transaction.income_expense === "Internal" && "bg-internal-bg text-internal",
        isWithdraw && "bg-withdraw-bg text-withdraw",
        isBaseFee && "bg-muted text-muted-foreground",
        isSettlementAdj && "bg-withdraw-bg text-withdraw",
      )}>
        {isWithdraw ? "Withdraw" : isBaseFee ? "Base fee" : isSettlementAdj ? "Adjustment" : transaction.income_expense}
      </span>
      {transaction.settlement_status === "Pending" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-withdraw-bg text-withdraw cursor-help">🟡 Pending</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Pending settlement from {transaction.source_type || "unknown source"}</p>
          </TooltipContent>
        </Tooltip>
      )}
      {transaction.settlement_status === "Settled" && !isSettlementAdj && (
        <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-income-bg text-income">✓ Settled</span>
      )}
    </div>
  );
}
