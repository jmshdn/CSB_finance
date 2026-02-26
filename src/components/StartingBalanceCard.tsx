import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface StartingBalanceCardProps {
  startingAmount: number;
  carryForwardAmount: number;
  sheetBalance: number;
  actualSheetBalance: number;
  realBalance: number | null;
  realBalanceDate: string | null;
  isLoading: boolean;
  isClosed: boolean;
  isAdmin: boolean;
  onSave: (amount: number) => void;
  isUpserting: boolean;
  onSaveRealBalance: (amount: number) => void;
  isUpsertingReal: boolean;
}

export default function StartingBalanceCard({
  startingAmount,
  carryForwardAmount,
  sheetBalance,
  actualSheetBalance,
  realBalance,
  realBalanceDate,
  isLoading,
  isClosed,
  isAdmin,
  onSave,
  isUpserting,
  onSaveRealBalance,
  isUpsertingReal,
}: StartingBalanceCardProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [editingReal, setEditingReal] = useState(false);
  const [realInput, setRealInput] = useState("");

  const handleEdit = () => {
    setInputValue(String(startingAmount));
    setEditing(true);
  };

  const handleSave = () => {
    const val = parseFloat(inputValue);
    if (!isNaN(val)) {
      onSave(val);
      setEditing(false);
    }
  };

  const handleCancel = () => setEditing(false);

  const handleEditReal = () => {
    setRealInput(realBalance != null ? String(realBalance) : "");
    setEditingReal(true);
  };

  const handleSaveReal = () => {
    const val = parseFloat(realInput);
    if (!isNaN(val)) {
      onSaveRealBalance(val);
      setEditingReal(false);
    }
  };

  const handleCancelReal = () => setEditingReal(false);

  const diff = realBalance != null ? realBalance - actualSheetBalance : null;
  const walletValueClass = "mt-1 text-lg font-bold tabular-nums";

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {/* Starting Amount */}
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Starting Amount
          </p>
          {!isClosed && !editing && isAdmin && (
            <button
              onClick={handleEdit}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Edit starting amount"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {isLoading ? (
          <p className={cn(walletValueClass, "text-muted-foreground")}>…</p>
        ) : editing ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="h-8 w-full rounded-md border bg-background px-2 text-sm tabular-nums outline-none focus:ring-1 focus:ring-ring"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
            />
            <button onClick={handleSave} disabled={isUpserting} className="rounded p-1.5 text-income transition-colors hover:bg-income/10">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={handleCancel} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <p className={cn(walletValueClass, "text-foreground")}>
            {formatCurrency(startingAmount)}
          </p>
        )}
      </div>

      {/* Sheet Balance */}
      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Sheet Balance
        </p>
        <p className={cn(walletValueClass, sheetBalance >= 0 ? "text-income" : "text-expense")}>
          {formatCurrency(sheetBalance)}
        </p>
        {actualSheetBalance !== sheetBalance && (
          <p className={cn("mt-0.5 text-xs tabular-nums", actualSheetBalance >= 0 ? "text-income/70" : "text-expense/70")}>
            {formatCurrency(actualSheetBalance)} <span className="text-[10px] text-muted-foreground">w/o pending</span>
          </p>
        )}
      </div>

      {/* Real Balance */}
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Real Balance
          </p>
          {!isClosed && !editingReal && isAdmin && (
            <button
              onClick={handleEditReal}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Set real balance"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {isLoading ? (
          <p className={cn(walletValueClass, "text-muted-foreground")}>…</p>
        ) : editingReal ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <input
              type="number"
              value={realInput}
              onChange={(e) => setRealInput(e.target.value)}
              className="h-8 w-full rounded-md border bg-background px-2 text-sm tabular-nums outline-none focus:ring-1 focus:ring-ring"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveReal();
                if (e.key === "Escape") handleCancelReal();
              }}
            />
            <button onClick={handleSaveReal} disabled={isUpsertingReal} className="rounded p-1.5 text-income transition-colors hover:bg-income/10">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={handleCancelReal} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : realBalance != null ? (
          <div>
            <p className={cn(walletValueClass, "text-foreground")}>
              {formatCurrency(realBalance)}
            </p>
            {realBalanceDate && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Recorded: {realBalanceDate}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Not set</p>
        )}
      </div>

      {/* Difference (Real vs Sheet) */}
      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Difference
        </p>
        {diff != null ? (
          <p className={cn(walletValueClass, diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-income" : "text-expense")}>
            {diff === 0 ? "—" : formatCurrency(diff)}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">—</p>
        )}
        {diff != null && diff !== 0 && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">Real − Sheet</p>
        )}
      </div>
    </div>
  );
}
