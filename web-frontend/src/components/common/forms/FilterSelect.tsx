import { cn } from "@/lib/utils";
import {
  SelectControl,
  type SelectControlHeight,
  type SelectOption,
} from "./SelectControl";

type FilterSelectProps<T extends string> = {
  value: T;
  options: readonly SelectOption[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: string;
  prefixLabel?: string;
  disabled?: boolean;
  height?: SelectControlHeight;
  className?: string;
  contentClassName?: string;
};

export function FilterSelect<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  placeholder,
  prefixLabel,
  disabled,
  height = "default",
  className,
  contentClassName,
}: FilterSelectProps<T>) {
  return (
    <SelectControl
      value={value}
      options={options}
      onValueChange={(nextValue) => onValueChange(nextValue as T)}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      disabled={disabled}
      height={height}
      prefix={
        prefixLabel ? (
          <span className="mr-1 shrink-0 font-semibold text-muted-foreground">{prefixLabel}</span>
        ) : undefined
      }
      triggerClassName={cn(
        "w-full rounded-lg border-input bg-surface text-base sm:text-sm",
        className,
      )}
      contentClassName={contentClassName}
    />
  );
}
