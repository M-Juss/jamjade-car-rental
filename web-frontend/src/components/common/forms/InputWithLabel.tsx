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
  inputFormat?:
    | "integer"
    | "decimal"
    | "decimal3"
    | "signedDecimal"
    | "personName"
    | "vehicleText"
    | "color"
    | "plateNumber";
} & React.ComponentPropsWithoutRef<typeof Input>;

type InputFormat = NonNullable<InputWithLabelProps["inputFormat"]>;

function sanitizeInput(value: string, format: InputFormat) {
  if (format === "integer") return value.replace(/\D/g, "");

  if (["decimal", "decimal3", "signedDecimal"].includes(format)) {
    const signed = format === "signedDecimal" && value.trimStart().startsWith("-") ? "-" : "";
    const raw = value.replace(/-/g, "");
    const pieces = raw.replace(/[^\d.]/g, "").split(".");
    const whole = pieces.shift() ?? "";
    const fraction = pieces.join("");
    const maxFractionDigits = format === "decimal3" ? 3 : format === "signedDecimal" ? 8 : 2;
    return `${signed}${whole}${pieces.length || raw.includes(".") ? `.${fraction.slice(0, maxFractionDigits)}` : ""}`;
  }

  if (format === "personName") return value.replace(/[^\p{L}\p{M} '\u2019-]/gu, "");
  if (format === "color") return value.replace(/[^\p{L}\p{M} /-]/gu, "");
  if (format === "plateNumber") {
    return value.replace(/[^\p{L}\p{N} -]/gu, "").replace(/\s+/g, " ").toUpperCase();
  }
  return value.replace(/[^\p{L}\p{M}\p{N} .&'\u2019()\/+\-]/gu, "");
}

function defaultInputMode(format?: InputFormat): React.HTMLAttributes<HTMLInputElement>["inputMode"] {
  if (format === "integer") return "numeric";
  if (["decimal", "decimal3", "signedDecimal"].includes(format ?? "")) return "decimal";
  return undefined;
}

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
      inputFormat,
      inputMode,
      onChange,
      ...props
    },
    ref,
  ) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const isPassword = type === "password";
    const isTextNumeric = ["integer", "decimal", "decimal3", "signedDecimal"].includes(inputFormat ?? "");
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (inputFormat) event.currentTarget.value = sanitizeInput(event.currentTarget.value, inputFormat);
      onChange?.(event);
    };
    const input = (
      <Input
        {...props}
        ref={ref}
        id={id}
        type={isPassword && isPasswordVisible ? "text" : isTextNumeric ? "text" : type}
        inputMode={inputMode ?? defaultInputMode(inputFormat)}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        className={cn(
          "h-11 rounded-lg border-input bg-surface px-3 text-base sm:text-sm text-foreground",
          "placeholder:text-subtle-foreground shadow-none",
          "focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-surface",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-destructive focus-visible:ring-destructive/30",
          inputClassName,
          isPassword && "pr-11",
        )}
      />
    );

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
          <p className="text-xs font-medium leading-tight text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

InputWithLabel.displayName = "InputWithLabel";
