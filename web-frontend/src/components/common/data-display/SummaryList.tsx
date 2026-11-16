import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SummaryListProps = {
  items: readonly { label: string; value: ReactNode }[];
  label: string;
  labelFirst?: boolean;
  className?: string;
};

export function SummaryList({ items, label, labelFirst = false, className }: SummaryListProps) {
  return (
    <dl aria-label={label} className={cn("flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <dt className={labelFirst ? undefined : "order-2"}>{item.label}</dt>
          <dd className="font-semibold tabular-nums text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
