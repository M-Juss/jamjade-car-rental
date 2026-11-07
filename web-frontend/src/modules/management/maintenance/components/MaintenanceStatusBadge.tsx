import { Badge } from "@/components/ui/badge";

const statusStyles: Record<string, string> = {
  scheduled: "border-primary/20 bg-muted text-primary",
  in_progress: "border-warning-border bg-warning-surface text-warning",
  completed: "border-success-border bg-success-surface text-success",
  cancelled: "border-border bg-background text-muted-foreground",
  due_soon: "border-warning-border bg-warning-surface text-warning",
  due: "border-warning-border bg-warning-surface text-warning",
  overdue: "border-destructive-border bg-destructive-surface text-destructive",
  upcoming: "border-border bg-background text-muted-foreground",
};

export function MaintenanceStatusBadge({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <Badge
      variant="outline"
      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${statusStyles[value] ?? statusStyles.cancelled}`}
    >
      {label}
    </Badge>
  );
}
