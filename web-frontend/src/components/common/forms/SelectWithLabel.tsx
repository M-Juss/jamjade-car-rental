import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  SelectControl,
  type SelectControlHeight,
  type SelectOption,
} from "./SelectControl";

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
  height?: SelectControlHeight;
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
  height = "default",
  wrapperClassName,
  labelClassName,
  triggerClassName,
  contentClassName,
}: SelectWithLabelProps) {
  return (
    <div className={cn("grid w-full min-w-0 grid-cols-1 gap-1.5", wrapperClassName)}>
      {label ? (
        <Label
          htmlFor={id}
          className={cn(
            "text-xs font-medium normal-case tracking-normal text-subtle-foreground",
            labelClassName,
          )}
        >
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      ) : null}
      <SelectControl
        id={id}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        placeholder={placeholder}
        options={options}
        disabled={disabled}
        invalid={Boolean(error)}
        ariaLabel={label || placeholder}
        height={height}
        triggerClassName={triggerClassName}
        contentClassName={contentClassName}
      />
      {error ? (
        <p className="text-xs font-medium leading-tight text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
