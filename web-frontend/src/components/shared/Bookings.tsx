"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarCheck, Clock, Car, CheckCircle2, XCircle, TrendingUp,
  DollarSign, AlertTriangle, MapPin, Shield, CreditCard, Eye,
  MoreHorizontal, Search, Filter, Download, Plus, ChevronRight,
  Navigation, Camera, Timer, Zap, User, FileText, ReceiptText,
  Archive, RefreshCcw, Flag, Play, Wrench, X, Check, Phone,
  Mail, Fingerprint, BadgeAlert, Fuel, Users, TrendingDown,
  Map, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputWithLabel } from "@/components/common/InputWithLabel";
import { SelectWithLabel } from "@/components/common/SelectWithLabel";
import { TextAreaWithLabel } from "@/components/common/TextAreaWithLabel";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// ================= MOCK DATA =================

type BookingStatus = "pending" | "confirmed" | "ongoing" | "completed" | "cancelled";
type PaymentStatus = "paid" | "partial" | "unpaid" | "failed" | "refunded";
type BookingType = "self-drive" | "with-driver";

interface Booking {
  id: string; customer: string; customerEmail: string; customerPhone: string;
  vehicle: string; vehicleId: string; plateNo: string;
  pickupDate: string; returnDate: string; days: number;
  pickupType: "delivery" | "pickup"; pickupLocation: string;
  bookingType: BookingType; status: BookingStatus; paymentStatus: PaymentStatus;
  baseCost: number; downPayment: number; tollFee: number; overtimeCharge: number;
  outsideManilaFee: number; totalCost: number;
  fraudRisk: "low" | "medium" | "high"; createdAt: string;
  gpsStatus: "active" | "offline" | "geofence-alert";
  notes: string;
}

const MOCK_BOOKINGS: Booking[] = [
  {
    id: "BK-0091", customer: "Maria Santos", customerEmail: "maria@email.com", customerPhone: "+63 912 345 6789",
    vehicle: "Toyota Fortuner", vehicleId: "V001", plateNo: "ABC 1234",
    pickupDate: "May 16, 2026", returnDate: "May 20, 2026", days: 4,
    pickupType: "delivery", pickupLocation: "BGC, Taguig",
    bookingType: "self-drive", status: "ongoing", paymentStatus: "paid",
    baseCost: 18000, downPayment: 9000, tollFee: 400, overtimeCharge: 0, outsideManilaFee: 1500, totalCost: 19900,
    fraudRisk: "low", createdAt: "May 12, 2026", gpsStatus: "active", notes: "",
  },
  {
    id: "BK-0092", customer: "Juan dela Cruz", customerEmail: "juan@email.com", customerPhone: "+63 917 222 3344",
    vehicle: "Honda CR-V", vehicleId: "V002", plateNo: "DEF 5678",
    pickupDate: "May 17, 2026", returnDate: "May 19, 2026", days: 2,
    pickupType: "pickup", pickupLocation: "Makati Office",
    bookingType: "self-drive", status: "confirmed", paymentStatus: "partial",
    baseCost: 7600, downPayment: 3800, tollFee: 200, overtimeCharge: 0, outsideManilaFee: 0, totalCost: 7800,
    fraudRisk: "medium", createdAt: "May 13, 2026", gpsStatus: "offline", notes: "Customer requested early pickup.",
  },
  {
    id: "BK-0093", customer: "Ana Reyes", customerEmail: "ana@email.com", customerPhone: "+63 920 111 2233",
    vehicle: "Mitsubishi Montero Sport", vehicleId: "V003", plateNo: "GHI 9012",
    pickupDate: "May 18, 2026", returnDate: "May 22, 2026", days: 4,
    pickupType: "delivery", pickupLocation: "Quezon City",
    bookingType: "with-driver", status: "pending", paymentStatus: "unpaid",
    baseCost: 16800, downPayment: 0, tollFee: 0, overtimeCharge: 0, outsideManilaFee: 0, totalCost: 16800,
    fraudRisk: "high", createdAt: "May 14, 2026", gpsStatus: "offline", notes: "",
  },
  {
    id: "BK-0094", customer: "Carlos Mendoza", customerEmail: "carlos@email.com", customerPhone: "+63 918 999 8877",
    vehicle: "Ford Ranger Wildtrak", vehicleId: "V004", plateNo: "JKL 3456",
    pickupDate: "May 10, 2026", returnDate: "May 13, 2026", days: 3,
    pickupType: "pickup", pickupLocation: "Pasig Office",
    bookingType: "self-drive", status: "completed", paymentStatus: "paid",
    baseCost: 10500, downPayment: 5250, tollFee: 300, overtimeCharge: 800, outsideManilaFee: 0, totalCost: 11600,
    fraudRisk: "low", createdAt: "May 8, 2026", gpsStatus: "offline", notes: "Overtime 4hrs.",
  },
  {
    id: "BK-0095", customer: "Liza Uy", customerEmail: "liza@email.com", customerPhone: "+63 916 456 7890",
    vehicle: "Toyota Vios", vehicleId: "V005", plateNo: "MNO 7890",
    pickupDate: "May 14, 2026", returnDate: "May 15, 2026", days: 1,
    pickupType: "delivery", pickupLocation: "Mandaluyong",
    bookingType: "self-drive", status: "cancelled", paymentStatus: "refunded",
    baseCost: 1800, downPayment: 900, tollFee: 0, overtimeCharge: 0, outsideManilaFee: 0, totalCost: 1800,
    fraudRisk: "low", createdAt: "May 13, 2026", gpsStatus: "offline", notes: "Customer cancelled — emergency.",
  },
  {
    id: "BK-0096", customer: "Marco Tan", customerEmail: "marco@email.com", customerPhone: "+63 915 333 4455",
    vehicle: "Hyundai Tucson", vehicleId: "V006", plateNo: "PQR 1122",
    pickupDate: "May 20, 2026", returnDate: "May 23, 2026", days: 3,
    pickupType: "pickup", pickupLocation: "Alabang",
    bookingType: "self-drive", status: "pending", paymentStatus: "unpaid",
    baseCost: 9600, downPayment: 0, tollFee: 0, overtimeCharge: 0, outsideManilaFee: 2500, totalCost: 12100,
    fraudRisk: "medium", createdAt: "May 15, 2026", gpsStatus: "offline", notes: "",
  },
];

// ================= STYLE MAPS =================

const bookingStatusStyle: Record<BookingStatus, { badge: string; dot: string; label: string }> = {
  pending:   { badge: "bg-amber-50 text-amber-700 border-amber-200",    dot: "bg-amber-400",   label: "Pending" },
  confirmed: { badge: "bg-[#EEF4FF] text-[#346EF6] border-blue-200",  dot: "bg-[#346EF6]",   label: "Confirmed" },
  ongoing:   { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400", label: "Ongoing" },
  completed: { badge: "bg-[#F5F5F5] text-[#4A5568] border-[#E8ECF4]", dot: "bg-[#8896A7]",   label: "Completed" },
  cancelled: { badge: "bg-rose-50 text-rose-600 border-rose-200",      dot: "bg-rose-400",    label: "Cancelled" },
};

const paymentStatusStyle: Record<PaymentStatus, string> = {
  paid:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial:  "bg-amber-50 text-amber-700 border-amber-200",
  unpaid:   "bg-[#F5F5F5] text-[#8896A7] border-[#E8ECF4]",
  failed:   "bg-rose-50 text-rose-600 border-rose-200",
  refunded: "bg-violet-50 text-violet-700 border-violet-200",
};

const fraudStyle: Record<"low" | "medium" | "high", string> = {
  low:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high:   "bg-rose-50 text-rose-600 border-rose-200",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);


// ================= BOOKING DETAILS SHEET =================
// TODO: Extract into reusable component: <BookingDetailsSheet />

function BookingDetailsSheet({ booking, open, onClose }: { booking: Booking | null; open: boolean; onClose: () => void }) {
  if (!booking) return null;
  const st = bookingStatusStyle[booking.status];
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-[540px] p-0 border-l border-[#E8ECF4] gap-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-[#F0F2F7]">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-[15px] font-bold text-[#1A2340]">Booking Details</SheetTitle>
              <p className="text-[11.5px] text-[#8896A7] mt-0.5 font-mono">{booking.id}</p>
            </div>
            <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-lg border ${st.badge}`}>{st.label}</span>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-76px)]">
          <div className="px-5 py-4 space-y-4">

            {/* Booking Overview */}
            <div className="rounded-2xl border border-[#EEF1F8] bg-white p-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A0AABF]">Booking Overview</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Booking Type", cap(booking.bookingType.replace("-", " "))],
                  ["Pickup Type", cap(booking.pickupType)],
                  ["Pickup Location", booking.pickupLocation],
                  ["Rental Period", `${booking.days} day${booking.days > 1 ? "s" : ""}`],
                  ["Pickup Date", booking.pickupDate],
                  ["Return Date", booking.returnDate],
                ].map(([k, v]) => (
                  <div key={k} className="bg-[#F8F9FC] rounded-xl px-3 py-2">
                    <p className="text-[10px] text-[#A0AABF] font-medium uppercase tracking-wide">{k}</p>
                    <p className="text-[12.5px] font-semibold text-[#1A2340] mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Verification */}
            <div className="rounded-2xl border border-[#EEF1F8] bg-white p-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A0AABF]">Customer Verification</p>
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-[#EEF4FF] text-[#346EF6] text-[13px] font-bold">
                    {booking.customer.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[13px] font-bold text-[#1A2340]">{booking.customer}</p>
                  <p className="text-[11.5px] text-[#8896A7]">{booking.customerEmail}</p>
                </div>
                <span className={`ml-auto text-[10px] font-semibold px-2 py-1 rounded-lg border ${fraudStyle[booking.fraudRisk]}`}>
                  {cap(booking.fraudRisk)} Risk
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-[11.5px] text-[#4A5568] bg-[#F8F9FC] px-2.5 py-1.5 rounded-lg">
                  <Phone size={11} className="text-[#A0AABF]" /> {booking.customerPhone}
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px] text-[#4A5568] bg-[#F8F9FC] px-2.5 py-1.5 rounded-lg">
                  <Mail size={11} className="text-[#A0AABF]" /> {booking.customerEmail}
                </div>
              </div>
              {booking.fraudRisk === "high" && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200">
                  <BadgeAlert size={14} className="text-rose-500 flex-shrink-0" />
                  <p className="text-[11.5px] font-semibold text-rose-600">High fraud risk detected — verify ID before confirming.</p>
                </div>
              )}
            </div>

            {/* Vehicle Info */}
            <div className="rounded-2xl border border-[#EEF1F8] bg-white p-4 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A0AABF]">Vehicle Info</p>
              <div className="flex items-center gap-3 bg-[#F8F9FC] rounded-xl px-3 py-3">
                <div className="w-10 h-10 rounded-xl bg-[#EEF4FF] flex items-center justify-center text-2xl flex-shrink-0">🚙</div>
                <div>
                  <p className="text-[13px] font-bold text-[#1A2340]">{booking.vehicle}</p>
                  <p className="text-[11.5px] text-[#8896A7]">{booking.plateNo} · {booking.vehicleId}</p>
                </div>
              </div>
            </div>

            {/* Pricing Breakdown */}
            <div className="rounded-2xl border border-[#EEF1F8] bg-white p-4 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A0AABF]">Pricing Breakdown</p>
              <div className="space-y-1.5">
                {[
                  ["Base Cost", booking.baseCost],
                  ["Down Payment", -booking.downPayment],
                  ["Toll Fee", booking.tollFee],
                  ["Outside Manila Fee", booking.outsideManilaFee],
                  ["Overtime Charge", booking.overtimeCharge],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between text-[12.5px]">
                    <span className="text-[#8896A7]">{k}</span>
                    <span className={`font-semibold ${Number(v) < 0 ? "text-emerald-600" : "text-[#1A2340]"}`}>
                      {Number(v) < 0 ? `-₱${Math.abs(Number(v)).toLocaleString()}` : `₱${Number(v).toLocaleString()}`}
                    </span>
                  </div>
                ))}
                <Separator className="bg-[#F0F2F7] my-1" />
                <div className="flex justify-between">
                  <span className="text-[13px] font-bold text-[#1A2340]">Total</span>
                  <span className="text-[14px] font-bold text-[#346EF6]">₱{booking.totalCost.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1 pt-2 border-t border-[#F0F2F7]">
                <span className="text-[11.5px] text-[#8896A7]">Payment Status</span>
                <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-lg border ${paymentStatusStyle[booking.paymentStatus]}`}>
                  {cap(booking.paymentStatus)}
                </span>
              </div>
            </div>

            {/* GPS / Live Monitoring */}
            <div className="rounded-2xl border border-[#EEF1F8] bg-white p-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A0AABF]">GPS & Monitoring</p>
              <div className="grid grid-cols-2 gap-2">
                <div className={`rounded-xl px-3 py-2.5 border ${booking.gpsStatus === "active" ? "bg-emerald-50 border-emerald-200" : booking.gpsStatus === "geofence-alert" ? "bg-rose-50 border-rose-200" : "bg-[#F5F5F5] border-[#E8ECF4]"}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Navigation size={11} className={booking.gpsStatus === "active" ? "text-emerald-600" : "text-[#A0AABF]"} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8896A7]">GPS</span>
                  </div>
                  <p className="text-[12px] font-bold text-[#1A2340]">{booking.gpsStatus === "active" ? "Live" : cap(booking.gpsStatus)}</p>
                </div>
                <div className="rounded-xl px-3 py-2.5 border bg-[#F8F9FC] border-[#EEF1F8]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Camera size={11} className="text-[#A0AABF]" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8896A7]">Dashcam</span>
                  </div>
                  <p className="text-[12px] font-bold text-[#1A2340]">{booking.status === "ongoing" ? "Recording" : "N/A"}</p>
                </div>
                <div className="rounded-xl px-3 py-2.5 border bg-[#F8F9FC] border-[#EEF1F8]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Timer size={11} className="text-[#A0AABF]" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8896A7]">Late Return</span>
                  </div>
                  <p className="text-[12px] font-bold text-[#1A2340]">{booking.overtimeCharge > 0 ? `+${booking.overtimeCharge / 200}hrs` : "None"}</p>
                </div>
                <div className="rounded-xl px-3 py-2.5 border bg-[#F8F9FC] border-[#EEF1F8]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap size={11} className="text-[#A0AABF]" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8896A7]">Incidents</span>
                  </div>
                  <p className="text-[12px] font-bold text-[#1A2340]">None</p>
                </div>
              </div>
            </div>

            {/* Admin Notes */}
            <div className="rounded-2xl border border-[#EEF1F8] bg-white p-4 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#A0AABF]">Admin Notes</p>
              <TextAreaWithLabel
                id={`notes-${booking.id}`} label="Notes"
                placeholder="Add internal note…" defaultValue={booking.notes} rows={3}
              />
              <Button size="sm" className="rounded-xl bg-[#346EF6] hover:bg-[#2558D8] text-white text-[12px] font-semibold h-8 px-3 shadow-[0_2px_8px_rgba(52,110,246,0.2)]">
                Save Note
              </Button>
            </div>

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE

export function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>(MOCK_BOOKINGS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const filtered = bookings.filter((b) => {
    const haystack = `${b.id} ${b.customer} ${b.vehicle} ${b.plateNo}`.toLowerCase();
    const searchMatch = haystack.includes(search.toLowerCase());
    const statusMatch = statusFilter === "all" || b.status === statusFilter;
    const paymentMatch = paymentFilter === "all" || b.paymentStatus === paymentFilter;
    return searchMatch && statusMatch && paymentMatch;
  });

  const counts = {
    total: bookings.length,
    active: bookings.filter((b) => b.status === "ongoing" || b.status === "confirmed").length,
    pending: bookings.filter((b) => b.status === "pending").length,
    completed: bookings.filter((b) => b.status === "completed").length,
  };

  const openDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setSheetOpen(true);
  };

  const openCancel = (booking: Booking) => {
    setSelectedBooking(booking);
    setCancelOpen(true);
  };

  const confirmCancel = () => {
    if (!selectedBooking) return;
    setBookings((prev) =>
      prev.map((b) =>
        b.id === selectedBooking.id
          ? { ...b, status: "cancelled", paymentStatus: b.paymentStatus === "paid" ? "refunded" : b.paymentStatus }
          : b,
      ),
    );
    setCancelOpen(false);
  };

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay },
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 bg-[#F5F5F5] min-h-screen">
      <motion.div {...fadeUp(0)} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2340] tracking-tight">Booking Management</h1>
          <p className="text-sm text-[#8896A7] mt-0.5">Track reservations, payment states, and live trip progress.</p>
        </div>
        <Button className="rounded-xl bg-[#346EF6] hover:bg-[#2558D8] text-white text-[13px] font-semibold h-10 px-4 shadow-[0_4px_14px_rgba(52,110,246,0.28)] w-full sm:w-auto">
          <Plus size={15} className="mr-2" /> New Booking
        </Button>
      </motion.div>

      <motion.div {...fadeUp(0.05)} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total, icon: CalendarCheck, c: "text-[#346EF6]", bg: "bg-[#EEF4FF]" },
          { label: "Active", value: counts.active, icon: Activity, c: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Pending", value: counts.pending, icon: Clock, c: "text-amber-600", bg: "bg-amber-50" },
          { label: "Completed", value: counts.completed, icon: CheckCircle2, c: "text-[#4A5568]", bg: "bg-[#F5F5F5]" },
        ].map(({ label, value, icon: Icon, c, bg }) => (
          <Card key={label} className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon size={17} className={c} />
              </div>
              <div>
                <p className="text-[22px] font-bold text-[#1A2340] leading-none">{value}</p>
                <p className="text-[11px] text-[#8896A7] mt-0.5 font-medium">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div {...fadeUp(0.1)}>
        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2.5 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AABF]" />
              <Input
                placeholder="Search bookings..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC] focus-visible:ring-[#346EF6] focus-visible:ring-1"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC] w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="h-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC] w-[140px]">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      <motion.div {...fadeUp(0.15)}>
        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFBFD] border-b border-[#F0F2F7] hover:bg-[#FAFBFD]">
                {["Booking ID", "Customer", "Vehicle", "Pickup", "Status", "Payment", "Total", ""].map((h) => (
                  <TableHead key={h} className="text-[10.5px] font-semibold text-[#A0AABF] uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-[12px] text-[#8896A7]">
                    No bookings found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((booking) => (
                  <TableRow key={booking.id} className="border-b border-[#F8F9FC] hover:bg-[#F5F5F5] transition-colors">
                    <TableCell className="px-4 py-3 text-[12px] font-mono font-semibold text-[#346EF6]">{booking.id}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="text-[12.5px] font-semibold text-[#1A2340]">{booking.customer}</div>
                      <div className="text-[11px] text-[#8896A7]">{booking.customerPhone}</div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">
                      <div>{booking.vehicle}</div>
                      <div className="text-[11px] text-[#A0AABF]">{booking.plateNo}</div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-[12px] text-[#4A5568] whitespace-nowrap">{booking.pickupDate}</TableCell>
                    <TableCell className="px-4 py-3">
                      <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-lg border ${bookingStatusStyle[booking.status].badge}`}>
                        {bookingStatusStyle[booking.status].label}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-lg border ${paymentStatusStyle[booking.paymentStatus]}`}>
                        {cap(booking.paymentStatus)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-[12px] font-semibold text-[#1A2340] whitespace-nowrap">
                      ₱{booking.totalCost.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[#A0AABF] hover:bg-[#EEF4FF] hover:text-[#346EF6] transition-colors">
                            <MoreHorizontal size={14} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 rounded-xl border-[#EEF1F8] p-1">
                          <DropdownMenuItem onClick={() => openDetails(booking)} className="rounded-lg text-[12.5px] px-3 py-2 cursor-pointer">
                            <Eye size={13} className="mr-2 text-[#A0AABF]" /> View
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={booking.status === "cancelled" || booking.status === "completed"}
                            onClick={() => openCancel(booking)}
                            className="rounded-lg text-[12.5px] text-rose-500 px-3 py-2 cursor-pointer"
                          >
                            <XCircle size={13} className="mr-2" /> Cancel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      </motion.div>

      <BookingDetailsSheet booking={selectedBooking} open={sheetOpen} onClose={() => setSheetOpen(false)} />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent className="max-w-[400px] rounded-2xl border-0 shadow-[0_24px_64px_rgba(0,0,0,0.13)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px] font-bold text-[#1A2340]">Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-[#6B7589]">
              Cancel booking <strong>{selectedBooking?.id}</strong> for <strong>{selectedBooking?.customer}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Back</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white">
              Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
