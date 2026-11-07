import { DrivingLog } from "@/modules/management/fleet-tracker/data/mock-fleet-tracker";

const severityStyles: Record<DrivingLog["severity"], string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-rose-500",
};

export function DrivingLogTimeline({ logs }: { logs: DrivingLog[] }) {
  if (!logs.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        No driving logs yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="flex gap-2">
          <div className="flex flex-col items-center">
            <span className={`h-2 w-2 rounded-full ${severityStyles[log.severity]}`} />
            <span className="mt-1 h-full w-px bg-slate-200" />
          </div>
          <div className="flex-1 rounded-lg border border-border bg-slate-50/70 p-2 shadow-none">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">{log.type}</p>
              <p className="text-xs text-muted-foreground">{log.timestamp}</p>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{log.note}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
