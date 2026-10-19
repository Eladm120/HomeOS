import { Skeleton } from "@/components/ui/card";

/** Home screen skeleton in the dashboard's own shape: header, brief, quick actions, widgets. */
export default function Loading() {
  return (
    <div className="space-y-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:pt-8" aria-busy aria-label="טוען">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-40 rounded-full" />
        <span className="flex-1" />
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="size-10 rounded-full" />
      </div>
      <div className="space-y-2 pt-3">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-9 w-60" />
      </div>
      <Skeleton className="h-48 w-full rounded-[1.75rem]" />
      <div className="grid grid-cols-4 gap-1 py-1">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Skeleton className="size-[52px] rounded-[18px]" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-[1.5rem]" />
      <Skeleton className="h-40 w-full rounded-[1.5rem]" />
    </div>
  );
}
