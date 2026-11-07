import type { ReactNode } from "react";

type SummaryListProps = {
  items: readonly { label: string; value: ReactNode }[];
  label: string;
};

export function SummaryList({ items, label }: SummaryListProps) {
  return (
    <dl aria-label={label} className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <dt className="order-2">{item.label}</dt>
          <dd className="font-semibold tabular-nums text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
