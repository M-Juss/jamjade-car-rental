import type { ComponentProps, ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = Omit<ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  wrapperClassName?: string;
  endAdornment?: ReactNode;
};

export function SearchInput({
  value,
  onValueChange,
  placeholder = "Search...",
  "aria-label": ariaLabel,
  wrapperClassName,
  className,
  endAdornment,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn("relative min-w-0", wrapperClassName)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-subtle-foreground"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          "h-11 rounded-lg border-input bg-surface pl-9 text-base sm:text-sm focus-visible:ring-1 focus-visible:ring-primary",
          endAdornment && "pr-9",
          className,
        )}
        {...props}
      />
      {endAdornment}
    </div>
  );
}
