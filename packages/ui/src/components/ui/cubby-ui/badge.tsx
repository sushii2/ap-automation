import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@workspace/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap outline-0 -outline-offset-1 outline-transparent transition-[outline-width,outline-color] duration-100 ease-out outline-solid focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring aria-invalid:outline-2 aria-invalid:-outline-offset-1 aria-invalid:outline-destructive aria-invalid:outline-solid [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-[0_1px_3px_0_oklch(0.22_0_0_/_0.12)]",
        neutral: "border-transparent bg-neutral text-neutral-foreground",
        outline: "border-(--outline-border) bg-(--outline) text-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        success: "border-transparent bg-success text-success-foreground",
        warning: "border-transparent bg-warning text-warning-foreground",
        info: "border-transparent bg-info text-info-foreground",
        danger: "border-transparent bg-danger text-danger-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
