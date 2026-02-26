import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface KPICardSkeletonProps {
  className?: string;
}

export default function KPICardSkeleton({ className }: KPICardSkeletonProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-fluid-card animate-fade-in", className)}>
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-7 w-28" />
    </div>
  );
}
