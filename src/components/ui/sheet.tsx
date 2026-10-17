"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bottom sheet on mobile, centered dialog on larger screens. */
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] data-[state=open]:animate-[fade-up_0.2s_ease-out]" />
        <Dialog.Content
          dir="rtl"
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[1.75rem] border border-border bg-surface shadow-lift outline-none",
            "data-[state=open]:animate-fade-up",
            "sm:inset-auto sm:start-1/2 sm:top-1/2 sm:w-[min(560px,calc(100vw-2rem))] sm:-translate-y-1/2 sm:translate-x-1/2 sm:rounded-[1.75rem]",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-surface-3 sm:hidden" aria-hidden />
          <div className="flex items-start gap-3 px-5 pt-3 pb-2">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="סגירה">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer && <div className="border-t border-border/70 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35" />
        <Dialog.Content
          dir="rtl"
          className="fixed start-1/2 top-1/2 z-50 w-[min(400px,calc(100vw-2rem))] translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-surface p-6 shadow-lift data-[state=open]:animate-fade-up"
        >
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">{description ?? ""}</Dialog.Description>
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                "h-11 flex-1 rounded-full font-medium text-white transition active:scale-[0.97] disabled:opacity-60",
                destructive ? "bg-danger" : "bg-primary",
              )}
            >
              {confirmLabel}
            </button>
            <Dialog.Close className="h-11 flex-1 rounded-full bg-surface-2 font-medium">ביטול</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
