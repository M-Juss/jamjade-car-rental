"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  PhilippinePeso,
  Phone,
  UserRound,
} from "lucide-react";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enUS } from "date-fns/locale";
import {
  Calendar,
  dateFnsLocalizer,
  type Event,
  type View,
} from "react-big-calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { formatPhilippinePeso } from "@/lib/formatters/currency";
import { GENERIC_ERROR_MESSAGE } from "@/services/http";
import {
  getDashboard,
  type DashboardCalendarEvent,
  type DashboardResponse,
} from "@/services/report";

type RentalCalendarEvent = Omit<DashboardCalendarEvent, "start" | "end"> & Event & {
  start: Date;
  end: Date;
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 0 }),
  getDay,
  locales: { "en-US": enUS },
});

const bookingStatusStyle: Record<DashboardCalendarEvent["status"], string> = {
  confirmed: "border-blue-200 bg-muted text-primary",
  ongoing: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function messageFromError() {
  return GENERIC_ERROR_MESSAGE;
}

function dateRangeForView(date: Date, view: View) {
  if (view === "day") {
    return { start: date, end: date };
  }

  if (view === "week") {
    return {
      start: startOfWeek(date, { weekStartsOn: 0 }),
      end: endOfWeek(date, { weekStartsOn: 0 }),
    };
  }

  return {
    start: startOfWeek(startOfMonth(date), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(date), { weekStartsOn: 0 }),
  };
}

function periodLabel(date: Date, view: View) {
  if (view === "day") {
    return format(date, "MMMM d, yyyy");
  }

  if (view === "week") {
    const range = dateRangeForView(date, view);
    return `${format(range.start, "MMM d")} - ${format(range.end, "MMM d, yyyy")}`;
  }

  return format(date, "MMMM yyyy");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function moveDate(date: Date, view: View, direction: -1 | 1) {
  if (view === "day") return addDays(date, direction);
  if (view === "week") return addWeeks(date, direction);

  return addMonths(date, direction);
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<View>("month");
  const [selectedEvent, setSelectedEvent] = useState<DashboardCalendarEvent | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  function beginLoad() {
    setError("");
    setIsLoading(true);
  }

  function changeDate(date: Date) {
    beginLoad();
    setCurrentDate(date);
  }

  function changeView(nextView: View) {
    beginLoad();
    setView(nextView);
  }

  function retry() {
    beginLoad();
    setReloadKey((key) => key + 1);
  }

  useEffect(() => {
    let active = true;
    const range = dateRangeForView(currentDate, view);

    getDashboard(format(range.start, "yyyy-MM-dd"), format(range.end, "yyyy-MM-dd"))
      .then((response) => {
        if (active) setData(response);
      })
      .catch(() => {
        if (active) setError(messageFromError());
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentDate, reloadKey, view]);

  if (!data && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Loading dashboard
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="max-w-md rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <CardContent className="flex items-start gap-3 p-5">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-500" />
            <div>
              <p className="font-semibold text-foreground">Dashboard could not be loaded</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" size="sm" onClick={retry}>
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const events: RentalCalendarEvent[] = data.events.map((event) => ({
    ...event,
    title: `${event.bookingCode} - ${event.vehicleName}`,
    start: new Date(event.start),
    end: new Date(event.end),
  }));
  const kpis = [
    {
      label: "Month Revenue",
      value: formatPhilippinePeso(data.summary.monthRevenue, true),
      icon: PhilippinePeso,
      iconClassName: "bg-muted text-primary",
    },
    {
      label: "Confirmed Bookings",
      value: data.summary.confirmedBookings.toLocaleString(),
      icon: CalendarCheck,
      iconClassName: "bg-muted text-primary",
    },
    {
      label: "Active Rentals",
      value: data.summary.activeRentals.toLocaleString(),
      icon: Car,
      iconClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Today's Pickups",
      value: data.summary.todaysPickups.toLocaleString(),
      icon: CalendarClock,
      iconClassName: "bg-violet-50 text-violet-600",
    },
  ];

  return (
    <div className="min-h-screen space-y-6 bg-background p-4 md:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Overview of confirmed and active rentals across your fleet.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map(({ label, value, icon, iconClassName }) => (
          <KpiCard
            key={label}
            label={label}
            value={value}
            icon={icon}
            iconClassName={iconClassName}
          />
        ))}
      </div>

      <Card className="overflow-hidden rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <CardContent className="px-5 pb-5">
          {error ? (
            <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-destructive-border bg-destructive-surface px-3 py-2.5 text-[12px] text-destructive">
              <span>{error}</span>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={retry}>
                Retry
              </Button>
            </div>
          ) : null}

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon-sm" aria-label="Previous period" onClick={() => changeDate(moveDate(currentDate, view, -1))}>
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="sm" onClick={() => changeDate(new Date())}>Today</Button>
              <Button variant="outline" size="icon-sm" aria-label="Next period" onClick={() => changeDate(moveDate(currentDate, view, 1))}>
                <ChevronRight />
              </Button>
              <p className="ml-2 text-[13px] font-bold text-foreground">{periodLabel(currentDate, view)}</p>
            </div>
            <div className="flex w-full rounded-xl border border-border bg-background p-1 sm:w-auto">
              {(["month", "week", "day"] as View[]).map((option) => (
                <Button
                  key={option}
                  variant={view === option ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1 capitalize sm:flex-none"
                  onClick={() => changeView(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>

          <div className="relative overflow-x-auto">
            {isLoading ? (
              <div className="absolute inset-x-0 top-0 z-10 flex justify-end p-2 text-primary">
                <Loader2 className="size-4 animate-spin" aria-label="Loading rentals" />
              </div>
            ) : null}
            <div className="dashboard-calendar min-w-[680px]">
              <Calendar<RentalCalendarEvent>
                localizer={localizer}
                events={events}
                date={currentDate}
                view={view}
                toolbar={false}
                startAccessor="start"
                endAccessor="end"
                onNavigate={changeDate}
                onView={changeView}
                onDrillDown={(date) => {
                  beginLoad();
                  setCurrentDate(date);
                  setView("day");
                }}
                onSelectEvent={(event) => {
                  setSelectedEvent(data.events.find((item) => item.id === event.id) ?? null);
                }}
                eventPropGetter={(event) => ({
                  className: `dashboard-calendar-event dashboard-calendar-event--${event.status}`,
                })}
                components={{
                  event: ({ event }) => (
                    <div className="leading-tight">
                      <span className="block truncate font-semibold">{event.bookingCode}</span>
                      <span className="block truncate opacity-85">{event.vehicleName}</span>
                    </div>
                  ),
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <SheetContent side="right" className="w-full gap-0 border-l border-border p-0 sm:max-w-[720px]">
          <SheetHeader className="border-b border-border px-5 pb-4 pt-5">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div>
                <SheetTitle className="text-[15px] font-bold text-foreground">Rental Details</SheetTitle>
                <SheetDescription className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">
                  {selectedEvent?.bookingCode}
                </SheetDescription>
              </div>
              {selectedEvent ? (
                <Badge className={`border ${bookingStatusStyle[selectedEvent.status]}`}>
                  {selectedEvent.statusLabel}
                </Badge>
              ) : null}
            </div>
          </SheetHeader>

          {selectedEvent ? (
            <ScrollArea className="h-[calc(100vh-76px)]">
              <div className="space-y-4 px-5 py-4">
                <div className="rounded-2xl border border-border bg-white p-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">Customer Information</p>
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-primary"><UserRound size={18} /></div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-foreground">{selectedEvent.customerName}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
                        {selectedEvent.customerEmail ? <span className="flex items-center gap-1.5"><Mail size={11} />{selectedEvent.customerEmail}</span> : null}
                        {selectedEvent.customerPhone ? <span className="flex items-center gap-1.5"><Phone size={11} />{selectedEvent.customerPhone}</span> : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-white p-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">Rental Information</p>
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><dt className="flex items-center gap-1.5 text-[11px] text-subtle-foreground"><Car size={12} />Vehicle</dt><dd className="mt-1 text-[12.5px] font-semibold text-foreground">{selectedEvent.vehicleName}</dd></div>
                    <div><dt className="text-[11px] text-subtle-foreground">Plate Number</dt><dd className="mt-1 text-[12.5px] font-semibold text-foreground">{selectedEvent.vehiclePlate || "Not recorded"}</dd></div>
                    <div><dt className="text-[11px] text-subtle-foreground">Rental Type</dt><dd className="mt-1 text-[12.5px] font-semibold text-foreground">{selectedEvent.rentalType}</dd></div>
                    <div><dt className="text-[11px] text-subtle-foreground">Assigned Driver</dt><dd className="mt-1 text-[12.5px] font-semibold text-foreground">{selectedEvent.driverName || "Self-drive"}</dd></div>
                  </dl>
                </div>

                <div className="rounded-2xl border border-border bg-white p-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">Schedule and Locations</p>
                  <dl className="space-y-3">
                    <div><dt className="flex items-center gap-1.5 text-[11px] text-subtle-foreground"><CalendarDays size={12} />Pickup</dt><dd className="mt-1 text-[12.5px] font-semibold text-foreground">{formatDateTime(selectedEvent.start)}</dd></div>
                    <div><dt className="flex items-center gap-1.5 text-[11px] text-subtle-foreground"><Clock3 size={12} />Return</dt><dd className="mt-1 text-[12.5px] font-semibold text-foreground">{formatDateTime(selectedEvent.end)}</dd></div>
                    <div><dt className="flex items-center gap-1.5 text-[11px] text-subtle-foreground"><MapPin size={12} />Pickup Location</dt><dd className="mt-1 text-[12.5px] font-semibold text-foreground">{selectedEvent.pickupLocation || "Not recorded"}</dd></div>
                    <div><dt className="flex items-center gap-1.5 text-[11px] text-subtle-foreground"><MapPin size={12} />Return Location</dt><dd className="mt-1 text-[12.5px] font-semibold text-foreground">{selectedEvent.returnLocation || "Not recorded"}</dd></div>
                  </dl>
                </div>

                <div className="rounded-2xl border border-border bg-white p-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">Payment</p>
                  <dl className="grid grid-cols-2 gap-3">
                    <div><dt className="flex items-center gap-1.5 text-[11px] text-subtle-foreground"><PhilippinePeso size={12} />Total Amount</dt><dd className="mt-1 text-[12.5px] font-semibold text-foreground">{formatPhilippinePeso(selectedEvent.totalAmount)}</dd></div>
                    <div><dt className="flex items-center gap-1.5 text-[11px] text-subtle-foreground"><CreditCard size={12} />Payment Status</dt><dd className="mt-1 text-[12.5px] font-semibold text-foreground">{selectedEvent.paymentStatus}</dd></div>
                  </dl>
                </div>

                {selectedEvent.notes || selectedEvent.adminNotes ? (
                  <div className="rounded-2xl border border-border bg-white p-4">
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">Notes</p>
                    {selectedEvent.notes ? (
                      <div>
                        <p className="text-[11px] text-subtle-foreground">Customer Notes</p>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-foreground">{selectedEvent.notes}</p>
                      </div>
                    ) : null}
                    {selectedEvent.adminNotes ? (
                      <div className={selectedEvent.notes ? "mt-3 border-t border-border pt-3" : undefined}>
                        <p className="text-[11px] text-subtle-foreground">Internal Notes</p>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-foreground">{selectedEvent.adminNotes}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
