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
      rows = 4,
      wrapperClassName,
      labelClassName,
      textareaClassName,
      ...props
    },
    ref,
  ) => {
    return (
      <div className={cn("grid w-full gap-1.5", wrapperClassName)}>
        <Label
          htmlFor={id}
          className={cn(
            "text-[11px] font-medium uppercase tracking-[0.08em] text-[#A0AABF]",
            labelClassName,
          )}
        >
          {icon && (
            <span className="mr-1.5 inline-flex items-center text-[#A0AABF]">
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
          className={cn(
            "rounded-xl border-[#E8ECF4] bg-[#F8F9FC] px-3 py-2.5 text-[12.5px] text-[#1A2340]",
            "placeholder:text-[#A0AABF] shadow-none resize-none",
            "focus-visible:ring-1 focus-visible:ring-[#346EF6] focus-visible:bg-white",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            textareaClassName,
          )}
          {...props}
        />
      </div>
    );
  },
);

TextAreaWithLabel.displayName = "TextAreaWithLabel";