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
        <Input
          ref={ref}
          id={id}
          type={type}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "h-9 rounded-xl border-[#E8ECF4] bg-[#F8F9FC] px-3 text-[12.5px] text-[#1A2340]",
            "placeholder:text-[#A0AABF] shadow-none",
            "focus-visible:ring-1 focus-visible:ring-[#346EF6] focus-visible:bg-white",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            inputClassName,
          )}
          {...props}
        />
      </div>
    );
  },
);

InputWithLabel.displayName = "InputWithLabel";