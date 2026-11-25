import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@workspace/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";

const textareaVariants = cva(
  [
    "placeholder:text-muted-foreground",
    "border border-transparent",
    "aria-invalid:outline-2 aria-invalid:-outline-offset-1 aria-invalid:outline-destructive aria-invalid:outline-solid",
    "flex field-sizing-content min-h-20 w-full rounded-lg px-4 py-3 text-base transition-colors duration-200 outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:not-pointer-coarse:text-sm",
    "outline-0 -outline-offset-1 outline-transparent transition-[outline-width,outline-color] duration-100 ease-out outline-solid focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring",
  ],
  {
    variants: {
      variant: {
        default: "bg-input",
        outline: "border-(--outline-border) bg-(--outline) bg-clip-padding",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

type TextareaProps = React.ComponentProps<"textarea"> &
  VariantProps<typeof textareaVariants>;

function Textarea({ className, variant, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      data-variant={variant ?? "default"}
      className={cn(textareaVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Textarea, textareaVariants, type TextareaProps };
