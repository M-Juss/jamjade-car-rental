import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = Omit<ComponentProps<typeof Card>, "children"> & {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  description?: ReactNode;
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  description,
  className,
  ...props
}: KpiCardProps) {
  return (
    <Card
      className={cn(
        "h-full rounded-2xl border border-border bg-surface py-0 shadow-none",
        className,
      )}
      {...props}
    >
      <CardContent className="flex h-full items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 break-words text-2xl font-semibold leading-tight tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          {description ? (
            <p className="mt-1 text-xs leading-tight text-subtle-foreground">{description}</p>
          ) : null}
        </div>
        <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
      </CardContent>
    </Card>
  );
}
