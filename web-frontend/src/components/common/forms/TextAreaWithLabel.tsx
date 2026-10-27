"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TextAreaWithLabelProps = Omit<
  React.ComponentProps<"textarea">,
  "readOnly" | "disabled"
> & {
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  wrapperClassName?: string;
  labelClassName?: string;
  textareaClassName?: string;
};

export const TextAreaWithLabel = React.forwardRef<
  HTMLTextAreaElement,
  TextAreaWithLabelProps
>(
  (
    {
      id,
      label,
      placeholder,
      icon,
      disabled = false,
      required = false,
      error,
      rows = 4,
      wrapperClassName,
      labelClassName,
      textareaClassName,
      ...props
    },
    ref,
  ) => {
    return (
      <div className={cn("grid w-full min-w-0 grid-cols-1 gap-1.5", wrapperClassName)}>
        <Label
          htmlFor={id}
          className={cn(
            "text-[11px] font-medium uppercase tracking-[0.08em] text-subtle-foreground",
            labelClassName,
          )}
        >
          {icon && (
            <span className="mr-1.5 inline-flex items-center text-subtle-foreground">
              {icon}
            </span>
          )}
          {label}
          {required && <span className="ml-0.5 text-rose-400">*</span>}
        </Label>
        <Textarea
          ref={ref}
          id={id}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className={cn(
            "rounded-xl border-border bg-background px-3 py-2.5 text-[12.5px] text-foreground",
            "placeholder:text-subtle-foreground shadow-none resize-none",
            "focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-white",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-destructive focus-visible:ring-destructive/30",
            textareaClassName,
          )}
          {...props}
        />
        {error ? (
          <p className="text-[10.5px] font-medium leading-tight text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

TextAreaWithLabel.displayName = "TextAreaWithLabel";
