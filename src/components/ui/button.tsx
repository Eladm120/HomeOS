import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** iOS button styles: filled, tinted, gray, plain, destructive. */
export const buttonVariants = cva(
  "pressable inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap font-semibold tracking-[-0.01em] disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "bg-fill text-foreground hover:bg-fill-strong",
        outline: "glass text-foreground",
        ghost: "text-primary hover:bg-fill",
        soft: "bg-primary-soft text-primary",
        danger: "bg-danger text-white",
        "danger-ghost": "text-danger hover:bg-danger-soft",
        contrast: "bg-foreground text-background",
      },
      size: {
        sm: "h-8 rounded-full px-3.5 text-[15px] [&_svg]:size-4",
        md: "h-11 rounded-full px-5 text-[17px] [&_svg]:size-[18px]",
        lg: "h-[52px] rounded-2xl px-6 text-[17px] [&_svg]:size-5",
        icon: "size-11 rounded-full [&_svg]:size-[22px]",
        "icon-sm": "size-8 rounded-full [&_svg]:size-[17px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
