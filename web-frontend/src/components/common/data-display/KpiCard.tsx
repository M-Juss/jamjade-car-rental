import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = Omit<ComponentProps<typeof Card>, "children"> & {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  iconClassName?: string;
  description?: ReactNode;
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  iconClassName,
  description,
  className,
  ...props
}: KpiCardProps) {
  return (
    <Card
      className={cn(
        "h-full min-h-24 rounded-2xl border border-border bg-surface py-0 shadow-[0_4px_14px_rgba(23,49,95,0.05)] ring-0",
        className,
      )}
      {...props}
    >
      <CardContent className="flex h-full items-center gap-3 p-4">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary sm:size-11",
            iconClassName,
          )}
        >
          <Icon className="size-5" strokeWidth={2.2} aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <p className="break-words text-2xl font-bold leading-none tracking-tight text-foreground">
            {value}
          </p>
          <p className="mt-1 text-xs font-medium leading-tight text-muted-foreground">
            {label}
          </p>
          {description ? (
            <p className="mt-1 text-xs leading-tight text-subtle-foreground">{description}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
