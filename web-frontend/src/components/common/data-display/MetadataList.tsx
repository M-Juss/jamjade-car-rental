import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetadataList({ items, className }: {
  items: readonly { label: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-2 text-xs", className)}>
      {items.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 break-words font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
