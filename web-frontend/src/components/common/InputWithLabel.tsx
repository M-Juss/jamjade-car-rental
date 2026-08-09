import { forwardRef } from "react";
import { cn } from "@/lib/utils";
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
    return (
      <div className={cn("grid w-full gap-1.5", wrapperClassName)}>
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
        <Input
          ref={ref}
          id={id}
          type={type}
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

InputWithLabel.displayName = "InputWithLabel";
