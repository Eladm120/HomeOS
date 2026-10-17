import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

/** iOS-style filled controls: no borders, soft gray fill, focus ring in tint color. */
const controlBase =
  "w-full rounded-xl border-0 bg-fill px-3.5 text-[17px] text-foreground placeholder:text-muted-2 transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(controlBase, "h-11", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(controlBase, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        controlBase,
        "h-11 appearance-none bg-[length:12px] bg-[position:left_0.9rem_center] bg-no-repeat pe-3.5 ps-8",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5' fill='none' stroke='%238e8e93' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn("ps-1 text-[13px] font-medium text-muted", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  error?: string | string[];
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {msg ? (
        <p role="alert" className="ps-1 text-[13px] text-danger">
          {msg}
        </p>
      ) : hint ? (
        <p className="ps-1 text-[13px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** iOS segmented control. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; count?: number }[];
  className?: string;
  label: string;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div role="tablist" aria-label={label} className={cn("relative grid rounded-[10px] bg-fill p-0.5", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span
        aria-hidden
        className="absolute inset-y-0.5 rounded-[8px] bg-surface shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:bg-surface-3"
        style={{ width: `calc((100% - 4px) / ${options.length})`, insetInlineStart: 2, transform: `translateX(calc(${idx} * -100%))` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn("relative z-10 h-8 truncate px-2 text-[13px] transition-colors", o.value === value ? "font-semibold" : "font-medium text-foreground/80")}
        >
          {o.label}
          {o.count ? <span className="text-muted"> · <span className="num">{o.count}</span></span> : null}
        </button>
      ))}
    </div>
  );
}
