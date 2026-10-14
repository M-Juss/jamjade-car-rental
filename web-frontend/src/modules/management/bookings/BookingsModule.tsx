"use client";

import { DeliveryQuoteRequests } from "@/modules/management/delivery/DeliveryQuoteRequests";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Eye,
  ArrowRight,
  UserRound,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { SearchInput } from "@/components/common/forms/SearchInput";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableActionMenu, type TableActionMenuItem } from "@/components/common/tables/TableActionMenu";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { appToast } from "@/lib/toast";
import { BookingDetailsDialog } from "@/forms/booking/BookingDetailsDialog";
import { bookingWorkflowPhase, bookingWorkflowTitles } from "./booking-workflow";
import { BookingWorkflowDialog } from "@/forms/booking/BookingWorkflowDialog";
import { nextBookingAction, type BookingNextAction } from "./booking-next-action";
import {
  cancelBooking,
  getBooking,
  getBookings,
  type BookingRecord,
  type BookingGroup,
  type BookingStatus,
  type PaymentStatus,
} from "@/services/booking";

const bookingStatusStyle: Record<BookingStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-muted text-primary border-blue-200",
  rejected: "bg-rose-50 text-rose-600 border-rose-200",
  ongoing: "bg-emerald-50 text-emerald-700 border-emerald-200",
  returned: "bg-cyan-50 text-cyan-700 border-cyan-200",
  completed: "bg-background text-muted-foreground border-border",
  cancelled: "bg-rose-50 text-rose-600 border-rose-200",
};

const paymentStatusStyle: Record<PaymentStatus, string> = {
  unpaid: "bg-background text-muted-foreground border-border",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-600 border-rose-200",
  refunded: "bg-violet-50 text-violet-700 border-violet-200",
};

function peso(value: number) {
  return `PHP ${Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function Bookings({ group = "booking" }: { group?: BookingGroup }) {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [workflowAction, setWorkflowAction] = useState<BookingNextAction | "reassign-driver" | null>(null);
  const [loadingActionId, setLoadingActionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = searchInput.trim();
      if (nextSearch !== search) {
        setIsLoading(true);
        setError(null);
        setPage(1);
        setSearch(nextSearch);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, searchInput]);

  useEffect(() => {
    let ignore = false;
    let pageAdjusted = false;

    getBookings({ group, page, search, status: statusFilter, paymentStatus: paymentFilter })
      .then((result) => {
        if (!ignore) {
          if (page > result.lastPage) {
            pageAdjusted = true;
            setPage(result.lastPage);
            return;
          }
          setBookings(result.bookings);
          setLastPage(result.lastPage);
          setTotal(result.total);
          setStatusCounts(result.statusCounts);
        }
      })
      .catch(() => {
        if (!ignore) {
          setBookings([]);
          setTotal(0);
          setStatusCounts({});
          setError(group === "history" ? "Unable to load booking history." : "Unable to load bookings.");
        }
      })
      .finally(() => {
        if (!ignore && !pageAdjusted) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [group, page, paymentFilter, reloadKey, search, statusFilter]);

  const count = (status: BookingStatus) => statusCounts[status] ?? 0;
  const summaryCards = group === "history"
    ? [
        { label: "Total", value: count("completed") + count("cancelled") + count("rejected"), icon: CalendarCheck, color: "text-primary", background: "bg-muted" },
        { label: "Completed", value: count("completed"), icon: CheckCircle2, color: "text-success", background: "bg-success-surface" },
        { label: "Cancelled", value: count("cancelled"), icon: XCircle, color: "text-destructive", background: "bg-destructive-surface" },
        { label: "Rejected", value: count("rejected"), icon: XCircle, color: "text-destructive", background: "bg-destructive-surface" },
      ]
    : [
        { label: "Total", value: count("pending") + count("confirmed") + count("ongoing") + count("returned"), icon: CalendarCheck, color: "text-primary", background: "bg-muted" },
        { label: "Active", value: count("ongoing") + count("confirmed"), icon: Activity, color: "text-success", background: "bg-success-surface" },
        { label: "Pending", value: count("pending"), icon: Clock, color: "text-warning", background: "bg-warning-surface" },
        { label: "Returned", value: count("returned"), icon: CheckCircle2, color: "text-primary", background: "bg-muted" },
      ];

  const confirmCancel = async () => {
    if (!selectedBooking) return;

    try {
      setIsCancelling(true);
      setError(null);
      const updatedBooking = await cancelBooking(selectedBooking);
      setSelectedBooking(updatedBooking);
      setCancelOpen(false);
      setIsLoading(true);
      setReloadKey((current) => current + 1);
      appToast.success("Booking cancelled successfully.");
    } catch {
      setError("Unable to cancel this booking.");
      appToast.error("The booking could not be cancelled. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleBookingUpdated = useCallback((updatedBooking: BookingRecord) => {
    setSelectedBooking(updatedBooking);
    setBookings((current) => current.map((record) => record.backendId === updatedBooking.backendId ? updatedBooking : record));
    setError(null);
    setReloadKey((current) => current + 1);
  }, []);

  const openNext = async (booking: BookingRecord, requested?: "reassign-driver") => {
    try {
      setLoadingActionId(booking.backendId);
      const latest = await getBooking(booking);
      handleBookingUpdated(latest);
      const action = requested ?? nextBookingAction(latest);
      if (action) { setDetailsOpen(false); setWorkflowAction(action); }
      else appToast.error("This booking has no remaining action.");
    } catch {
      appToast.error("The latest booking state could not be loaded. Try again.");
    } finally {
      setLoadingActionId(null);
    }
  };

  const rowActions = (booking: BookingRecord): TableActionMenuItem[] => {
    if (group === "history") {
      return [{
        label: "View",
        icon: <Eye size={13} className="mr-2 text-subtle-foreground" />,
        onClick: () => { setSelectedBooking(booking); setDetailsOpen(true); },
      }];
    }

    const next = nextBookingAction(booking);
    return [
      {
        label: "View",
        icon: <Eye size={13} className="mr-2 text-subtle-foreground" />,
        onClick: () => { setSelectedBooking(booking); setDetailsOpen(true); },
      },
      ...(next ? [{
        label: bookingWorkflowTitles[bookingWorkflowPhase(next)],
        icon: <ArrowRight size={13} className="mr-2" />,
        onClick: () => { void openNext(booking); },
        disabled: loadingActionId === booking.backendId,
      }] : []),
      ...(booking.driverOption === "owners_driver" && booking.assignedDriver && ["pending", "confirmed"].includes(booking.statusKey) ? [{
        label: "Reassign Driver",
        icon: <UserRound size={13} className="mr-2" />,
        onClick: () => { void openNext(booking, "reassign-driver"); },
        disabled: loadingActionId === booking.backendId,
      }] : []),
      ...(["pending", "confirmed"].includes(booking.statusKey) ? [{
        label: "Cancel",
        icon: <XCircle size={13} className="mr-2" />,
        onClick: () => { setSelectedBooking(booking); setCancelOpen(true); },
        separatorBefore: true,
        variant: "danger" as const,
      }] : []),
    ];
  };

  return (
    <div className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{group === "history" ? "Booking History" : "Booking Management"}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{group === "history" ? "Review completed, cancelled, and rejected bookings." : "Track reservations and payment states from live booking records."}</p>
      </div>

      {group === "booking" && <DeliveryQuoteRequests />}

      {error ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12.5px] font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summaryCards.map(({ label, value, icon, color, background }) => (
          <KpiCard
            key={label}
            label={label}
            value={value}
            icon={icon}
            iconClassName={`${background} ${color}`}
          />
        ))}
      </div>

      <div>
        <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <SearchInput
                value={searchInput}
                onValueChange={setSearchInput}
                placeholder={group === "history" ? "Search history..." : "Search bookings..."}
                wrapperClassName="min-w-[180px] flex-1"
              />
              <FilterSelect
                value={statusFilter}
                onValueChange={(value) => { setIsLoading(true); setError(null); setPage(1); setStatusFilter(value); }}
                ariaLabel="Filter bookings by status"
                placeholder="Status"
                className="w-[130px]"
                options={group === "history" ? [
                  { value: "all", label: "All Status" },
                  { value: "completed", label: "Completed" },
                  { value: "cancelled", label: "Cancelled" },
                  { value: "rejected", label: "Rejected" },
                ] : [
                  { value: "all", label: "All Status" },
                  { value: "pending", label: "Pending" },
                  { value: "confirmed", label: "Confirmed" },
                  { value: "ongoing", label: "Ongoing" },
                  { value: "returned", label: "Returned" },
                ]}
              />
              <FilterSelect
                value={paymentFilter}
                onValueChange={(value) => { setIsLoading(true); setError(null); setPage(1); setPaymentFilter(value); }}
                ariaLabel="Filter bookings by payment status"
                placeholder="Payment"
                className="w-[145px]"
                options={[
                  { value: "all", label: "All Payments" },
                  { value: "unpaid", label: "Unpaid" },
                  { value: "pending", label: "Pending" },
                  { value: "partial", label: "Partially Paid" },
                  { value: "paid", label: "Paid" },
                  { value: "failed", label: "Failed" },
                  { value: "refunded", label: "Refunded" },
                ]}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card className="overflow-hidden rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          {/* Card layout on small screens; the table takes over from md */}
          <div className="grid gap-3 p-4 md:hidden">
            {isLoading ? (
              <p className="py-10 text-center text-[12px] text-muted-foreground">Loading {group === "history" ? "history" : "bookings"}...</p>
            ) : error ? (
              <p className="py-10 text-center text-[12px] text-muted-foreground">Could not load records.</p>
            ) : bookings.length === 0 ? (
              <p className="py-10 text-center text-[12px] text-muted-foreground">No {group === "history" ? "historical" : "current"} bookings found.</p>
            ) : (
              bookings.map((booking) => (
                <div key={booking.backendId} className="rounded-xl border border-border bg-background p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[12px] font-semibold text-primary">{booking.bookingCode}</p>
                      <p className="mt-1 truncate text-[12.5px] font-semibold text-foreground">
                        {booking.customer?.name || "Customer"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold ${bookingStatusStyle[booking.statusKey]}`}>
                        {booking.adminStatus}
                      </span>
                      <span className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold ${paymentStatusStyle[booking.paymentStatusKey]}`}>
                        {booking.paymentStatus}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-[12px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Vehicle</span>
                      <span className="truncate font-medium text-foreground">
                        {[booking.brand, booking.vehicleName, booking.model]
                          .filter(Boolean)
                          .join(" ") || "Vehicle unavailable"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Driver</span>
                      <span className="truncate font-medium text-foreground">
                        {booking.driverOption === "self_drive"
                          ? "Self drive"
                          : booking.assignedDriver?.name || "Not assigned"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Pickup</span>
                      <span className="text-foreground">{booking.rentalDate || "Not provided"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-semibold text-foreground">{peso(booking.totalAmount)}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex justify-end">
                    <TableActionMenu
                      label={`Open actions for ${booking.bookingCode}`}
                      items={rowActions(booking)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-background hover:bg-background">
                  {["Booking ID", "Customer", "Vehicle", "Driver", "Pickup", "Status", "Payment", "Total", ""].map((heading) => (
                    <TableHead key={heading} className="whitespace-nowrap px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-subtle-foreground">
                      {heading}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-[12px] text-muted-foreground">
                      Loading {group === "history" ? "history" : "bookings"}...
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-[12px] text-muted-foreground">
                      Could not load records.
                    </TableCell>
                  </TableRow>
                ) : bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-[12px] text-muted-foreground">
                      No {group === "history" ? "historical" : "current"} bookings found.
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking) => (
                    <TableRow key={booking.backendId} className="border-b border-background transition-colors hover:bg-background">
                      <TableCell className="px-4 py-3 font-mono text-[12px] font-semibold text-primary">{booking.bookingCode}</TableCell>
                      <TableCell className="px-4 py-3 text-[12.5px] font-semibold text-foreground">{booking.customer?.name || "Customer"}</TableCell>
                      <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">
                        {[booking.brand, booking.vehicleName, booking.model]
                          .filter(Boolean)
                          .join(" ") || "Vehicle unavailable"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">
                        {booking.driverOption === "self_drive"
                          ? "Self drive"
                          : booking.assignedDriver?.name || "Not assigned"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-[12px] text-muted-foreground">{booking.rentalDate || "Not provided"}</TableCell>
                      <TableCell className="px-4 py-3">
                        <span className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold ${bookingStatusStyle[booking.statusKey]}`}>
                          {booking.adminStatus}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold ${paymentStatusStyle[booking.paymentStatusKey]}`}>
                          {booking.paymentStatus}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-[12px] font-semibold text-foreground">{peso(booking.totalAmount)}</TableCell>
                      <TableCell className="px-4 py-3">
                        <TableActionMenu
                          label={`Open actions for ${booking.bookingCode}`}
                          items={rowActions(booking)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
        {!error && !isLoading ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{total} result{total === 1 ? "" : "s"}</span>
            <div className="flex items-center gap-2">
              <span>Page {page} of {lastPage}</span>
              <Button variant="outline" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => { setIsLoading(true); setError(null); setPage((current) => current - 1); }}>
                <ChevronLeft size={15} />
              </Button>
              <Button variant="outline" size="icon" aria-label="Next page" disabled={page >= lastPage} onClick={() => { setIsLoading(true); setError(null); setPage((current) => current + 1); }}>
                <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {selectedBooking ? (
        <BookingDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          booking={selectedBooking}
          onContinue={(record) => { void openNext(record); }}
          isContinuing={loadingActionId === selectedBooking.backendId}
        />
      ) : null}

      {selectedBooking && workflowAction ? <BookingWorkflowDialog
        key={selectedBooking.backendId}
        action={workflowAction}
        booking={selectedBooking}
        onClose={() => setWorkflowAction(null)}
        onUpdated={handleBookingUpdated}
      /> : null}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent className="max-w-[400px] rounded-2xl border-0 shadow-[0_24px_64px_rgba(0,0,0,0.13)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px] font-bold text-foreground">Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">
              Cancel booking <strong>{selectedBooking?.bookingCode}</strong> for{" "}
              <strong>{selectedBooking?.customer?.name || "this customer"}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Back</AlertDialogCancel>
            <AlertDialogAction
              disabled={isCancelling}
              onClick={(event) => {
                event.preventDefault();
                void confirmCancel();
              }}
              className="rounded-xl bg-rose-500 text-white hover:bg-rose-600"
            >
              {isCancelling ? "Cancelling..." : "Cancel Booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
