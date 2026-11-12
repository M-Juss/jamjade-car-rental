"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";
import { useManagementSession } from "@/modules/management/shell/context/ManagementSessionProvider";
import { RentalDrivingEvents } from "@/modules/management/fleet-tracker/components/RentalDrivingEvents";
import { getBooking, type BookingRecord } from "@/services/booking";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { Button } from "@/components/ui/button";
import type { RentalDrivingEvents as DrivingEvents } from "@/services/fleet/fleet.service";
import { formatDrivingGrade, GradingDialog } from "./components/DrivingGradeDetails";
import { DrivingAnalysisOverview } from "./components/DrivingAnalysisOverview";

function operator(booking: BookingRecord) {
  return booking.driverOption === "self_drive" ? booking.customer?.name : booking.assignedDriver?.name;
}

function vehicleIdentity(booking: BookingRecord) {
  return [booking.brand, booking.vehicleName, booking.vehiclePlateNumber].filter(Boolean).join(" ");
}

function AnalysisContent() {
  const params = useSearchParams();
  const { portal, user } = useManagementSession();
  const selected = Number(params.get("booking"));
  const bookingId = Number.isSafeInteger(selected) && selected > 0 ? selected : null;
  const allowed = user?.permissions?.includes("manage bookings") && user.permissions.includes("view fleet tracker");
  const [analysis, setAnalysis] = useState<DrivingEvents | null>(null);
  const [detail, setDetail] = useState<BookingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const listQuery = new URLSearchParams(params.toString());
  listQuery.delete("booking");
  const base = `/${portal}/driving-analysis${listQuery.size ? `?${listQuery}` : ""}`;

  useEffect(() => {
    if (!allowed || !bookingId) return;
    let current = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(false);
      setDetail(null);
      setAnalysis(null);
      const load = async () => {
        try {
          const booking = await getBooking(bookingId);
          if (booking.statusKey !== "completed") throw new Error("Rental is not completed.");
          if (current) setDetail(booking);
        } catch { if (current) setError(true); }
        finally { if (current) setLoading(false); }
      };
      void load();
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [allowed, bookingId, reload]);

  return <div className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
    {!bookingId ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <ManagementPageHeading title="Driving Analysis" description="Review rental maneuvers, monitoring records, and driving events." />
    </div> : null}
    {!allowed ? <p role="status" className="text-sm text-muted-foreground">Booking and Fleet Monitoring access are required.</p> : <>
      {bookingId ? <div className="flex flex-wrap items-center justify-between gap-3"><nav aria-label="Driving analysis navigation" className="flex min-w-0 flex-wrap items-center gap-2">
        <Link href={base} className="group flex shrink-0 items-center gap-1.5 rounded-md p-1.5 -ml-1.5 text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <ChevronLeft size={15} className="transition-transform group-hover:-translate-x-0.5" /> Driving Analysis
        </Link>
        {detail ? <><span aria-hidden="true" className="text-border">/</span>
          <Link href={`/${portal}/history?booking=${detail.backendId}`} className="min-w-0 text-xs font-semibold text-foreground hover:text-primary hover:underline">{detail.bookingCode}</Link>
        </> : null}
      </nav><GradingDialog grading={analysis?.grading ?? null} /></div> : null}
      {!bookingId ? <DrivingAnalysisOverview portal={portal} /> : error ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">Driving Analysis could not be loaded.</p><Button variant="outline" onClick={() => setReload(value => value + 1)}>Retry</Button></div>
        : loading && bookingId ? <p role="status" className="text-sm text-muted-foreground">Loading Driving Analysis…</p>
        : detail ? <>
          <section aria-label="Booking details" className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="min-w-0 space-y-1"><p className="text-xs text-muted-foreground">Booking</p><Link href={`/${portal}/history?booking=${detail.backendId}`} className="font-semibold text-primary hover:underline">{detail.bookingCode}</Link></div>
            <div className="min-w-0 space-y-1"><p className="text-xs text-muted-foreground">Vehicle</p>
              <Link href={`/${portal}/vehicle/${encodeURIComponent(detail.vehicleId)}`} className="font-medium text-primary hover:underline">{vehicleIdentity(detail)}</Link>
            </div>
            <div className="min-w-0 space-y-1"><p className="text-xs text-muted-foreground">Operator</p><p className="font-medium">{analysis?.operator?.name ?? operator(detail) ?? "Not recorded"}</p></div>
            <div className="min-w-0 space-y-1"><p className="text-xs text-muted-foreground">Rental start</p><p>{formatReturnDateTime(detail.rentalStartAt)}</p></div>
            <div className="min-w-0 space-y-1"><p className="text-xs text-muted-foreground">Rental end</p><p>{formatReturnDateTime(detail.rentalEndAt)}</p></div>
            <div className="min-w-0 space-y-1"><p className="text-xs text-muted-foreground">Grade</p><p className="font-medium">{analysis ? formatDrivingGrade(analysis.grading) : "—"}</p></div>
          </section>
          <RentalDrivingEvents key={detail.backendId} analysisBookingId={detail.backendId} geofenceActivity={detail.geofenceActivity} onAnalysisChange={setAnalysis} />
        </> : null}
    </>}
  </div>;
}

export function DrivingAnalysisModule() {
  return <Suspense fallback={<p>Loading Driving Analysis…</p>}><AnalysisContent /></Suspense>;
}
