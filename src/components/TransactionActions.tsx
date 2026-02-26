import { useState, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2 } from "lucide-react";
import { useUpdateTransaction, useDeleteTransaction, type DbTransaction } from "@/hooks/useTransactions";
import { useEditSettlementAdjustment, useDeleteSettlementAdjustment } from "@/hooks/useSettlements";
import { getAllPersons, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";

interface EditProps {
  transaction: DbTransaction;
  disabled?: boolean;
}

function isInternalMirrorTransaction(transaction: DbTransaction) {
  return transaction.type === "Internal" && transaction.transaction_id.endsWith("-M");
}

export function EditTransactionButton({ transaction, disabled }: EditProps) {
  const isSettlementAdj = transaction.type === "Settlement Adjustment";
  const isMirrorInternal = isInternalMirrorTransaction(transaction);
  const resolvedDisabled = disabled || isMirrorInternal;

  if (isSettlementAdj) {
    return <EditSettlementAdjButton transaction={transaction} disabled={resolvedDisabled} />;
  }

  return <EditRegularButton transaction={transaction} disabled={resolvedDisabled} />;
}

function EditRegularButton({ transaction, disabled }: EditProps) {
  const [open, setOpen] = useState(false);
  const updateTx = useUpdateTransaction();
  const persons = useMemo(() => getAllPersons(), []);

  const [form, setForm] = useState({
    date: transaction.date,
    person: transaction.person,
    note: transaction.note,
    amount: transaction.amount,
    category: transaction.category ?? "",
  });

  const handleOpen = () => {
    setForm({
      date: transaction.date,
      person: transaction.person,
      note: transaction.note,
      amount: transaction.amount,
      category: transaction.category ?? "",
    });
    setOpen(true);
  };

  const handleSave = () => {
    updateTx.mutate({
      id: transaction.id,
      updates: {
        date: form.date,
        person: form.person,
        note: form.note,
        amount: form.amount,
        category: form.category || null,
      },
    }, {
      onSuccess: () => setOpen(false),
    });
  };

  const incomeExpense = transaction.income_expense;
  const showCategory = transaction.type !== "Internal" && transaction.type !== "Withdraw" && transaction.type !== "Base fee";
  const catOptions: string[] = incomeExpense === "Income" ? [...INCOME_CATEGORIES] : [...EXPENSE_CATEGORIES];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        disabled={disabled}
        onClick={handleOpen}
        title={disabled ? "Settled transactions cannot be edited" : undefined}
      >
        <Pencil className="h-3 w-3" />
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Person</Label>
            <EditPersonCombobox persons={persons} value={form.person} onChange={v => setForm(f => ({ ...f, person: v }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Amount</Label>
            <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note</Label>
            <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="h-9 text-sm" />
          </div>
          {showCategory && (
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select category..." /></SelectTrigger>
                <SelectContent>
                  {catOptions.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={handleSave} className="w-full" size="sm" disabled={updateTx.isPending}>
            {updateTx.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditSettlementAdjButton({ transaction, disabled }: EditProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [originalAmount, setOriginalAmount] = useState<number>(0);
  const [settledAmount, setSettledAmount] = useState<number>(0);
  const editAdj = useEditSettlementAdjustment();

  const handleOpen = async () => {
    setOpen(true);
    if (transaction.original_transaction_id) {
      setLoading(true);
      const { data } = await supabase
        .from("transactions")
        .select("amount, settled_amount")
        .eq("id", transaction.original_transaction_id)
        .single();
      if (data) {
        setOriginalAmount(data.amount);
        setSettledAmount(data.settled_amount ?? data.amount);
      }
      setLoading(false);
    }
  };

  const handleSave = () => {
    editAdj.mutate(
      { adjustment: transaction, newSettledAmount: settledAmount },
      { onSuccess: () => setOpen(false) }
    );
  };

  const difference = originalAmount - settledAmount;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        disabled={disabled}
        onClick={handleOpen}
        title="Edit settlement amount"
      >
        <Pencil className="h-3 w-3" />
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Settlement Amount</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Original Earned Amount</Label>
              <p className="text-sm font-medium tabular-nums">{formatCurrency(originalAmount)}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Actual Amount Received</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={settledAmount}
                  onChange={e => setSettledAmount(parseFloat(e.target.value) || 0)}
                  className="h-9 pl-7 text-sm"
                />
              </div>
            </div>
            {Math.abs(difference) > 0.01 && (
              <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                Adjustment: <span className="font-medium">{formatCurrency(-difference)}</span>
                {" "}({difference > 0 ? "loss" : "gain"} of {formatCurrency(Math.abs(difference))})
              </div>
            )}
            <Button onClick={handleSave} className="w-full" size="sm" disabled={editAdj.isPending}>
              {editAdj.isPending ? "Saving…" : "Update Settlement"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditPersonCombobox({ persons, value, onChange }: { persons: string[]; value: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = persons.filter(p => p.toLowerCase().includes(search.toLowerCase()));
  const showList = focused && search.length > 0 && filtered.length > 0 && filtered[0] !== value;

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={focused ? search : value}
        onChange={e => { setSearch(e.target.value); onChange(""); }}
        onFocus={() => { setSearch(""); setFocused(true); }}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Search person..."
        className="h-9 text-sm"
      />
      {showList && (
        <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
          {filtered.map(p => (
            <button
              key={p}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
              onMouseDown={() => { onChange(p); setSearch(""); setFocused(false); }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface DeleteProps {
  transaction: DbTransaction;
  disabled?: boolean;
}

export function DeleteTransactionButton({ transaction, disabled }: DeleteProps) {
  const { role } = useAuth();
  const isSettlementAdj = transaction.type === "Settlement Adjustment";
  const isMirrorInternal = isInternalMirrorTransaction(transaction);
  const isInternalDeleteBlocked =
    transaction.type === "Internal" &&
    !(role === "admin" && transaction.team === "CSB" && !isMirrorInternal);
  const resolvedDisabled = disabled || isMirrorInternal || isInternalDeleteBlocked;

  if (isSettlementAdj) {
    return <DeleteSettlementAdjButton transaction={transaction} disabled={resolvedDisabled} />;
  }

  return <DeleteRegularButton transaction={transaction} disabled={resolvedDisabled} />;
}

function DeleteRegularButton({ transaction, disabled }: DeleteProps) {
  const deleteTx = useDeleteTransaction();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" disabled={disabled}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this transaction
            {transaction.type === "Internal" && " and its mirror entry"}.
            <span className="block mt-1 font-mono text-xs break-all opacity-70">
              ID: {transaction.transaction_id}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteTx.mutate({ transaction })}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteTx.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteSettlementAdjButton({ transaction, disabled }: DeleteProps) {
  const deleteAdj = useDeleteSettlementAdjustment();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" disabled={disabled}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revert Settlement?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete the settlement adjustment and revert the original transaction back to <strong>Pending</strong> status.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteAdj.mutate({ adjustment: transaction })}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteAdj.isPending ? "Reverting…" : "Revert & Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
