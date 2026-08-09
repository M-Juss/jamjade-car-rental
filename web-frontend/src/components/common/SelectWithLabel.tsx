import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SelectOption = {
  value: string;
  label: string;
};

type SelectWithLabelProps = {
  id: string;
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  wrapperClassName?: string;
  labelClassName?: string;
  triggerClassName?: string;
  contentClassName?: string;
};

export function SelectWithLabel({
  id,
  label = "",
  placeholder = "Select an option",
  options,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  required = false,
  error,
  wrapperClassName,
  labelClassName,
  triggerClassName,
  contentClassName,
}: SelectWithLabelProps) {
  return (
    <div className={cn("grid w-full gap-1.5", wrapperClassName)}>
      <Label
        htmlFor={id}
        className={cn(
          "text-[11px] font-medium uppercase tracking-[0.08em] text-subtle-foreground",
          labelClassName,
        )}
      >
        {label}
        {required && <span className="ml-0.5 text-rose-400">*</span>}
      </Label>
      <Select
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-9 w-full rounded-xl border-border bg-background px-3 text-[12.5px] text-muted-foreground shadow-none",
            "data-[placeholder]:text-subtle-foreground focus:ring-1 focus:ring-primary",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-destructive focus:ring-destructive/30",
            triggerClassName,
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent
          align="start"
          className={cn(
            "w-full min-w-[var(--radix-select-trigger-width)] rounded-xl border-border",
            contentClassName,
          )}
        >
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="text-[12.5px] text-muted-foreground rounded-lg"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p className="text-[10.5px] font-medium leading-tight text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
