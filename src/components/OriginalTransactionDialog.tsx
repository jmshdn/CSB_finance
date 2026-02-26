import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDateOnly, formatDateTime } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { TruncatedTxId } from "@/components/TruncatedTxId";
import { TypeBadge } from "@/components/TypeBadge";
import type { DbTransaction } from "@/hooks/useTransactions";

interface Props {
  originalTransactionId: string | null;
  children: (onClick: () => void) => React.ReactNode;
}

export function OriginalTransactionDialog({ originalTransactionId, children }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [original, setOriginal] = useState<DbTransaction | null>(null);
  const navigate = useNavigate();

  const handleClick = async () => {
    if (!originalTransactionId) return;
    setOpen(true);
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", originalTransactionId)
      .single();
    setLoading(false);
    if (!error && data) setOriginal(data as DbTransaction);
  };

  const goToOriginal = () => {
    if (!original) return;
    setOpen(false);
    navigate(`/team/${original.team}?highlight=${original.id}`);
  };

  return (
    <>
      {children(handleClick)}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Original Transaction</DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : original ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Date</span>
                  <p className="font-medium">
                    <span title={formatDateTime(original.created_at ?? original.date)} className="cursor-help">
                      {formatDateOnly(original.created_at ?? original.date)}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Person</span>
                  <p className="font-medium">{original.person}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Type</span>
                  <div className="mt-0.5"><TypeBadge transaction={original} /></div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Wallet</span>
                  <p className="font-medium">{original.team}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Original Amount</span>
                  <p className="font-medium tabular-nums">{formatCurrency(original.amount)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Settled Amount</span>
                  <p className="font-medium tabular-nums">
                    {original.settled_amount != null ? formatCurrency(original.settled_amount) : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Settlement Status</span>
                  <div className="mt-0.5">
                    <Badge variant={original.settlement_status === "Settled" ? "default" : "secondary"} className="text-[10px]">
                      {original.settlement_status ?? "—"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Source</span>
                  <p className="font-medium">{original.source_type ?? "—"}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-muted-foreground">Tx ID</span>
                  <div className="mt-0.5"><TruncatedTxId value={original.transaction_id} /></div>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-muted-foreground">Note</span>
                  <p className="font-medium">{original.note || "—"}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">Original transaction not found.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
