import { Skeleton } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-4 pt-8" aria-busy aria-label="טוען">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-9 w-56" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-11 w-32 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
      </div>
      <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-[var(--radius)]" />
        <Skeleton className="h-64 rounded-[var(--radius)]" />
      </div>
    </div>
  );
}
