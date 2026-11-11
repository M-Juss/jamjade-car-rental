import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPhilippinePeso } from "@/lib/formatters/currency";
import type { DashboardOverview } from "@/services/report";

export function DashboardSnapshot({ overview, basePath }: { overview: DashboardOverview; basePath: string }) {
  const fleet = [
    { label: "Available", count: overview.fleet?.available ?? 0, color: "bg-success" },
    { label: "Rented", count: overview.fleet?.rented ?? 0, color: "bg-primary" },
    { label: "Maintenance", count: overview.fleet?.maintenance ?? 0, color: "bg-warning" },
    { label: "Unavailable", count: overview.fleet?.unavailable ?? 0, color: "bg-muted-foreground" },
  ];
  const totalVehicles = fleet.reduce((total, item) => total + item.count, 0);

  return (
    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:h-full xl:grid-cols-1 xl:gap-3">
      {overview.fleet !== null && (
        <Card className="bg-surface shadow-none xl:py-3">
          <CardContent className="flex flex-col gap-3 px-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Fleet status</h2>
              <Link href={`${basePath}/vehicle`} className="text-xs font-medium text-primary underline-offset-4 hover:underline">View vehicles</Link>
            </div>
            <div className="space-y-3">
              <p className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">{totalVehicles}</span>
                <span className="text-xs text-muted-foreground">{totalVehicles === 1 ? "vehicle" : "vehicles"}</span>
              </p>
              {totalVehicles > 0 && (
                <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  {fleet.filter(({ count }) => count > 0).map(({ label, count, color }) => (
                    <span key={label} className={color} style={{ flexGrow: count }} />
                  ))}
                </div>
              )}
              <dl className="flex flex-wrap gap-x-2 gap-y-2">
                {fleet.map(({ label, count, color }) => (
                  <div key={label} className="flex min-w-max grow basis-[45%] items-center justify-between gap-1 text-xs">
                    <dt className="flex items-center gap-1 whitespace-nowrap text-muted-foreground">
                      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${color}`} />
                      {label}
                    </dt>
                    <dd className="font-semibold tabular-nums">{count}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </CardContent>
        </Card>
      )}
      {overview.maintenance !== null && (
        <Card className="bg-surface shadow-none xl:py-3">
          <CardContent className="flex flex-1 flex-col gap-2 px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Maintenance</h2>
              <Link href={`${basePath}/maintenance`} className="text-xs font-medium text-primary underline-offset-4 hover:underline">View maintenance</Link>
            </div>
            <dl className="grid flex-1 auto-rows-fr gap-1 text-xs">
              {[
                { label: "Overdue plans", count: overview.maintenance.overdue },
                { label: "Due soon", count: overview.maintenance.dueSoon },
                { label: "Scheduled jobs", count: overview.maintenance.scheduled },
                { label: "In progress", count: overview.maintenance.inProgress },
              ].map(({ label, count }) => (
                <div key={label} className="flex items-center justify-between gap-2 py-1">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-semibold tabular-nums">{count}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
      {(overview.pendingDocuments !== null || overview.awaitingPayment !== null) && (
        <Card className="rounded-2xl border-border bg-surface shadow-none xl:py-3"><CardContent className="px-5">
          <h2 className="mb-2 text-sm font-semibold">Pending follow-ups</h2>
          <div className="divide-y divide-border">
            {overview.pendingDocuments !== null && <Link href={`${basePath}/verification-queue`} className="flex items-center justify-between gap-3 py-3 text-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"><span>Documents awaiting review</span><span className="flex items-center gap-2 font-semibold tabular-nums">{overview.pendingDocuments}<ChevronRight className="size-4" /></span></Link>}
            {overview.awaitingPayment !== null && <Link href={`${basePath}/booking?status=pending`} className="flex items-center justify-between gap-3 py-3 text-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"><span>Bookings awaiting payment</span><span className="flex items-center gap-2 font-semibold tabular-nums">{overview.awaitingPayment}<ChevronRight className="size-4" /></span></Link>}
          </div>
        </CardContent></Card>
      )}
      {overview.balances !== null && (
        <Card className="rounded-2xl border-border bg-surface shadow-none xl:py-3"><CardContent className="px-5">
          <h2 className="text-sm font-semibold">Outstanding customer balances</h2>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatPhilippinePeso(overview.balances.amount)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{overview.balances.bookings === 1 ? "1 booking with a balance" : `${overview.balances.bookings} bookings with a balance`}</p>
          <Button asChild variant="outline" size="sm" className="mt-3"><Link href={`${basePath}/booking`}>Review bookings</Link></Button>
        </CardContent></Card>
      )}
    </div>
  );
}
