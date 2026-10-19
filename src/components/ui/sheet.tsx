"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** iOS card sheet: grabber, centered title, glass close button. Centered dialog on desktop. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 dark:bg-black/60 data-[state=open]:animate-[fade-up_0.3s_ease-out]" />
        <Dialog.Content
          dir="rtl"
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col rounded-t-[2.25rem] bg-background shadow-lift dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] outline-none",
            "data-[state=open]:animate-sheet-up",
            "sm:inset-auto sm:start-1/2 sm:top-1/2 sm:max-h-[86dvh] sm:w-[min(540px,calc(100vw-2rem))] sm:translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem] sm:data-[state=open]:animate-scale-in",
            className,
          )}
        >
          <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-muted-2 sm:hidden" aria-hidden />
          <div className="relative flex min-h-14 items-center justify-center px-16 pt-2 pb-1">
            <Dialog.Close
              className="glass pressable absolute start-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-foreground/70"
              aria-label="סגירה"
            >
              <X className="size-[18px]" strokeWidth={2.5} />
            </Dialog.Close>
            <div className="min-w-0 text-center">
              <Dialog.Title className="headline truncate">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="footnote truncate text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">{children}</div>
          {footer && <div className="px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** iOS alert. */
export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content
          dir="rtl"
          className="glass fixed start-1/2 top-1/2 z-50 w-[min(300px,calc(100vw-3rem))] translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.75rem] text-center data-[state=open]:animate-scale-in"
        >
          <div className="px-5 pt-5 pb-4">
            <Dialog.Title className="headline">{title}</Dialog.Title>
            <Dialog.Description className="footnote mt-1 text-foreground/80">{description ?? ""}</Dialog.Description>
          </div>
          <div className="flex flex-col gap-2 px-4 pb-4">
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                "pressable h-11 rounded-full text-[17px] font-semibold disabled:opacity-50",
                destructive ? "bg-danger text-white" : "bg-primary text-primary-foreground",
              )}
            >
              {confirmLabel}
            </button>
            <Dialog.Close className="pressable h-11 rounded-full bg-fill text-[17px] font-semibold">ביטול</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
