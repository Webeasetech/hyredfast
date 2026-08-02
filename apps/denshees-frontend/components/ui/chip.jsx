import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Chip
 *
 * A bordered inline token. An optional `icon` sits in its own compartment on the
 * left, divided from the label by the same hairline that outlines the chip — so
 * the divider reads as part of the outline rather than an extra rule.
 */
const chipVariants = cva(
  "inline-flex items-center overflow-hidden rounded-md border align-middle font-medium",
  {
    variants: {
      variant: {
        default: "border-border bg-background text-foreground",
        primary: "border-primary/30 bg-primary/5 text-primary",
        muted: "border-border bg-muted text-muted-foreground",
      },
      size: {
        sm: "text-[11px]",
        md: "text-xs",
        lg: "text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

// Padding scales with size on both compartments so the divider stays centred.
const SIZES = {
  sm: { icon: "px-1 py-0.5", glyph: "size-3", label: "px-1.5 py-0.5" },
  md: { icon: "px-1.5 py-1", glyph: "size-3.5", label: "px-2 py-0.5" },
  lg: { icon: "px-2 py-1.5", glyph: "size-4", label: "px-2.5 py-1" },
};

const Chip = React.forwardRef(
  ({ className, variant, size = "md", icon, children, ...props }, ref) => {
    const s = SIZES[size] ?? SIZES.md;

    return (
      <span
        ref={ref}
        className={cn(chipVariants({ variant, size }), className)}
        {...props}
      >
        {icon && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center justify-center self-stretch border-r border-inherit",
              s.icon,
            )}
          >
            <span
              className={cn(
                "inline-flex items-center justify-center [&_svg]:size-full",
                s.glyph,
              )}
            >
              {icon}
            </span>
          </span>
        )}
        <span className={s.label}>{children}</span>
      </span>
    );
  },
);
Chip.displayName = "Chip";

export { Chip, chipVariants };
