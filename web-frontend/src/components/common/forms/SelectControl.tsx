import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectControlHeight = "compact" | "default" | "large";

export type SelectControlProps = {
  id?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  options: readonly SelectOption[];
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  prefix?: ReactNode;
  height?: SelectControlHeight;
  triggerClassName?: string;
  contentClassName?: string;
};

const triggerHeightClasses: Record<SelectControlHeight, string> = {
  compact: "data-[size=default]:h-8",
  default: "data-[size=default]:h-9",
  large: "data-[size=default]:h-10",
};

export function SelectControl({
  id,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select an option",
  options,
  disabled = false,
  invalid = false,
  ariaLabel,
  prefix,
  height = "default",
  triggerClassName,
  contentClassName,
}: SelectControlProps) {
  const controlledValue = onValueChange ? (value ?? "") : value;

  return (
    <Select
      value={controlledValue}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        className={cn(
          "w-full min-w-0 max-w-full rounded-xl border-border bg-background px-3 text-[12.5px] text-muted-foreground shadow-none",
          triggerHeightClasses[height],
          "data-[placeholder]:text-subtle-foreground focus:ring-1 focus:ring-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-destructive focus:ring-destructive/30",
          triggerClassName,
        )}
      >
        {prefix}
        <span className="min-w-0 flex-1 truncate text-left">
          <SelectValue placeholder={placeholder} />
        </span>
      </SelectTrigger>
      <SelectContent
        align="start"
        className={cn(
          "w-[var(--radix-select-trigger-width)] min-w-0 max-w-[calc(100vw-2rem)] rounded-xl border-border",
          contentClassName,
        )}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="rounded-lg text-[12.5px] text-muted-foreground"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
