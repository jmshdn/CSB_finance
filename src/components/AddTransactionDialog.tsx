import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertCircle, Check, AlertTriangle, Split, X, Percent, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllPersons, CATEGORIES, INCOME_CATEGORIES, EXPENSE_CATEGORIES, getWalletPersons } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useAddTransaction } from "@/hooks/useTransactions";
import { useMonth } from "@/contexts/MonthContext";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTeams } from "@/hooks/useTeams";
import { getServerDateOnlyNow } from "@/lib/format";

interface Props {
  wallet: string;
  onAdded: () => void;
  floating?: boolean;
}

type TransactionType = "Income" | "Expense" | "Internal" | "Withdraw" | "Base fee";
type SplitMode = "percent" | "amount";

// WALLETS is now dynamic - see inside component

interface DividePerson {
  name: string;
  amount: number;
  percent: number;
}

function CategorySelector({ type, value, onChange }: { type: "Income" | "Expense"; value: string; onChange: (v: string) => void }) {
  const allCats: string[] = type === "Income" ? [...INCOME_CATEGORIES] : [...EXPENSE_CATEGORIES];

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Category</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select category..." /></SelectTrigger>
        <SelectContent>
          {allCats.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function AddTransactionDialog({ wallet, onAdded, floating }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addTransaction = useAddTransaction();
  const { selectedMonthId } = useMonth();
  const { data: teams = [] } = useTeams();
  const WALLETS = useMemo(() => ["CSB", ...teams], [teams]);
  const [open, setOpen] = useState(false);
  const persons = useMemo(() => getAllPersons(), []);
  const walletPersons = useMemo(() => getWalletPersons(wallet), [wallet]);

  const isCSB = wallet === "CSB";
  const typeOptions: TransactionType[] = isCSB
    ? ["Income", "Expense", "Internal", "Withdraw", "Base fee"]
    : ["Income", "Expense", "Internal"];

  const [form, setForm] = useState({
    date: getServerDateOnlyNow(),
    type: "Income" as TransactionType,
    person: "",
    note: "",
    amount: 0,
    transactionId: "",
    linkedWallet: undefined as string | undefined,
    category: "",
    sourceType: "" as string,
  });

  const [error, setError] = useState<string | null>(null);
  const [duplicateConfirm, setDuplicateConfirm] = useState(false);
  const [divideMode, setDivideMode] = useState(false);
  const [dividePersons, setDividePersons] = useState<DividePerson[]>([]);
  const [splitMode, setSplitMode] = useState<SplitMode>("percent");
  const [submitting, setSubmitting] = useState(false);
  const [divideSearch, setDivideSearch] = useState("");

  const reset = () => {
    setForm({
      date: getServerDateOnlyNow(),
      type: "Income",
      person: "",
      note: "",
      amount: 0,
      transactionId: "",
      linkedWallet: undefined,
      category: "",
      sourceType: "",
    });
    setError(null);
    setDuplicateConfirm(false);
    setDivideMode(false);
    setDividePersons([]);
    setSplitMode("percent");
    setDivideSearch("");
  };

  // Recalculate equal percentage splits
  const recalcEqualSplits = useCallback((people: DividePerson[], totalAmount: number) => {
    if (people.length === 0) return people;
    const pct = Math.round((100 / people.length) * 100) / 100;
    return people.map((p, i) => {
      const personPct = i === people.length - 1
        ? Math.round((100 - pct * (people.length - 1)) * 100) / 100
        : pct;
      const personAmount = Math.round((totalAmount * personPct / 100) * 100) / 100;
      return { ...p, percent: personPct, amount: personAmount };
    });
  }, []);

  const recalcAmountsFromPercent = useCallback((people: DividePerson[], totalAmount: number) => {
    return people.map(p => ({
      ...p,
      amount: Math.round((totalAmount * p.percent / 100) * 100) / 100,
    }));
  }, []);

  const toggleDividePerson = (personName: string) => {
    setDividePersons(prev => {
      const exists = prev.find(p => p.name === personName);
      let next: DividePerson[];
      if (exists) {
        next = prev.filter(p => p.name !== personName);
      } else {
        next = [...prev, { name: personName, amount: 0, percent: 0 }];
      }
      if (splitMode === "percent" && next.length > 0) {
        next = recalcEqualSplits(next, form.amount);
      }
      return next;
    });
  };
  const updateDividePersonPercent = (name: string, pct: number) => {
    setDividePersons(prev => prev.map(p => p.name === name ? {
      ...p,
      percent: pct,
      amount: Math.round((form.amount * pct / 100) * 100) / 100,
    } : p));
  };

  const updateDividePersonAmount = (name: string, amount: number) => {
    setDividePersons(prev => prev.map(p => p.name === name ? { ...p, amount } : p));
  };

  const handleAmountChange = (val: string) => {
    const num = parseFloat(val) || 0;
    let amount = num;
    if (form.type === "Income") amount = Math.abs(num);
    else if (form.type === "Expense" || form.type === "Withdraw" || form.type === "Internal" || form.type === "Base fee") amount = -Math.abs(num);
    setForm(f => ({ ...f, amount }));
    if (divideMode && splitMode === "percent" && dividePersons.length > 0) {
      setDividePersons(prev => recalcAmountsFromPercent(prev, amount));
    }
  };

  const handleTypeChange = (type: TransactionType) => {
    let amount = form.amount;
    if (type === "Income") amount = Math.abs(amount);
    else if (type === "Expense" || type === "Withdraw" || type === "Internal" || type === "Base fee") amount = -Math.abs(amount);

    // Disable divide mode for Internal/Withdraw/Base fee
    if (type === "Internal" || type === "Withdraw" || type === "Base fee") {
      setDivideMode(false);
      setDividePersons([]);
    }

    setForm(f => ({
      ...f,
      type,
      amount,
      person: type === "Withdraw" ? "" : type === "Base fee" ? "Team" : type === "Internal" ? (f.linkedWallet ?? "") : f.person,
      note: type === "Withdraw" ? "Headquarter" : type === "Base fee" ? "Base fee" : f.note,
      linkedWallet: type === "Internal" ? f.linkedWallet : undefined,
      category: type === "Internal" ? "Internal" : (type === "Withdraw" || type === "Base fee") ? "Headquarter" : "",
    }));

    if (divideMode && splitMode === "percent" && dividePersons.length > 0) {
      setDividePersons(prev => recalcAmountsFromPercent(prev, amount));
    }
  };

  const handleSplitModeChange = (mode: SplitMode) => {
    setSplitMode(mode);
    if (mode === "percent" && dividePersons.length > 0) {
      setDividePersons(prev => recalcEqualSplits(prev, form.amount));
    }
  };

  const divideTotalAssigned = dividePersons.reduce((s, p) => s + p.amount, 0);
  const divideRemainder = Math.round((form.amount - divideTotalAssigned) * 100) / 100;

  const submitSingleTransaction = () => {
    const incomeExpense = (form.type === "Withdraw" || form.type === "Base fee") ? "Expense" : form.type;
    const isSettlementTracked = form.type === "Income" && (form.sourceType === "PayPal" || form.sourceType === "Payoneer");
    addTransaction.mutate({
      date: form.date,
      team: wallet,
      income_expense: incomeExpense,
      type: form.type,
      person: form.person,
      note: form.note,
      amount: form.amount,
      transaction_id: form.transactionId,
      linked_wallet: form.linkedWallet ?? null,
      category: form.type === "Internal" ? "Internal" : (form.type === "Withdraw" || form.type === "Base fee") ? "Headquarter" : form.category,
      month_id: selectedMonthId,
      source_type: form.sourceType || null,
      settlement_status: isSettlementTracked ? "Pending" : null,
    }, {
      onSuccess: () => {
        reset();
        setOpen(false);
        onAdded();
      },
      onError: (err) => {
        setError(err.message);
      },
    });
  };

  const submitDividedTransactions = async () => {
    setSubmitting(true);
    setError(null);
    const incomeExpense = form.type === "Withdraw" ? "Expense" : form.type;
    const txType = form.type === "Withdraw" ? "Withdraw" : form.type === "Internal" ? "Internal" : form.type;
    const isSettlementTracked = form.type === "Income" && (form.sourceType === "PayPal" || form.sourceType === "Payoneer");

    try {
      const inserts = dividePersons.map(dp => ({
        date: form.date,
        team: wallet,
        income_expense: incomeExpense,
        type: txType,
        person: dp.name,
        note: form.note,
        amount: dp.amount,
        transaction_id: form.transactionId,
        linked_wallet: form.linkedWallet ?? null,
        category: form.type === "Internal" ? "Internal" : form.type === "Withdraw" ? "Headquarter" : form.category,
        month_id: selectedMonthId ?? null,
        source_type: form.sourceType || null,
        settlement_status: isSettlementTracked ? "Pending" : null,
      }));

      const { error: insertError } = await supabase.from("transactions").insert(inserts);
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      toast({ title: "Transactions added", description: `Divided among ${dividePersons.length} people.` });
      reset();
      setOpen(false);
      onAdded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Common validation
    if (!form.date) { setError("Date is required"); return; }
    if (form.type !== "Internal" && form.type !== "Withdraw" && form.type !== "Base fee" && !form.category) { setError("Category is required"); return; }
    if (form.amount === 0) { setError("Amount cannot be zero"); return; }
    if (!form.transactionId || form.transactionId.length < 6) { setError("Transaction ID must be at least 6 characters"); return; }
    if (form.type === "Income" && form.amount < 0) { setError("Income must be positive"); return; }
    if ((form.type === "Expense" || form.type === "Withdraw" || form.type === "Base fee") && form.amount > 0) { setError("Expense/Withdraw/Base fee must be negative"); return; }
    if (form.type === "Withdraw" && wallet !== "CSB") { setError("Withdraw is only allowed for CSB Wallet"); return; }
    if (form.type === "Internal" && !form.linkedWallet) { setError("Internal transfers require a destination wallet"); return; }

    // Divide mode validation
    if (divideMode) {
      if (dividePersons.length < 2) { setError("Select at least 2 people to divide among"); return; }
      if (dividePersons.some(p => p.amount === 0)) { setError("Each person must have a non-zero amount"); return; }
      if (splitMode === "amount" && Math.abs(divideRemainder) > 0.01) { setError(`Split amounts don't add up. Remainder: ${divideRemainder}`); return; }
      if (splitMode === "percent") {
        const totalPct = Math.round(dividePersons.reduce((s, p) => s + p.percent, 0) * 100) / 100;
        if (Math.abs(totalPct - 100) > 0.1) { setError(`Percentages must total 100%. Current: ${totalPct}%`); return; }
      }
    } else {
      if (form.type !== "Internal" && form.type !== "Withdraw" && form.type !== "Base fee" && !form.person) { setError("Person is required"); return; }
    }

    // Duplicate check (skip if already confirmed)
    if (!duplicateConfirm) {
      setError(null);
      const { data: existing } = await supabase
        .from("transactions")
        .select("id, person, team")
        .eq("transaction_id", form.transactionId)
        .limit(5);

      if (existing && existing.length > 0) {
        setDuplicateConfirm(true);
        return;
      }
    }

    if (divideMode) {
      submitDividedTransactions();
    } else {
      submitSingleTransaction();
    }
  };

  const destinationWallets = WALLETS.filter(w => w !== wallet);
  const showDivideToggle = form.type !== "Internal" && form.type !== "Withdraw" && form.type !== "Base fee";
  const singlePersonList = persons; // all persons regardless of wallet
  const dividePersonList = persons; // all persons regardless of wallet

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {floating ? (
          <button className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95">
            <Plus className="h-5 w-5" />
          </button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Transaction
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Transaction — {wallet === "CSB" ? "CSB Wallet" : `Team ${wallet}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-expense-bg p-3 text-sm text-expense">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={(v) => handleTypeChange(v as TransactionType)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Person selection or Divide toggle */}
          {showDivideToggle && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Person</Label>
                <div className="flex items-center gap-1.5">
                  {form.type === "Expense" && (
                    <Button
                      type="button"
                      variant={form.person === "Team" ? "default" : "outline"}
                      size="sm"
                      className="h-6 gap-1 px-2 text-[11px]"
                      onClick={() => {
                        if (form.person === "Team") {
                          setForm(f => ({ ...f, person: "" }));
                        } else {
                          setForm(f => ({ ...f, person: "Team" }));
                          setDivideMode(false);
                          setDividePersons([]);
                        }
                      }}
                    >
                      Team Expense
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant={divideMode ? "default" : "outline"}
                    size="sm"
                    className="h-6 gap-1 px-2 text-[11px]"
                    onClick={() => {
                      setDivideMode(m => !m);
                      if (!divideMode) {
                        setForm(f => ({ ...f, person: "" }));
                      } else {
                        setDividePersons([]);
                        setSplitMode("percent");
                      }
                    }}
                  >
                    <Split className="h-3 w-3" />
                    Divide
                  </Button>
                </div>
              </div>

              {!divideMode && form.person !== "Team" && (
                <PersonCombobox persons={singlePersonList} value={form.person} onChange={v => setForm(f => ({ ...f, person: v }))} />
              )}
              {form.person === "Team" && (
                <p className="text-xs text-muted-foreground">This expense will be recorded as a team-level expense.</p>
              )}
            </div>
          )}

          {/* Divide mode UI */}
          {divideMode && showDivideToggle && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {dividePersons.length} selected
                </span>
                <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                  <Button
                    type="button"
                    variant={splitMode === "percent" ? "default" : "ghost"}
                    size="sm"
                    className="h-6 gap-1 px-2 text-[11px]"
                    onClick={() => handleSplitModeChange("percent")}
                  >
                    <Percent className="h-3 w-3" />
                    By Percentage
                  </Button>
                  <Button
                    type="button"
                    variant={splitMode === "amount" ? "default" : "ghost"}
                    size="sm"
                    className="h-6 gap-1 px-2 text-[11px]"
                    onClick={() => handleSplitModeChange("amount")}
                  >
                    <DollarSign className="h-3 w-3" />
                    By Amount
                  </Button>
                </div>
              </div>

              {/* Search to add people */}
              <DividePersonSearch
                persons={dividePersonList}
                selected={dividePersons.map(p => p.name)}
                onAdd={(name) => toggleDividePerson(name)}
              />

              {/* Selected people list */}
              {dividePersons.length > 0 && (
                <div className="space-y-1.5">
                  {dividePersons.map(dp => (
                    <div key={dp.name} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleDividePerson(dp.name)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <span className="flex-1 text-sm">{dp.name}</span>
                      {splitMode === "amount" && (
                        <Input
                          type="number"
                          step="0.01"
                          value={Math.abs(dp.amount) || ""}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            const signed = form.type === "Income" ? Math.abs(val) : -Math.abs(val);
                            updateDividePersonAmount(dp.name, signed);
                          }}
                          className="h-7 w-24 text-xs text-right"
                          placeholder="0.00"
                        />
                      )}
                      {splitMode === "percent" && (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={dp.percent || ""}
                            onChange={e => {
                              const pct = parseFloat(e.target.value) || 0;
                              updateDividePersonPercent(dp.name, pct);
                            }}
                            className="h-7 w-16 text-xs text-right"
                            placeholder="0"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                          <span className="text-xs font-mono text-muted-foreground tabular-nums w-16 text-right">
                            = {Math.abs(dp.amount).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {splitMode === "percent" && dividePersons.length > 0 && (() => {
                const totalPct = Math.round(dividePersons.reduce((s, p) => s + p.percent, 0) * 100) / 100;
                return (
                  <div className={cn(
                    "text-xs font-medium text-right",
                    Math.abs(totalPct - 100) > 0.1 ? "text-expense" : "text-income"
                  )}>
                    {Math.abs(totalPct - 100) > 0.1
                      ? `Total: ${totalPct}% (must be 100%)`
                      : "✓ 100% allocated"}
                  </div>
                );
              })()}

              {splitMode === "amount" && dividePersons.length > 0 && (
                <div className={cn(
                  "text-xs font-medium text-right",
                  Math.abs(divideRemainder) > 0.01 ? "text-expense" : "text-income"
                )}>
                  {Math.abs(divideRemainder) > 0.01
                    ? `Remainder: ${divideRemainder.toFixed(2)}`
                    : "✓ Fully allocated"}
                </div>
              )}
            </div>
          )}

          {/* Source Type for Income */}
          {form.type === "Income" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Source Type</Label>
              <Select value={form.sourceType} onValueChange={v => setForm(f => ({ ...f, sourceType: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select source (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PayPal">PayPal</SelectItem>
                  <SelectItem value="Payoneer">Payoneer</SelectItem>
                  <SelectItem value="Crypto">Crypto</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              {(form.sourceType === "PayPal" || form.sourceType === "Payoneer") && (
                <p className="text-[10px] text-withdraw">🟡 This income will be tracked as pending settlement until crypto is received.</p>
              )}
            </div>
          )}

          {form.type !== "Internal" && form.type !== "Withdraw" && form.type !== "Base fee" && (
            <CategorySelector
              type={form.type as "Income" | "Expense"}
              value={form.category}
              onChange={v => setForm(f => ({ ...f, category: v }))}
            />
          )}

          {form.type === "Internal" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Destination Wallet</Label>
              <Select value={form.linkedWallet ?? ""} onValueChange={v => setForm(f => ({ ...f, linkedWallet: v, person: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>
                  {destinationWallets.map(w => (<SelectItem key={w} value={w}>{w === "CSB" ? "CSB Wallet" : `Team ${w}`}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Amount {form.type === "Income" ? "(positive)" : "(negative)"}</Label>
            <Input type="number" step="0.01" value={Math.abs(form.amount) || ""} onChange={e => handleAmountChange(e.target.value)} placeholder="0.00" className="h-9 text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Transaction ID (min 6 chars) — For PayPal/Payoneer, use e.g. "Paypal income" or "Payoneer income"</Label>
            <Input value={form.transactionId} onChange={e => { setForm(f => ({ ...f, transactionId: e.target.value })); setDuplicateConfirm(false); }} placeholder="e.g. 0x7a3f…b91c or Paypal income" className="h-9 text-sm" minLength={6} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Note (optional)</Label>
            <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Description..." className="h-9 text-sm" />
          </div>

          {duplicateConfirm && (
            <div className="flex flex-col gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                This TX ID already exists. Is this a shared expense/income across multiple people?
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" variant="outline" className="flex-1" disabled={addTransaction.isPending || submitting}>
                  Yes, add anyway
                </Button>
                <Button type="button" size="sm" variant="ghost" className="flex-1" onClick={() => setDuplicateConfirm(false)}>
                  No, let me change it
                </Button>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={addTransaction.isPending || submitting}>
            {(addTransaction.isPending || submitting)
              ? "Saving…"
              : divideMode
                ? `Divide among ${dividePersons.length} people`
                : duplicateConfirm
                  ? "Confirm & Add"
                  : "Add Transaction"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PersonCombobox({ persons, value, onChange }: { persons: string[]; value: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = persons.filter(p => p.toLowerCase().includes(search.toLowerCase()));
  const showList = focused && search.length > 0 && filtered.length > 0 && filtered[0] !== value;
  const normalizedSearch = search.trim().toLowerCase();

  const getKeyboardCandidate = () => {
    if (!normalizedSearch) return null;
    const exactMatch = filtered.find(p => p.toLowerCase() === normalizedSearch);
    if (exactMatch) return exactMatch;
    if (filtered.length === 1) return filtered[0];
    return null;
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={focused ? search : value}
        onChange={e => { setSearch(e.target.value); onChange(""); }}
        onKeyDown={(e) => {
          if (e.key !== " " && e.key !== "Enter") return;
          const candidate = getKeyboardCandidate();
          if (!candidate) return;
          e.preventDefault();
          onChange(candidate);
          setSearch("");
          setFocused(false);
        }}
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

function DividePersonSearch({ persons, selected, onAdd }: { persons: string[]; selected: string[]; onAdd: (name: string) => void }) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);

  const filtered = persons.filter(p =>
    p.toLowerCase().includes(search.toLowerCase()) && !selected.includes(p)
  );
  const showList = focused && search.length > 0 && filtered.length > 0;
  const normalizedSearch = search.trim().toLowerCase();

  const getKeyboardCandidate = () => {
    if (!normalizedSearch) return null;
    const exactMatch = filtered.find(p => p.toLowerCase() === normalizedSearch);
    if (exactMatch) return exactMatch;
    if (filtered.length === 1) return filtered[0];
    return null;
  };

  return (
    <div className="relative">
      <Input
        value={search}
        onChange={e => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== " " && e.key !== "Enter") return;
          const candidate = getKeyboardCandidate();
          if (!candidate) return;
          e.preventDefault();
          onAdd(candidate);
          setSearch("");
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Search and add person..."
        className="h-8 text-sm"
      />
      {showList && (
        <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
          {filtered.map(p => (
            <button
              key={p}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
              onMouseDown={() => { onAdd(p); setSearch(""); }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
