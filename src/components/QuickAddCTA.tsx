import { useNavigate } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTeamDotColor } from "@/lib/team-colors";
import { useAuth } from "@/contexts/AuthContext";

export default function QuickAddCTA() {
  const { role, wallet, profile } = useAuth();
  const navigate = useNavigate();

  const isAdminOrJJS = role === "admin" || profile?.display_name === "JJS";
  const targetWallet = isAdminOrJJS ? "CSB" : wallet;
  if (!targetWallet) return null;
  const targetPath = isAdminOrJJS ? "/wallet" : `/team/${targetWallet}`;

  return (
    <button
      onClick={() => navigate(targetPath)}
      className="group relative flex w-full items-center gap-2.5 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-2.5 text-left transition-all hover:border-primary/60 hover:bg-primary/10"
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", getTeamDotColor(targetWallet))}>
        <PlusCircle className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">Want to add a transaction?</p>
        <p className="text-xs text-muted-foreground">
          Go to <span className="font-medium text-primary">{targetWallet} Wallet</span> to record income or expenses
        </p>
      </div>
      <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        Open →
      </span>
    </button>
  );
}
