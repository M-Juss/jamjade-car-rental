import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardOverview } from "@/services/report";
import { dashboardDateTime } from "./dashboard-format";

export function DashboardOperations({ overview, basePath }: { overview: DashboardOverview; basePath: string }) {
  return (
    <div className="space-y-6">
      {overview.operations !== null && (
        <Card className="rounded-2xl border-border bg-surface shadow-none">
          <CardContent className="px-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Today’s pickups and returns</h2>
                <p className="mt-1 text-xs text-muted-foreground">{dashboardDateTime(`${overview.today}T12:00:00+08:00`, { weekday: "long", month: "long", day: "numeric" })}</p>
              </div>
              <Button asChild variant="outline" size="sm"><Link href={`${basePath}/booking`}>View bookings<ChevronRight className="size-4" /></Link></Button>
            </div>
            {overview.operations.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No pickups or outstanding returns scheduled today.</p>
            ) : (
              <ul className="grid gap-x-6 lg:grid-cols-2" aria-label="Today’s rental operations">
                {overview.operations.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="border-b border-border">
                    <Link href={`${basePath}/booking?booking=${item.id}`} className="flex items-start gap-3 rounded-lg py-4 outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="w-20 shrink-0 space-y-2">
                        <p className="text-sm font-semibold tabular-nums">{dashboardDateTime(item.at, { hour: "numeric", minute: "2-digit" })}</p>
                        <Badge variant="outline" className={item.kind === "pickup" ? "border-border bg-muted text-primary" : "border-success-border bg-success-surface text-success"}>
                          {item.kind === "pickup" ? <ArrowUpRight /> : <ArrowDownLeft />}{item.kind === "pickup" ? "Pickup" : "Return"}
                        </Badge>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-semibold [overflow-wrap:anywhere]">{item.vehicleName}</p>
                        <p className="text-xs text-muted-foreground">{item.vehiclePlate || "No plate recorded"}</p>
                        <p className="text-sm [overflow-wrap:anywhere]">{item.customerName}</p>
                        <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{item.location || "Location not recorded"}</p>
                        <p className="text-xs text-muted-foreground">{item.rentalType === "self_drive" ? "Self-drive" : item.driverName ? `Driver: ${item.driverName}` : "Driver not assigned"}</p>
                        <p className="font-mono text-xs text-primary">{item.bookingCode}</p>
                      </div>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {(overview.operationsTotal ?? 0) > overview.operations.length && <p className="mt-4 text-xs text-muted-foreground">Showing the first {overview.operations.length} of {overview.operationsTotal} scheduled actions.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
