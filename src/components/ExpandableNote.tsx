import { useState } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Truncates long notes in table cells; click to see full text in a popover */
export function ExpandableNote({ text, maxWidth = 200 }: { text: string; maxWidth?: number }) {
  if (!text) return <span className="text-muted-foreground">—</span>;

  // If short enough, just render inline
  if (text.length <= 40) {
    return <span className="text-foreground">{text}</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "block truncate text-left text-foreground hover:text-primary cursor-pointer transition-colors",
          )}
          style={{ maxWidth }}
          title="Click to expand"
        >
          {text}
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-sm text-sm whitespace-pre-wrap break-words" side="top" align="start">
        {text}
      </PopoverContent>
    </Popover>
  );
}
