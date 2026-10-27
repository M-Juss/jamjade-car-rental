"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type InputWithLabelProps = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  wrapperClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
} & React.ComponentPropsWithoutRef<typeof Input>;

export const InputWithLabel = forwardRef<HTMLInputElement, InputWithLabelProps>(
  (
    {
      id,
      label,
      icon,
      type = "text",
      placeholder,
      disabled = false,
      required = false,
      error,
      wrapperClassName,
      labelClassName,
      inputClassName,
      ...props
    },
    ref,
  ) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const isPassword = type === "password";
    const input = (
      <Input
        ref={ref}
        id={id}
        type={isPassword && isPasswordVisible ? "text" : type}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        className={cn(
          "h-9 rounded-xl border-border bg-background px-3 text-[12.5px] text-foreground",
          "placeholder:text-subtle-foreground shadow-none",
          "focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-white",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-destructive focus-visible:ring-destructive/30",
          inputClassName,
          isPassword && "pr-11",
        )}
        {...props}
      />
    );

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
        {isPassword ? (
          <div className="relative">
            {input}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute inset-y-0 right-1 h-auto w-9 text-muted-foreground"
              disabled={disabled}
              aria-label={`${isPasswordVisible ? "Hide" : "Show"} ${label.toLowerCase()}`}
              aria-controls={id}
              aria-pressed={isPasswordVisible}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setIsPasswordVisible((visible) => !visible)}
            >
              {isPasswordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
        ) : input}
        {error ? (
          <p className="text-[10.5px] font-medium leading-tight text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

InputWithLabel.displayName = "InputWithLabel";
