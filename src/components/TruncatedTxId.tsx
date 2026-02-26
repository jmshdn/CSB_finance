import { useState } from "react";
import { Copy, Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { copyToClipboard } from "@/lib/clipboard";


interface TruncatedTxIdProps {
  value: string;
  maxLen?: number;
  /** How many transactions share this TX ID (including this one) */
  duplicateCount?: number;
}

export function TruncatedTxId({ value, maxLen = 12, duplicateCount }: TruncatedTxIdProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const needsTruncate = value.length > maxLen;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const copiedOk = await copyToClipboard(value);
    if (!copiedOk) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const sharedBadge = duplicateCount && duplicateCount > 1 ? (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground shrink-0 cursor-default">
            <Users className="h-3 w-3" />
            {duplicateCount}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Shared TX — {duplicateCount} entries use this ID
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;

  if (!needsTruncate) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
        {sharedBadge}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="font-mono text-xs text-muted-foreground text-left cursor-default hover:text-foreground transition-colors truncate max-w-[100px] block"
            >
              {`${value.slice(0, maxLen)}…`}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" align="start" className="max-w-sm">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-foreground break-all">{value}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Copy TX ID"
              >
                {copied ? <Check className="h-3 w-3 text-income" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {sharedBadge}
    </div>
  );
}
