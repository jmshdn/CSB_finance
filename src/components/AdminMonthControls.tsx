import { useState } from "react";
import { useMonth } from "@/contexts/MonthContext";
import { useCloseMonth, useCreateMonth, useUnlockMonth } from "@/hooks/useMonths";
import { usePendingSettlements } from "@/hooks/useSettlements";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Unlock, Plus } from "lucide-react";

export default function AdminMonthControls() {
  const { selectedMonth, selectedMonthId, isCurrentMonthClosed } = useMonth();
  const closeMonth = useCloseMonth();
  const unlockMonth = useUnlockMonth();
  const createMonth = useCreateMonth();
  const { data: pendingSettlements = [] } = usePendingSettlements();
  const pendingCount = pendingSettlements.length;

  const [newMonth, setNewMonth] = useState({
    name: "",
    start_date: "",
    end_date: "",
    crypto_start: 0,
  });
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreate = () => {
    if (!newMonth.name || !newMonth.start_date || !newMonth.end_date) return;
    createMonth.mutate(newMonth, {
      onSuccess: () => {
        setCreateOpen(false);
        setNewMonth({ name: "", start_date: "", end_date: "", crypto_start: 0 });
      },
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* Close Month */}
      {selectedMonth && !isCurrentMonthClosed && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              <Lock className="h-3 w-3" /> Close Month
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Close {selectedMonth.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will generate all summaries and permanently lock this month.
                No transactions can be added, edited, or deleted after closing.
                This action cannot be undone.
                {pendingCount > 0 && (
                  <span className="mt-2 block rounded-md border border-withdraw/30 bg-withdraw-bg p-2 text-sm text-withdraw">
                    ⚠ {pendingCount} settlement{pendingCount !== 1 ? "s are" : " is"} still pending. Continue closing?
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedMonthId && closeMonth.mutate(selectedMonthId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {closeMonth.isPending ? "Closing…" : "Close Month"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Unlock Month */}
      {selectedMonth && isCurrentMonthClosed && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              <Unlock className="h-3 w-3" /> Unlock Month
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unlock {selectedMonth.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will re-open the month, allowing transactions to be added, edited, or deleted again.
                Existing summaries will remain but may become outdated.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedMonthId && unlockMonth.mutate(selectedMonthId)}
              >
                {unlockMonth.isPending ? "Unlocking…" : "Unlock Month"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Create New Month */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
            <Plus className="h-3 w-3" /> New Month
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Month</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={newMonth.name}
                onChange={(e) => setNewMonth((s) => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Mar 2026"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={newMonth.start_date}
                  onChange={(e) => setNewMonth((s) => ({ ...s, start_date: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={newMonth.end_date}
                  onChange={(e) => setNewMonth((s) => ({ ...s, end_date: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Crypto Start Balance</Label>
              <Input
                type="number"
                value={newMonth.crypto_start || ""}
                onChange={(e) => setNewMonth((s) => ({ ...s, crypto_start: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancel</Button>
            </DialogClose>
            <Button size="sm" onClick={handleCreate} disabled={createMonth.isPending}>
              {createMonth.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
