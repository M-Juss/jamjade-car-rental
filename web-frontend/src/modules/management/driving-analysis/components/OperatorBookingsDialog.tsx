"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Users } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormDialogContent, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { TableCard, ManagementTable, ManagementTableCell } from "@/components/common/tables/ManagementTable";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { getDrivingAnalysisBookings, type BookingRecord, type DrivingOperator } from "@/services/booking";
import type { RentalDrivingGrade } from "@/services/fleet/fleet.service";
import { formatDrivingGrade } from "./DrivingGradeDetails";

export function OperatorBookingsDialog({ operator, portal, onClose, onReturnFocus }: { operator: DrivingOperator; portal: string; onClose: () => void; onReturnFocus: () => void }) {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [grades, setGrades] = useState<Record<string, RentalDrivingGrade>>({});
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, lastPage: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    const load = async () => {
      try {
        const result = await getDrivingAnalysisBookings({ operatorId: String(operator.id), page, search: "" });
        if (current) {
          setBookings(result.bookings);
          setGrades(result.grades);
          setPagination({ total: result.total, lastPage: result.lastPage });
        }
      } catch { if (current) setError(true); }
      finally { if (current) setLoading(false); }
    };
    void load();
    return () => { current = false; };
  }, [operator.id, page, reload]);

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <FormDialogContent width="wide" onCloseAutoFocus={event => { event.preventDefault(); onReturnFocus(); }}>
      <FormDialogHeader title={operator.name ?? "Operator bookings"} icon={Users} onClose={onClose} closeLabel="Close operator bookings" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
        <TableCard>
          <ManagementTable>
            <TableHeader><TableRow><TableHead>Booking</TableHead><TableHead>Harsh events</TableHead><TableHead>Deductions</TableHead><TableHead>Grade</TableHead><TableHead className="w-16 px-4"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>{loading ? <TableRow><ManagementTableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading completed bookings…</ManagementTableCell></TableRow>
              : error ? <TableRow><ManagementTableCell colSpan={5} className="py-8 text-center"><p role="alert" className="text-destructive">Bookings could not be loaded.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => { setLoading(true); setError(false); setReload(value => value + 1); }}>Retry</Button></ManagementTableCell></TableRow>
                : bookings.map(booking => {
                  const grade = grades[booking.backendId];
                  return <TableRow key={booking.backendId}>
                    <ManagementTableCell data-label="Booking"><Link href={`/${portal}/history?booking=${booking.backendId}`} className="font-semibold text-primary hover:underline">{booking.bookingCode}</Link></ManagementTableCell>
                    <ManagementTableCell data-label="Harsh events" className="tabular-nums">{grade?.confirmed_events ?? "—"}</ManagementTableCell>
                    <ManagementTableCell data-label="Deductions" className="tabular-nums">{grade?.score != null ? `−${grade.deductions}` : "—"}</ManagementTableCell>
                    <ManagementTableCell data-label="Grade" className={grade?.score != null ? "font-medium tabular-nums" : "text-muted-foreground"}>{formatDrivingGrade(grade)}</ManagementTableCell>
                    <ManagementTableCell data-label="Actions" className="px-4 py-3 md:w-16"><Button asChild variant="ghost" size="icon" className="size-8"><Link href={`/${portal}/driving-analysis?view=operators&booking=${booking.backendId}`} aria-label={`View driving analysis for ${booking.bookingCode}`}><Eye aria-hidden="true" /></Link></Button></ManagementTableCell>
                  </TableRow>;
                })}
              {!loading && !error && !bookings.length ? <TableRow><ManagementTableCell colSpan={5} className="py-10 text-center text-muted-foreground">No completed bookings found.</ManagementTableCell></TableRow> : null}
            </TableBody>
          </ManagementTable>
          {!loading && !error && pagination.total > 0 ? <div className="border-t border-border px-4 py-3 [&>div]:mt-0"><TablePagination page={page} lastPage={pagination.lastPage} total={pagination.total} onPageChange={value => { setPage(value); setLoading(true); setError(false); }} label="Operator bookings" /></div> : null}
        </TableCard>
      </div>
    </FormDialogContent>
  </Dialog>;
}
