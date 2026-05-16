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
  label: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  wrapperClassName?: string;
  labelClassName?: string;
  triggerClassName?: string;
  contentClassName?: string;
};

export function SelectWithLabel({
  id,
  label,
  placeholder = "Select an option",
  options,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  required = false,
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
          "text-[11px] font-medium uppercase tracking-[0.08em] text-[#A0AABF]",
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
          className={cn(
            "h-9 w-full rounded-xl border-[#E8ECF4] bg-[#F8F9FC] px-3 text-[12.5px] text-[#4A5568] shadow-none",
            "data-[placeholder]:text-[#A0AABF] focus:ring-1 focus:ring-[#346EF6]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            triggerClassName,
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent
          align="start"
          className={cn(
            "w-full min-w-[var(--radix-select-trigger-width)] rounded-xl border-[#E8ECF4]",
            contentClassName,
          )}
        >
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="text-[12.5px] text-[#4A5568] rounded-lg"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}