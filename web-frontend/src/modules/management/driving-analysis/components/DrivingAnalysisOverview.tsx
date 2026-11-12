"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardCheck, Users, Gauge, Activity, Eye, X } from "lucide-react";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { TableCard, ManagementTable, ManagementTableCell } from "@/components/common/tables/ManagementTable";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDrivingAnalysisBookings, getDrivingOperators, type BookingRecord, type DrivingOperator, type DrivingAnalysisSummary, type RecordedOperator, type DrivingVehicleOption } from "@/services/booking";
import { OperatorBookingsDialog } from "./OperatorBookingsDialog";
import { formatDrivingGrade } from "./DrivingGradeDetails";
import type { RentalDrivingGrade } from "@/services/fleet/fleet.service";

export function DrivingAnalysisOverview({ portal }: { portal: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const base = `/${portal}/driving-analysis`;
  const view = params.get("view") === "operators" ? "operators" : "rentals";
  const operatorId = view === "rentals" ? params.get("operator") : null;
  const vehicleId = view === "rentals" ? params.get("vehicle") : null;
  const operatorTrigger = useRef<HTMLButtonElement | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<DrivingOperator | null>(null);
  const [vehicleOptions, setVehicleOptions] = useState<DrivingVehicleOption[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [operators, setOperators] = useState<DrivingOperator[]>([]);
  const [grades, setGrades] = useState<Record<string, RentalDrivingGrade>>({});
  const [recordedOperators, setRecordedOperators] = useState<Record<string, RecordedOperator>>({});
  const [operatorFilter, setOperatorFilter] = useState<RecordedOperator | null>(null);
  const [summary, setSummary] = useState<DrivingAnalysisSummary | null>(null);
  const [pagination, setPagination] = useState({ total: 0, lastPage: 1 });

  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(false);
      const load = async () => {
        try {
          const filters = { page, search, operatorId, vehicleId };
          if (view === "operators") {
            const result = await getDrivingOperators(filters);
            if (current) {
              setOperators(result.operators);
              setSummary(result.summary);
              setVehicleOptions(result.vehicleOptions);
              setPagination({ total: result.total, lastPage: result.lastPage });
            }
          } else {
            const result = await getDrivingAnalysisBookings(filters);
            if (current) {
              setBookings(result.bookings);
              setGrades(result.grades);
              setRecordedOperators(result.recordedOperators);
              setOperatorFilter(result.operatorFilter);
              setSummary(result.summary);
              setVehicleOptions(result.vehicleOptions);
              setPagination({ total: result.total, lastPage: result.lastPage });
            }
          }
        } catch { if (current) setError(true); }
        finally { if (current) setLoading(false); }
      };
      void load();
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [view, operatorId, vehicleId, page, search, reload]);

  const ready = !loading && !error && summary;
  const kpis = [
    { label: "Completed rentals", value: ready ? summary.completed_rentals : "—", icon: ClipboardCheck },
    { label: "Operators monitored", value: ready ? summary.operators_monitored : "—", icon: Users },
    { label: "Average grade", value: ready && summary.average_score !== null ? `${summary.average_score.toFixed(1)} / 100` : "—", icon: Gauge, description: ready && summary.incomplete_grades > 0 ? "Includes grades with incomplete sync" : undefined },
    { label: "Confirmed harsh events", value: ready ? summary.harsh_events : "—", icon: Activity },
  ];
  const reset = () => { setPage(1); setSearch(""); setLoading(true); };
  const listUrl = (nextView: string) => {
    const query = new URLSearchParams();
    if (nextView === "operators") query.set("view", "operators");
    if (nextView === "rentals" && vehicleId) query.set("vehicle", vehicleId);
    return `${base}${query.size ? `?${query}` : ""}`;
  };
  const changeVehicle = (value: string) => {
    setPage(1);
    setLoading(true);
    const query = new URLSearchParams(params.toString());
    if (value === "all") query.delete("vehicle"); else query.set("vehicle", value);
    router.replace(`${base}${query.size ? `?${query}` : ""}`);
  };
  const openAnalysis = (id: number) => {
    const query = new URLSearchParams(params.toString());
    query.set("booking", String(id));
    router.push(`${base}?${query}`);
  };
  const colSpan = view === "operators" ? 6 : 5;
  const total = view === "operators" ? operators.length : bookings.length;

  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{kpis.map(item => <KpiCard key={item.label} {...item} />)}</div>
    <Tabs value={view} onValueChange={value => { reset(); router.replace(listUrl(value)); }}>
      <TabsList aria-label="Driving analysis views">
        <TabsTrigger value="rentals">Rentals</TabsTrigger>
        <TabsTrigger value="operators">Operators</TabsTrigger>
      </TabsList>
      <TabsContent value={view} className="mt-3">
        <TableCard>
          <CardContent className="space-y-3 border-b border-border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput value={search} maxLength={160} onValueChange={value => { setSearch(value); setPage(1); setLoading(true); }} placeholder={view === "operators" ? "Search operators" : "Search completed rentals"} wrapperClassName="min-w-0 w-full flex-1" />
              {view === "rentals" ? <FilterSelect value={vehicleId ?? "all"} onValueChange={changeVehicle} options={[{ value: "all", label: "All vehicles" }, ...vehicleOptions]} ariaLabel="Filter driving analysis by vehicle" className="w-full sm:w-64 sm:shrink-0" /> : null}
            </div>
            {view === "rentals" && operatorId ? <Button variant="outline" size="sm" aria-label="Clear operator filter" onClick={() => { reset(); router.replace(listUrl("rentals")); }}>{operatorFilter?.name ?? "Selected operator"}<X className="size-3.5" aria-hidden="true" /></Button> : null}
          </CardContent>
          <ManagementTable>
            <TableHeader><TableRow>{view === "operators" ? <><TableHead>Operator</TableHead><TableHead>Monitored rentals</TableHead><TableHead>Average grade</TableHead><TableHead>Latest grade</TableHead><TableHead>Harsh events</TableHead></> : <><TableHead>Booking</TableHead><TableHead>Vehicle</TableHead><TableHead>Operator</TableHead><TableHead>Grade</TableHead></>}<TableHead className="w-16 px-4"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>{loading ? <TableRow><ManagementTableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">Loading {view}…</ManagementTableCell></TableRow>
              : error ? <TableRow><ManagementTableCell colSpan={colSpan} className="py-8 text-center"><p role="alert" className="text-sm text-destructive">Driving Analysis could not be loaded.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => setReload(value => value + 1)}>Retry</Button></ManagementTableCell></TableRow>
                : view === "operators" ? operators.map(operator => <TableRow key={operator.id}>
                  <ManagementTableCell data-label="Operator" className="font-medium">{operator.name ?? "Not recorded"}</ManagementTableCell>
                  <ManagementTableCell data-label="Monitored rentals" className="tabular-nums">{operator.monitored_rentals} of {operator.completed_rentals}</ManagementTableCell>
                  <ManagementTableCell data-label="Average grade" className="tabular-nums">{operator.average_score === null ? "Not graded" : `${operator.average_score.toFixed(1)} / 100`}{operator.incomplete_grades > 0 ? <span className="block text-xs text-muted-foreground">Includes incomplete sync</span> : null}</ManagementTableCell>
                  <ManagementTableCell data-label="Latest grade" className="tabular-nums">{operator.latest_score === null ? "Not graded" : `${operator.latest_score} / 100`}{operator.latest_sync_incomplete ? <span className="block text-xs text-muted-foreground">Incomplete sync</span> : null}</ManagementTableCell>
                  <ManagementTableCell data-label="Harsh events" className="tabular-nums">{operator.harsh_events}</ManagementTableCell>
                  <ManagementTableCell data-label="Actions" className="px-4 py-3 md:w-16"><Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`View rentals for ${operator.name ?? "operator"}`} onClick={event => { operatorTrigger.current = event.currentTarget; setSelectedOperator(operator); }}><Eye aria-hidden="true" /></Button></ManagementTableCell>
                </TableRow>) : bookings.map(booking => <TableRow key={booking.backendId}>
                  <ManagementTableCell data-label="Booking"><Link href={`/${portal}/history?booking=${booking.backendId}`} className="font-semibold text-primary hover:underline">{booking.bookingCode}</Link></ManagementTableCell>
                  <ManagementTableCell data-label="Vehicle"><Link href={`/${portal}/vehicle/${encodeURIComponent(booking.vehicleId)}`} className="font-medium text-primary hover:underline">{[booking.brand, booking.vehicleName, booking.vehiclePlateNumber].filter(Boolean).join(" ")}</Link></ManagementTableCell>
                  <ManagementTableCell data-label="Operator">{recordedOperators[booking.backendId]?.name ?? (booking.driverOption === "self_drive" ? booking.customer?.name : booking.assignedDriver?.name) ?? "Not recorded"}</ManagementTableCell>
                  <ManagementTableCell data-label="Grade" className={grades[booking.backendId]?.score != null ? "font-medium tabular-nums" : "text-muted-foreground"}>{formatDrivingGrade(grades[booking.backendId])}</ManagementTableCell>
                  <ManagementTableCell data-label="Actions" className="px-4 py-3 md:w-16"><Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`View analysis for ${booking.bookingCode}`} onClick={() => openAnalysis(booking.backendId)}><Eye aria-hidden="true" /></Button></ManagementTableCell>
                </TableRow>)}
              {!loading && !error && !total ? <TableRow><ManagementTableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">{view === "operators" ? "No operators found for completed rentals." : "No completed rentals found."}</ManagementTableCell></TableRow> : null}
            </TableBody>
          </ManagementTable>
          {!loading && !error && pagination.total > 0 ? <div className="border-t border-border px-4 py-3 [&>div]:mt-0"><TablePagination page={page} lastPage={pagination.lastPage} total={pagination.total} onPageChange={value => { setPage(value); setLoading(true); }} label={view === "operators" ? "Operators" : "Completed rentals"} /></div> : null}
        </TableCard>
      </TabsContent>
    </Tabs>
    {selectedOperator ? <OperatorBookingsDialog key={selectedOperator.id} operator={selectedOperator} portal={portal} onClose={() => setSelectedOperator(null)} onReturnFocus={() => operatorTrigger.current?.focus()} /> : null}
  </div>;
}
