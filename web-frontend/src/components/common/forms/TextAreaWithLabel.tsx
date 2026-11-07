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
            "text-xs font-medium normal-case tracking-normal text-subtle-foreground",
            labelClassName,
          )}
        >
          {icon && (
            <span className="mr-1.5 inline-flex items-center text-subtle-foreground">
              {icon}
            </span>
          )}
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        <Textarea
          ref={ref}
          id={id}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className={cn(
            "rounded-lg border-input bg-surface px-3 py-2.5 text-base sm:text-sm text-foreground",
            "placeholder:text-subtle-foreground shadow-none resize-y",
            "focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-surface",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-destructive focus-visible:ring-destructive/30",
            textareaClassName,
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs font-medium leading-tight text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

TextAreaWithLabel.displayName = "TextAreaWithLabel";
