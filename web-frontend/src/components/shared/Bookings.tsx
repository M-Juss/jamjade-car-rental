"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CalendarCheck,
  Car,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  Phone,
  Search,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableActionMenu } from "@/components/common/TableActionMenu";
import {
  cancelBooking,
  getBookings,
  type BookingRecord,
  type BookingStatus,
  type PaymentStatus,
} from "@/services/booking";

const bookingStatusStyle: Record<BookingStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-[#EEF4FF] text-[#346EF6] border-blue-200",
  rejected: "bg-rose-50 text-rose-600 border-rose-200",
  ongoing: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-[#F5F5F5] text-[#4A5568] border-[#E8ECF4]",
  cancelled: "bg-rose-50 text-rose-600 border-rose-200",
};

const paymentStatusStyle: Record<PaymentStatus, string> = {
  unpaid: "bg-[#F5F5F5] text-[#8896A7] border-[#E8ECF4]",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-600 border-rose-200",
  refunded: "bg-violet-50 text-violet-700 border-violet-200",
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay },
});

function peso(value: number) {
  return `PHP ${Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function customerInitials(booking: BookingRecord) {
  return (booking.customer?.name || "Customer")
    .split(" ")
    .map((name) => name[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function BookingDetailsSheet({
  booking,
  open,
  onClose,
}: {
  booking: BookingRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!booking) return null;

  const pricingRows = [
    ["Subtotal", booking.subtotal],
    ["Delivery fee", booking.deliveryFee],
    ["Owner driver fee", booking.ownerDriverFee],
    ["Outside Manila fee", booking.outsideManilaFee],
    ["Toll fee", booking.tollFee],
    ["Late fee", booking.lateFee],
    ["Add-ons", booking.addOns],
    ["Discount", -booking.discount],
    ["Down payment", -booking.downPayment],
  ] as const;

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent side="right" className="w-full gap-0 border-l border-[#E8ECF4] p-0 sm:max-w-[540px]">
        <SheetHeader className="border-b border-[#F0F2F7] px-5 pb-4 pt-5">
          <div className="flex items-center justify-between pr-8">
            <div>
              <SheetTitle className="text-[15px] font-bold text-[#1A2340]">Booking Details</SheetTitle>
              <p className="mt-0.5 font-mono text-[11.5px] text-[#8896A7]">{booking.bookingCode}</p>
            </div>
            <span className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold ${bookingStatusStyle[booking.statusKey]}`}>
              {booking.adminStatus}
            </span>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-76px)]">
          <div className="space-y-4 px-5 py-4">
            <section className="space-y-3 rounded-2xl border border-[#EEF1F8] bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A0AABF]">Booking Overview</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Booking type", booking.bookingType],
                  ["Pickup type", booking.pickupLocationType === "delivery" ? "Delivery" : "Shop pickup"],
                  ["Pickup location", booking.pickupLocation],
                  ...(booking.deliveryTimeLabel ? [["Delivery time", booking.deliveryTimeLabel]] : []),
                  [
                    booking.pickupLocationType === "delivery" ? "End trip location" : "Return location",
                    booking.returnLocation,
                  ],
                  ["Rental period", `${booking.durationDays} day${booking.durationDays === 1 ? "" : "s"}`],
                  ["Pickup date", booking.rentalDate || "Not provided"],
                  ["Return date", booking.returnDate || "Not provided"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-[#F8F9FC] px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-[#A0AABF]">{label}</p>
                    <p className="mt-0.5 text-[12.5px] font-semibold text-[#1A2340]">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-[#EEF1F8] bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A0AABF]">Customer</p>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-[#EEF4FF] text-[13px] font-bold text-[#346EF6]">
                    {customerInitials(booking)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-[#1A2340]">{booking.customer?.name || "Customer"}</p>
                  <p className="truncate text-[11.5px] text-[#8896A7]">{booking.customer?.email || "No email"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 rounded-lg bg-[#F8F9FC] px-2.5 py-1.5 text-[11.5px] text-[#4A5568]">
                  <Phone size={11} className="text-[#A0AABF]" />
                  {booking.customer?.phoneNumber || "Not provided"}
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-[#F8F9FC] px-2.5 py-1.5 text-[11.5px] text-[#4A5568]">
                  <Mail size={11} className="text-[#A0AABF]" />
                  {booking.customer?.email || "Not provided"}
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-[#EEF1F8] bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A0AABF]">Vehicle</p>
              <div className="flex items-center gap-3 rounded-xl bg-[#F8F9FC] px-3 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF]">
                  <Car size={18} className="text-[#346EF6]" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#1A2340]">{booking.vehicleName || "Vehicle unavailable"}</p>
                  <p className="text-[11.5px] text-[#8896A7]">Vehicle ID {booking.vehicleId}</p>
                </div>
              </div>
            </section>

            <section className="space-y-2 rounded-2xl border border-[#EEF1F8] bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A0AABF]">Pricing</p>
              {pricingRows.map(([label, value]) => (
                <div key={label} className="flex justify-between text-[12.5px]">
                  <span className="text-[#8896A7]">{label}</span>
                  <span className={`font-semibold ${value < 0 ? "text-emerald-600" : "text-[#1A2340]"}`}>
                    {value < 0 ? `-${peso(Math.abs(value))}` : peso(value)}
                  </span>
                </div>
              ))}
              <Separator className="my-1 bg-[#F0F2F7]" />
              <div className="flex justify-between">
                <span className="text-[13px] font-bold text-[#1A2340]">Total</span>
                <span className="text-[14px] font-bold text-[#346EF6]">{peso(booking.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#F0F2F7] pt-2">
                <span className="text-[11.5px] text-[#8896A7]">Payment status</span>
                <span className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold ${paymentStatusStyle[booking.paymentStatusKey]}`}>
                  {booking.paymentStatus}
                </span>
              </div>
            </section>

            <section className="space-y-2 rounded-2xl border border-[#EEF1F8] bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A0AABF]">Admin Notes</p>
              <p className="whitespace-pre-wrap rounded-xl bg-[#F8F9FC] px-3 py-3 text-[12.5px] leading-5 text-[#4A5568]">
                {booking.adminNotes || booking.notes || "No notes recorded."}
              </p>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function Bookings() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    getBookings()
      .then((records) => {
        if (!ignore) setBookings(records);
      })
      .catch(() => {
        if (!ignore) setError("Unable to load bookings.");
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const filtered = useMemo(() => bookings.filter((booking) => {
    const haystack = [
      booking.bookingCode,
      booking.customer?.name,
      booking.customer?.email,
      booking.vehicleName,
      booking.vehicleId,
    ].filter(Boolean).join(" ").toLowerCase();

    return (
      haystack.includes(search.toLowerCase()) &&
      (statusFilter === "all" || booking.statusKey === statusFilter) &&
      (paymentFilter === "all" || booking.paymentStatusKey === paymentFilter)
    );
  }), [bookings, paymentFilter, search, statusFilter]);

  const counts = {
    total: bookings.length,
    active: bookings.filter((booking) => booking.statusKey === "ongoing" || booking.statusKey === "confirmed").length,
    pending: bookings.filter((booking) => booking.statusKey === "pending").length,
    completed: bookings.filter((booking) => booking.statusKey === "completed").length,
  };

  const confirmCancel = async () => {
    if (!selectedBooking) return;

    try {
      setIsCancelling(true);
      setError(null);
      const updatedBooking = await cancelBooking(selectedBooking);
      setBookings((current) =>
        current.map((booking) =>
          booking.backendId === updatedBooking.backendId ? updatedBooking : booking,
        ),
      );
      setSelectedBooking(updatedBooking);
      setCancelOpen(false);
    } catch {
      setError("Unable to cancel this booking.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="min-h-screen space-y-5 bg-[#F5F5F5] p-4 md:p-6 lg:p-8">
      <motion.div {...fadeUp(0)}>
        <h1 className="text-2xl font-bold tracking-tight text-[#1A2340]">Booking Management</h1>
        <p className="mt-0.5 text-sm text-[#8896A7]">Track reservations and payment states from live booking records.</p>
      </motion.div>

      {error ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12.5px] font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <motion.div {...fadeUp(0.05)} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total", value: counts.total, icon: CalendarCheck, color: "text-[#346EF6]", background: "bg-[#EEF4FF]" },
          { label: "Active", value: counts.active, icon: Activity, color: "text-emerald-600", background: "bg-emerald-50" },
          { label: "Pending", value: counts.pending, icon: Clock, color: "text-amber-600", background: "bg-amber-50" },
          { label: "Completed", value: counts.completed, icon: CheckCircle2, color: "text-[#4A5568]", background: "bg-[#F5F5F5]" },
        ].map(({ label, value, icon: Icon, color, background }) => (
          <Card key={label} className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${background}`}>
                <Icon size={17} className={color} />
              </div>
              <div>
                <p className="text-[22px] font-bold leading-none text-[#1A2340]">{value}</p>
                <p className="mt-0.5 text-[11px] font-medium text-[#8896A7]">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div {...fadeUp(0.1)}>
        <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[180px] flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AABF]" />
                <Input
                  placeholder="Search bookings..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-9 rounded-xl border-[#E8ECF4] bg-[#F8F9FC] pl-8 text-[12.5px] focus-visible:ring-1 focus-visible:ring-[#346EF6]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[130px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC] text-[12.5px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Approved</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="h-9 w-[145px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC] text-[12.5px]">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div {...fadeUp(0.15)}>
        <Card className="overflow-hidden rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#F0F2F7] bg-[#FAFBFD] hover:bg-[#FAFBFD]">
                  {["Booking ID", "Customer", "Vehicle", "Pickup", "Status", "Payment", "Total", ""].map((heading) => (
                    <TableHead key={heading} className="whitespace-nowrap px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-[#A0AABF]">
                      {heading}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-[12px] text-[#8896A7]">
                      Loading bookings...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-[12px] text-[#8896A7]">
                      No bookings found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((booking) => (
                    <TableRow key={booking.backendId} className="border-b border-[#F8F9FC] transition-colors hover:bg-[#F5F5F5]">
                      <TableCell className="px-4 py-3 font-mono text-[12px] font-semibold text-[#346EF6]">{booking.bookingCode}</TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="text-[12.5px] font-semibold text-[#1A2340]">{booking.customer?.name || "Customer"}</div>
                        <div className="text-[11px] text-[#8896A7]">{booking.customer?.phoneNumber || booking.customer?.email || "Not provided"}</div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">
                        <div>{booking.vehicleName || "Vehicle unavailable"}</div>
                        <div className="text-[11px] text-[#A0AABF]">ID {booking.vehicleId}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-[12px] text-[#4A5568]">{booking.rentalDate || "Not provided"}</TableCell>
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
                      <TableCell className="whitespace-nowrap px-4 py-3 text-[12px] font-semibold text-[#1A2340]">{peso(booking.totalAmount)}</TableCell>
                      <TableCell className="px-4 py-3">
                        <TableActionMenu
                          label={`Open actions for ${booking.bookingCode}`}
                          items={[
                            {
                              label: "View",
                              icon: <Eye size={13} className="mr-2 text-[#A0AABF]" />,
                              onClick: () => {
                                setSelectedBooking(booking);
                                setSheetOpen(true);
                              },
                            },
                            {
                              label: "Cancel",
                              icon: <XCircle size={13} className="mr-2" />,
                              onClick: () => {
                                setSelectedBooking(booking);
                                setCancelOpen(true);
                              },
                              disabled: ["cancelled", "completed", "rejected"].includes(booking.statusKey),
                              separatorBefore: true,
                              variant: "danger",
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </motion.div>

      <BookingDetailsSheet
        booking={selectedBooking}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent className="max-w-[400px] rounded-2xl border-0 shadow-[0_24px_64px_rgba(0,0,0,0.13)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px] font-bold text-[#1A2340]">Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-[#6B7589]">
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
