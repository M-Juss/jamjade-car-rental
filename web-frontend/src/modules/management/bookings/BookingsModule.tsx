"use client";

import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";

import { ManagementTable as Table, ManagementTableCell as TableCell, TableCard } from "@/components/common/tables/ManagementTable";

import { useRouter, useSearchParams } from "next/navigation";
import { useManagementSession } from "@/modules/management/shell/context/ManagementSessionProvider";
import { BookingStatusDisplay } from "./components/BookingStatusDisplay";

import { Suspense, useCallback, useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  ArrowRight,
  UserRound,
  XCircle,
} from "lucide-react";
import { CardContent } from "@/components/ui/card";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { SearchInput } from "@/components/common/forms/SearchInput";
import {
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableActionMenu, type TableActionMenuItem } from "@/components/common/tables/TableActionMenu";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { appToast } from "@/lib/toast";
import { CancelBookingDialog } from "@/forms/booking/CancelBookingDialog";
import { BookingDetailsDialog } from "@/forms/booking/BookingDetailsDialog";
import { bookingWorkflowPhase, bookingWorkflowTitles } from "./booking-workflow";
import { BookingWorkflowDialog } from "@/forms/booking/BookingWorkflowDialog";
import { nextBookingAction, type BookingNextAction } from "./booking-next-action";
import {
  getBooking,
  getBookings,
  type BookingRecord,
  type BookingGroup,
  type BookingStatus,
  type PaymentStatus,
} from "@/services/booking";

const paymentStatusStyle: Record<PaymentStatus, string> = {
  unpaid: "bg-background text-muted-foreground border-border",
  pending: "bg-warning-surface text-warning border-warning-border",
  partial: "bg-warning-surface text-warning border-warning-border",
  paid: "bg-success-surface text-success border-success-border",
  failed: "bg-destructive-surface text-destructive border-destructive-border",
  refunded: "bg-violet-50 text-violet-700 border-violet-200",
};

function peso(value: number) {
  return `PHP ${Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function BookingsContent({ group = "booking" }: { group?: BookingGroup }) {
  const router = useRouter();
  const { portal, user } = useManagementSession();
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(() => {
    const status = searchParams.get("status");
    return status && ["pending", "confirmed", "ongoing", "returned", "completed", "cancelled", "rejected"].includes(status) ? status : "all";
  });
  const [attentionFilter, setAttentionFilter] = useState(searchParams.get("attention") === "all_attention" ? "all_attention" : "all");
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

    getBookings({ group, page, search, status: statusFilter, paymentStatus: paymentFilter, attention: attentionFilter })
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
  }, [group, page, paymentFilter, reloadKey, search, statusFilter, attentionFilter]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("booking"));
    if (Number.isInteger(id) && id > 0) void getBooking(id).then((record) => { setSelectedBooking(record); setDetailsOpen(true); }).catch(() => appToast.error("Booking could not be opened."));
  }, []);

  useEffect(() => {
    if (group !== "booking" || detailsOpen || workflowAction || cancelOpen) return;
    const timer = window.setInterval(() => setReloadKey((value) => value + 1), 60000);
    return () => window.clearInterval(timer);
  }, [group, detailsOpen, workflowAction, cancelOpen]);

  const count = (status: BookingStatus) => statusCounts[status] ?? 0;
  const summaryCards = group === "history"
    ? [
        { label: "Total", value: count("completed") + count("cancelled") + count("rejected"), icon: CalendarDays },
        { label: "Completed", value: count("completed"), icon: CheckCircle2 },
        { label: "Cancelled", value: count("cancelled"), icon: XCircle },
        { label: "Rejected", value: count("rejected"), icon: XCircle },
      ]
    : [
        { label: "Total", value: count("pending") + count("confirmed") + count("ongoing") + count("returned"), icon: CalendarDays },
        { label: "Active", value: count("ongoing") + count("confirmed"), icon: Activity },
        { label: "Pending", value: count("pending"), icon: Clock3 },
        { label: "Returned", value: count("returned"), icon: CheckCircle2 },
      ];

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
      }, ...(booking.statusKey === "completed" && user?.permissions?.includes("view fleet tracker") ? [{
        label: "Driving Analysis",
        onClick: () => router.push(`/${portal}/driving-analysis?booking=${booking.backendId}`),
      }] : [])];
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
      ...(["pending", "confirmed"].includes(booking.statusKey) && booking.attention?.key !== "not_started" ? [{
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ManagementPageHeading
          title={group === "history" ? "Booking History" : "Bookings"}
          description={group === "history" ? "Review completed, cancelled, and rejected bookings." : "Manage reservations, payments, handovers, and returns."}
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive-border bg-destructive-surface px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summaryCards.map(({ label, value, icon }) => <KpiCard key={label} label={label} value={isLoading ? "—" : value} icon={icon} />)}
      </div>

      <TableCard>
          <CardContent className="border-b border-border p-4">
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
              {group === "booking" ? <FilterSelect value={attentionFilter} onValueChange={(value) => { setIsLoading(true); setError(null); setPage(1); setAttentionFilter(value); }} ariaLabel="Filter bookings requiring action" placeholder="Required Action" className="w-[260px]" options={[
                { value: "all", label: "All Bookings" }, { value: "all_attention", label: "Bookings Requiring Action" },
                { value: "overdue_return", label: "Overdue Returns" }, { value: "not_started", label: "Schedule Ended — Not Started" },
                { value: "return_processing", label: "Return Processing Pending" }, { value: "awaiting_settlement", label: "Awaiting Settlement" },
                { value: "ready_to_complete", label: "Ready to Complete" },
              ]} /> : null}
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
          {/* Card layout on small screens; the table takes over from md */}
          <div className="grid divide-y divide-border md:hidden">
            {isLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Loading {group === "history" ? "history" : "bookings"}...</p>
            ) : error ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Could not load records.</p>
            ) : bookings.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No {group === "history" ? "historical" : "current"} bookings found.</p>
            ) : (
              bookings.map((booking) => (
                <div key={booking.backendId} className="min-w-0 bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-mono text-sm font-semibold text-primary">{booking.bookingCode}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-foreground">
                        {booking.customer?.name || "Customer"}
                      </p>
                    </div>
                    <div className="flex max-w-[50%] shrink-0 flex-col items-end gap-2">
                      <BookingStatusDisplay booking={booking} className="items-end text-right" />
                      <span className={`inline-flex whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold ${paymentStatusStyle[booking.paymentStatusKey]}`}>
                        {booking.paymentStatus}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
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

          <div className="hidden md:block">
            <Table className="table-fixed [&_td]:whitespace-normal [&_td]:[overflow-wrap:anywhere]">
              <colgroup>
                <col className="w-[10%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[11%]" />
                <col />
                <col className="w-12" />
              </colgroup>
              <TableHeader>
                <TableRow className="border-b border-border bg-background hover:bg-background">
                  {["Booking ID", "Customer", "Vehicle", "Driver", "Pickup", "Status", "Payment", "Total", ""].map((heading) => (
                    <TableHead key={heading} className="whitespace-normal break-words px-2 py-3 text-xs font-semibold normal-case tracking-normal text-subtle-foreground">
                      {heading || <span className="sr-only">Actions</span>}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                      Loading {group === "history" ? "history" : "bookings"}...
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                      Could not load records.
                    </TableCell>
                  </TableRow>
                ) : bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                      No {group === "history" ? "historical" : "current"} bookings found.
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking) => (
                    <TableRow key={booking.backendId} className="border-b border-background transition-colors hover:bg-background">
                      <TableCell className="px-2 py-3 font-mono text-sm font-semibold text-primary">{booking.bookingCode}</TableCell>
                      <TableCell className="px-2 py-3 text-sm font-semibold text-foreground">{booking.customer?.name || "Customer"}</TableCell>
                      <TableCell className="px-2 py-3 text-sm text-muted-foreground">
                        {[booking.brand, booking.vehicleName, booking.model]
                          .filter(Boolean)
                          .join(" ") || "Vehicle unavailable"}
                      </TableCell>
                      <TableCell className="px-2 py-3 text-sm text-muted-foreground">
                        {booking.driverOption === "self_drive"
                          ? "Self drive"
                          : booking.assignedDriver?.name || "Not assigned"}
                      </TableCell>
                      <TableCell className="px-2 py-3 text-sm text-muted-foreground">{booking.rentalDate || "Not provided"}</TableCell>
                      <TableCell className="px-2 py-3">
                        <BookingStatusDisplay booking={booking} />
                      </TableCell>
                      <TableCell className="px-2 py-3">
                        <span className={`table-status-badge rounded-lg border px-2.5 py-1 text-xs font-semibold ${paymentStatusStyle[booking.paymentStatusKey]}`}>
                          {booking.paymentStatus}
                        </span>
                      </TableCell>
                      <TableCell className="px-2 py-3 text-sm font-semibold text-foreground">{peso(booking.totalAmount)}</TableCell>
                      <TableCell className="px-2 py-3">
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
        {!error && !isLoading && total > 0 ? (
          <div className="border-t border-border px-4 py-3 [&>div]:mt-0"><TablePagination total={total} page={page} lastPage={lastPage} onPageChange={(nextPage) => { setIsLoading(true); setError(null); setPage(nextPage); }} /></div>
        ) : null}
      </TableCard>

      {selectedBooking ? (
        <BookingDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          booking={selectedBooking}
          showDocuments={group !== "history"}
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

      {cancelOpen && selectedBooking ? <CancelBookingDialog key={selectedBooking.backendId} booking={selectedBooking} onClose={() => setCancelOpen(false)} onSaved={(record) => { handleBookingUpdated(record); setCancelOpen(false); }} /> : null}
    </div>
  );
}

export function Bookings({ group = "booking" }: { group?: BookingGroup }) {
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Loading bookings...</p>}><BookingsContent group={group} /></Suspense>;
}
