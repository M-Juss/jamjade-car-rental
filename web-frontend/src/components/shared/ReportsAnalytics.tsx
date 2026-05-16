"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  CalendarRange,
  TrendingUp,
  TrendingDown,
  PhilippinePeso,
  BookOpen,
  CheckCircle2,
  Car,
  XCircle,
  Gauge,
  Clock3,
  ShieldAlert,
  BarChart3,
  Eye,
  AlertTriangle,
  Search,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SelectWithLabel } from "@/components/common/SelectWithLabel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

type BookingStatus = "Pending" | "Confirmed" | "Ongoing" | "Completed" | "Cancelled";
type PaymentStatus = "Paid" | "Pending" | "Refunded";
type RentalType = "Daily" | "Weekly" | "Monthly" | "Yearly";
type RiskSeverity = "Low" | "Medium" | "High";

type Kpi = {
  label: string;
  value: string;
  trend: string;
  up: boolean;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  bg: string;
  color: string;
};

type RevenueTransaction = {
  bookingId: string;
  customer: string;
  vehicle: string;
  rentalType: RentalType;
  paymentMethod: string;
  amount: number;
  paidDate: string;
  status: PaymentStatus;
};

type BookingRow = {
  bookingId: string;
  customer: string;
  vehicle: string;
  rentalDate: string;
  returnDate: string;
  totalCost: number;
  status: BookingStatus;
};

type FleetRow = {
  vehicle: string;
  plateNumber: string;
  totalBookings: number;
  revenue: number;
  utilization: number;
  maintenanceStatus: "Good" | "Due" | "Critical";
  incidents: number;
};

type CustomerRow = {
  name: string;
  email: string;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpent: number;
  lastBookingDate: string;
};

type RiskRow = {
  eventId: string;
  bookingId: string;
  vehicle: string;
  customer: string;
  eventType: string;
  location: string;
  timestamp: string;
  severity: RiskSeverity;
  videoEvidence: number;
};

const kpis: Kpi[] = [
  { label: "Total Revenue", value: "₱4.82M", trend: "+11.8%", up: true, icon: PhilippinePeso, bg: "bg-[#EEF4FF]", color: "text-[#346EF6]" },
  { label: "Total Bookings", value: "1,246", trend: "+8.2%", up: true, icon: BookOpen, bg: "bg-emerald-50", color: "text-emerald-600" },
  { label: "Completed Rentals", value: "1,012", trend: "+6.4%", up: true, icon: CheckCircle2, bg: "bg-[#F5F5F5]", color: "text-[#4A5568]" },
  { label: "Active Rentals", value: "38", trend: "+4.1%", up: true, icon: Car, bg: "bg-blue-50", color: "text-blue-600" },
  { label: "Cancelled Bookings", value: "79", trend: "-2.3%", up: true, icon: XCircle, bg: "bg-rose-50", color: "text-rose-500" },
  { label: "Fleet Utilization Rate", value: "74%", trend: "+3.9%", up: true, icon: Gauge, bg: "bg-amber-50", color: "text-amber-600" },
  { label: "Average Booking Duration", value: "3.7 days", trend: "-0.4%", up: false, icon: Clock3, bg: "bg-violet-50", color: "text-violet-600" },
  { label: "Refund Loss", value: "₱118K", trend: "+1.9%", up: false, icon: ShieldAlert, bg: "bg-rose-50", color: "text-rose-500" },
];

const revenueTrend = [
  { month: "Jan", revenue: 320000 },
  { month: "Feb", revenue: 352000 },
  { month: "Mar", revenue: 388000 },
  { month: "Apr", revenue: 401000 },
  { month: "May", revenue: 436000 },
  { month: "Jun", revenue: 458000 },
  { month: "Jul", revenue: 474000 },
  { month: "Aug", revenue: 497000 },
  { month: "Sep", revenue: 521000 },
  { month: "Oct", revenue: 534000 },
  { month: "Nov", revenue: 565000 },
  { month: "Dec", revenue: 598000 },
];

const bookingPerformance = [
  { month: "Jan", bookings: 86, completed: 71 },
  { month: "Feb", bookings: 92, completed: 79 },
  { month: "Mar", bookings: 98, completed: 84 },
  { month: "Apr", bookings: 103, completed: 86 },
  { month: "May", bookings: 109, completed: 91 },
  { month: "Jun", bookings: 112, completed: 94 },
  { month: "Jul", bookings: 118, completed: 99 },
  { month: "Aug", bookings: 120, completed: 101 },
  { month: "Sep", bookings: 114, completed: 96 },
  { month: "Oct", bookings: 126, completed: 104 },
  { month: "Nov", bookings: 132, completed: 109 },
  { month: "Dec", bookings: 136, completed: 114 },
];

const bookingStatusDistribution = [
  { name: "Completed", value: 1012, color: "#10B981" },
  { name: "Ongoing", value: 38, color: "#346EF6" },
  { name: "Confirmed", value: 117, color: "#60A5FA" },
  { name: "Pending", value: 79, color: "#F59E0B" },
  { name: "Cancelled", value: 79, color: "#F43F5E" },
];

const revenueByRentalType = [
  { type: "Daily", value: 1770000 },
  { type: "Weekly", value: 1240000 },
  { type: "Monthly", value: 1320000 },
  { type: "Yearly", value: 490000 },
];

const newVsReturning = [
  { month: "Jan", new: 45, returning: 39 },
  { month: "Feb", new: 49, returning: 42 },
  { month: "Mar", new: 52, returning: 48 },
  { month: "Apr", new: 58, returning: 50 },
  { month: "May", new: 61, returning: 53 },
  { month: "Jun", new: 57, returning: 59 },
  { month: "Jul", new: 63, returning: 62 },
  { month: "Aug", new: 66, returning: 60 },
  { month: "Sep", new: 62, returning: 64 },
  { month: "Oct", new: 67, returning: 66 },
  { month: "Nov", new: 70, returning: 68 },
  { month: "Dec", new: 73, returning: 70 },
];

const riskEventCounts = [
  { type: "Geofence", count: 34 },
  { type: "Harsh Braking", count: 62 },
  { type: "Accel", count: 49 },
  { type: "Sharp Turn", count: 27 },
  { type: "Overspeed", count: 41 },
  { type: "Late Return", count: 22 },
  { type: "Accident", count: 6 },
];

const revenueTransactions: RevenueTransaction[] = [
  { bookingId: "BK-1208", customer: "Maria Santos", vehicle: "Toyota Vios", rentalType: "Daily", paymentMethod: "GCash", amount: 5600, paidDate: "May 10, 2026", status: "Paid" },
  { bookingId: "BK-1214", customer: "John Reyes", vehicle: "Honda City", rentalType: "Weekly", paymentMethod: "Card", amount: 14800, paidDate: "May 12, 2026", status: "Paid" },
  { bookingId: "BK-1221", customer: "Liza Uy", vehicle: "Toyota Innova", rentalType: "Monthly", paymentMethod: "Bank Transfer", amount: 43200, paidDate: "May 13, 2026", status: "Pending" },
  { bookingId: "BK-1229", customer: "Carlo Dizon", vehicle: "Mitsubishi Mirage", rentalType: "Daily", paymentMethod: "Cash", amount: 4800, paidDate: "May 14, 2026", status: "Refunded" },
];

const bookingsRows: BookingRow[] = [
  { bookingId: "BK-1240", customer: "Lea Mateo", vehicle: "Toyota Vios", rentalDate: "May 15, 2026", returnDate: "May 17, 2026", totalCost: 7200, status: "Completed" },
  { bookingId: "BK-1242", customer: "Jared Lim", vehicle: "Honda City", rentalDate: "May 16, 2026", returnDate: "May 19, 2026", totalCost: 9600, status: "Ongoing" },
  { bookingId: "BK-1249", customer: "Nina Cruz", vehicle: "Toyota Innova", rentalDate: "May 17, 2026", returnDate: "May 21, 2026", totalCost: 18800, status: "Confirmed" },
  { bookingId: "BK-1256", customer: "Paul Santos", vehicle: "Mitsubishi Mirage", rentalDate: "May 18, 2026", returnDate: "May 19, 2026", totalCost: 4300, status: "Cancelled" },
];

const fleetRows: FleetRow[] = [
  { vehicle: "Toyota Vios", plateNumber: "ABC 1234", totalBookings: 146, revenue: 812000, utilization: 84, maintenanceStatus: "Good", incidents: 4 },
  { vehicle: "Honda City", plateNumber: "DEF 5678", totalBookings: 131, revenue: 754000, utilization: 79, maintenanceStatus: "Due", incidents: 7 },
  { vehicle: "Toyota Innova", plateNumber: "GHI 9012", totalBookings: 118, revenue: 943000, utilization: 73, maintenanceStatus: "Good", incidents: 3 },
  { vehicle: "Mitsubishi Mirage", plateNumber: "JKL 3456", totalBookings: 82, revenue: 438000, utilization: 55, maintenanceStatus: "Critical", incidents: 12 },
];

const customerRows: CustomerRow[] = [
  { name: "Maria Santos", email: "maria@email.com", totalBookings: 24, completedBookings: 22, cancelledBookings: 1, totalSpent: 146000, lastBookingDate: "May 10, 2026" },
  { name: "John Reyes", email: "john@email.com", totalBookings: 18, completedBookings: 16, cancelledBookings: 2, totalSpent: 118400, lastBookingDate: "May 12, 2026" },
  { name: "Liza Uy", email: "liza@email.com", totalBookings: 14, completedBookings: 11, cancelledBookings: 2, totalSpent: 97200, lastBookingDate: "May 13, 2026" },
  { name: "Nina Cruz", email: "nina@email.com", totalBookings: 9, completedBookings: 7, cancelledBookings: 1, totalSpent: 64800, lastBookingDate: "May 11, 2026" },
];

const riskRows: RiskRow[] = [
  { eventId: "EV-0091", bookingId: "BK-1221", vehicle: "Toyota Innova", customer: "Liza Uy", eventType: "Geofence Violation", location: "Tagaytay", timestamp: "May 13, 2026 14:24", severity: "High", videoEvidence: 2 },
  { eventId: "EV-0097", bookingId: "BK-1242", vehicle: "Honda City", customer: "Jared Lim", eventType: "Harsh Braking", location: "EDSA", timestamp: "May 16, 2026 09:12", severity: "Medium", videoEvidence: 1 },
  { eventId: "EV-0103", bookingId: "BK-1230", vehicle: "Toyota Vios", customer: "Lea Mateo", eventType: "Late Return", location: "Makati", timestamp: "May 14, 2026 20:41", severity: "Low", videoEvidence: 0 },
  { eventId: "EV-0106", bookingId: "BK-1249", vehicle: "Mitsubishi Mirage", customer: "Nina Cruz", eventType: "Overspeeding", location: "SLEX", timestamp: "May 17, 2026 11:03", severity: "High", videoEvidence: 3 },
];

const chartConfig = {
  revenue: { label: "Revenue", color: "#346EF6" },
  bookings: { label: "Bookings", color: "#10B981" },
  completed: { label: "Completed", color: "#346EF6" },
  new: { label: "New", color: "#346EF6" },
  returning: { label: "Returning", color: "#10B981" },
  count: { label: "Events", color: "#F59E0B" },
};

function statusBadge(status: BookingStatus | PaymentStatus) {
  if (status === "Completed" || status === "Paid") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "Ongoing" || status === "Confirmed") return "bg-[#EEF4FF] text-[#346EF6] border-blue-200";
  if (status === "Pending") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "Cancelled" || status === "Refunded") return "bg-rose-50 text-rose-600 border-rose-200";
  return "bg-[#F5F5F5] text-[#8896A7] border-[#E8ECF4]";
}

function maintenanceBadge(status: FleetRow["maintenanceStatus"]) {
  if (status === "Good") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "Due") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-600 border-rose-200";
}

function severityBadge(sev: RiskSeverity) {
  if (sev === "Low") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (sev === "Medium") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-600 border-rose-200";
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-[12px] text-[#8896A7]">{message}</div>
  );
}

export function ReportsAnalytics() {
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("last_30_days");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");
  const [rentalTypeFilter, setRentalTypeFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [riskSeverityFilter, setRiskSeverityFilter] = useState("all");

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay },
  });

  const filteredRevenueRows = useMemo(() => {
    return revenueTransactions.filter((row) => {
      const query = `${row.bookingId} ${row.customer} ${row.vehicle}`.toLowerCase();
      const searchMatch = query.includes(search.toLowerCase());
      const rentalMatch = rentalTypeFilter === "all" || row.rentalType.toLowerCase() === rentalTypeFilter;
      const paymentMatch = paymentStatusFilter === "all" || row.status.toLowerCase() === paymentStatusFilter;
      return searchMatch && rentalMatch && paymentMatch;
    });
  }, [search, rentalTypeFilter, paymentStatusFilter]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 bg-[#F5F5F5] min-h-screen">
      <motion.div {...fadeUp(0)} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2340] tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-[#8896A7] mt-0.5">
            Track revenue, bookings, fleet performance, customer insights, and operational risks.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="rounded-xl border-[#E2E8F0] text-[#4A5568] h-10 text-[13px]">
            <Download size={14} className="mr-2" /> Export Excel
          </Button>
          <Button variant="outline" className="rounded-xl border-[#E2E8F0] text-[#4A5568] h-10 text-[13px]">
            <Download size={14} className="mr-2" /> Export PDF
          </Button>
        </div>
      </motion.div>

      <motion.div {...fadeUp(0.1)} className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {kpis.map(({ label, value, trend, up, icon: Icon, bg, color }) => (
          <Card key={label} className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-2.5`}>
                <Icon size={16} className={color} />
              </div>
              <p className="text-[18px] md:text-[20px] font-bold text-[#1A2340] leading-none">{value}</p>
              <p className="text-[10.5px] text-[#8896A7] mt-1">{label}</p>
              <div className={`mt-2 text-[10.5px] font-semibold flex items-center gap-1 ${up ? "text-emerald-600" : "text-rose-500"}`}>
                {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {trend}
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <Tabs defaultValue="overview" className="space-y-4">
        <motion.div {...fadeUp(0.15)}>
          <TabsList className="w-full justify-start overflow-x-auto bg-white border border-[#EEF1F8] rounded-xl h-auto p-1">
            <TabsTrigger value="overview" className="text-[12px]">Overview</TabsTrigger>
            <TabsTrigger value="revenue" className="text-[12px]">Revenue</TabsTrigger>
            <TabsTrigger value="bookings" className="text-[12px]">Bookings</TabsTrigger>
            <TabsTrigger value="fleet" className="text-[12px]">Fleet Performance</TabsTrigger>
            <TabsTrigger value="customers" className="text-[12px]">Customer Insights</TabsTrigger>
            <TabsTrigger value="risk" className="text-[12px]">Risk & Telematics</TabsTrigger>
          </TabsList>
        </motion.div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-[14px]">Revenue Trend</CardTitle>
                <CardDescription className="text-[12px]">Monthly revenue performance</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <LineChart data={revenueTrend} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${Math.round(v / 1000)}k`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-[14px]">Booking Status Distribution</CardTitle>
                <CardDescription className="text-[12px]">Current booking status mix</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                  <ChartContainer config={chartConfig} className="h-[220px] w-[220px]">
                    <PieChart>
                      <Pie data={bookingStatusDistribution} dataKey="value" innerRadius={58} outerRadius={86} paddingAngle={2}>
                        {bookingStatusDistribution.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                  <div className="flex-1 w-full space-y-2">
                    {bookingStatusDistribution.map((item) => (
                      <div key={item.name} className="flex items-center justify-between bg-[#F8F9FC] rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-[12px] text-[#4A5568]">{item.name}</span>
                        </div>
                        <span className="text-[12px] font-semibold text-[#1A2340]">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="xl:col-span-2 rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-[14px]">Monthly Booking Performance</CardTitle>
                <CardDescription className="text-[12px]">Bookings vs completed rentals</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <BarChart data={bookingPerformance} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="bookings" fill="#93C5FD" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="completed" fill="#346EF6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-[14px]">Recent Highlights</CardTitle>
                <CardDescription className="text-[12px]">Automated business insights</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {[
                  "Most booked vehicle: Toyota Vios (146 bookings)",
                  "Highest revenue month: December (₱598,000)",
                  "Cancellation rate decreased by 2.3% vs previous month",
                  "3 vehicles due for maintenance this week",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 rounded-xl bg-[#F8F9FC] px-3 py-2.5">
                    <BarChart3 size={13} className="text-[#346EF6] mt-0.5" />
                    <p className="text-[12px] text-[#4A5568]">{item}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Revenue by Month</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <AreaChart data={revenueTrend} margin={{ left: -16, right: 8 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#346EF6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#346EF6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${Math.round(v / 1000)}k`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="revenue" stroke="#346EF6" fill="url(#revenueFill)" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Revenue by Rental Type</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <BarChart data={revenueByRentalType} margin={{ left: -6, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" vertical={false} />
                    <XAxis dataKey="type" tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${Math.round(v / 1000)}k`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="#346EF6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              ["Rental Revenue", "₱4.12M", "text-[#346EF6]"],
              ["Delivery Fees", "₱212K", "text-emerald-600"],
              ["Add-ons", "₱176K", "text-violet-600"],
              ["Late Return Penalties", "₱194K", "text-amber-600"],
              ["Refund Loss", "₱118K", "text-rose-500"],
            ].map(([label, val, color]) => (
              <Card key={String(label)} className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
                <CardContent className="p-4">
                  <p className="text-[11px] text-[#8896A7]">{label}</p>
                  <p className={`text-[18px] font-bold ${color}`}>{val}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white overflow-hidden">
            <CardHeader className="pb-2"><CardTitle className="text-[14px]">Revenue Transactions</CardTitle></CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FAFBFD]">
                      {[
                        "Booking ID", "Customer", "Vehicle", "Rental Type", "Payment Method",
                        "Amount", "Paid Date", "Status",
                      ].map((h) => <TableHead key={h} className="text-[10.5px] px-4 py-3">{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRevenueRows.length === 0 ? (
                      <TableRow><TableCell colSpan={8}><EmptyState message="No revenue transactions found." /></TableCell></TableRow>
                    ) : filteredRevenueRows.map((row) => (
                      <TableRow key={row.bookingId}>
                        <TableCell className="px-4 py-3 text-[12px] font-mono text-[#346EF6]">{row.bookingId}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] font-medium text-[#1A2340]">{row.customer}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.vehicle}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.rentalType}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.paymentMethod}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] font-semibold text-[#1A2340]">₱{row.amount.toLocaleString()}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.paidDate}</TableCell>
                        <TableCell className="px-4 py-3"><Badge className={`border ${statusBadge(row.status)}`}>{row.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookings" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="xl:col-span-2 rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Booking Volume</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <LineChart data={bookingPerformance} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line dataKey="bookings" stroke="#346EF6" strokeWidth={2.2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Cancellation Analytics</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                <div className="rounded-xl bg-[#F8F9FC] p-3">
                  <p className="text-[11px] text-[#8896A7]">Cancellation Rate</p>
                  <p className="text-[18px] font-bold text-rose-500">6.3%</p>
                </div>
                <div className="rounded-xl bg-[#F8F9FC] p-3">
                  <p className="text-[11px] text-[#8896A7]">Top Reason</p>
                  <p className="text-[13px] font-semibold text-[#1A2340]">Schedule conflict</p>
                </div>
                <div className="rounded-xl bg-[#F8F9FC] p-3">
                  <p className="text-[11px] text-[#8896A7]">Trend</p>
                  <p className="text-[13px] font-semibold text-emerald-600">-2.3% MoM</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white overflow-hidden">
            <CardHeader className="pb-2"><CardTitle className="text-[14px]">Booking Records</CardTitle></CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FAFBFD]">
                      {["Booking ID", "Customer Name", "Vehicle", "Rental Date", "Return Date", "Total Cost", "Status", "Action"].map((h) => (
                        <TableHead key={h} className="text-[10.5px] px-4 py-3">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookingsRows.map((row) => (
                      <TableRow key={row.bookingId}>
                        <TableCell className="px-4 py-3 text-[12px] font-mono text-[#346EF6]">{row.bookingId}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] font-medium text-[#1A2340]">{row.customer}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.vehicle}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.rentalDate}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.returnDate}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] font-semibold text-[#1A2340]">₱{row.totalCost.toLocaleString()}</TableCell>
                        <TableCell className="px-4 py-3"><Badge className={`border ${statusBadge(row.status)}`}>{row.status}</Badge></TableCell>
                        <TableCell className="px-4 py-3">
                          <Button size="sm" variant="outline" className="h-8 rounded-lg text-[11px]">
                            <Eye size={12} className="mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fleet" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              ["Most Booked", "Toyota Vios", "146 bookings"],
              ["Least Booked", "Mitsubishi Mirage", "82 bookings"],
              ["Avg Utilization", "74%", "+3.9%"],
              ["Due Maintenance", "3 Vehicles", "This week"],
            ].map(([label, value, sub]) => (
              <Card key={String(label)} className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
                <CardContent className="p-4">
                  <p className="text-[11px] text-[#8896A7]">{label}</p>
                  <p className="text-[16px] font-bold text-[#1A2340]">{value}</p>
                  <p className="text-[11px] text-[#346EF6]">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white overflow-hidden">
            <CardHeader className="pb-2"><CardTitle className="text-[14px]">Fleet Performance Table</CardTitle></CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FAFBFD]">
                      {["Vehicle", "Plate Number", "Total Bookings", "Revenue", "Utilization %", "Maintenance Status", "Incident Count"].map((h) => (
                        <TableHead key={h} className="text-[10.5px] px-4 py-3">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fleetRows.map((row) => (
                      <TableRow key={row.plateNumber}>
                        <TableCell className="px-4 py-3 text-[12px] font-medium text-[#1A2340]">{row.vehicle}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.plateNumber}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.totalBookings}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] font-semibold text-[#1A2340]">₱{row.revenue.toLocaleString()}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.utilization}%</TableCell>
                        <TableCell className="px-4 py-3"><Badge className={`border ${maintenanceBadge(row.maintenanceStatus)}`}>{row.maintenanceStatus}</Badge></TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.incidents}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">New vs Returning Customers</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <AreaChart data={newVsReturning} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="new" stroke="#346EF6" fill="#DBEAFE" fillOpacity={0.8} />
                    <Area type="monotone" dataKey="returning" stroke="#10B981" fill="#D1FAE5" fillOpacity={0.65} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Customer Cancellation Behavior</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {["No-show cancellations: 19", "Schedule conflict: 42", "Price-sensitive cancellations: 13", "Verification-related cancellations: 5"].map((text) => (
                  <div key={text} className="rounded-xl bg-[#F8F9FC] px-3 py-2.5 text-[12px] text-[#4A5568]">{text}</div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white overflow-hidden">
            <CardHeader className="pb-2"><CardTitle className="text-[14px]">Customer Insights Table</CardTitle></CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FAFBFD]">
                      {["Customer Name", "Email", "Total Bookings", "Completed Bookings", "Cancelled Bookings", "Total Spent", "Last Booking Date"].map((h) => (
                        <TableHead key={h} className="text-[10.5px] px-4 py-3">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerRows.map((row) => (
                      <TableRow key={row.email}>
                        <TableCell className="px-4 py-3 text-[12px] font-medium text-[#1A2340]">{row.name}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.email}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.totalBookings}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-emerald-700">{row.completedBookings}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-rose-600">{row.cancelledBookings}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] font-semibold text-[#1A2340]">₱{row.totalSpent.toLocaleString()}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.lastBookingDate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Risk Event Analytics</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <BarChart data={riskEventCounts} margin={{ left: -10, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" vertical={false} />
                    <XAxis dataKey="type" tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Risk Summary</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[
                  ["Geofence violations", "34 events", "High"],
                  ["Overspeeding", "41 events", "High"],
                  ["Harsh braking", "62 events", "Medium"],
                  ["Accident reports", "6 events", "High"],
                ].map(([label, count, sev]) => (
                  <div key={String(label)} className="rounded-xl bg-[#F8F9FC] px-3 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-[12px] text-[#4A5568]">{label}</p>
                      <p className="text-[11px] text-[#8896A7]">{count}</p>
                    </div>
                    <Badge className={`border ${severityBadge(sev as RiskSeverity)}`}>{sev}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white overflow-hidden">
            <CardHeader className="pb-2"><CardTitle className="text-[14px]">Risk & Telematics Events</CardTitle></CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FAFBFD]">
                      {["Event ID", "Booking ID", "Vehicle", "Customer", "Event Type", "Location", "Time Stamp", "Severity", "Video Evidence", "Action"].map((h) => (
                        <TableHead key={h} className="text-[10.5px] px-4 py-3">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {riskRows.map((row) => (
                      <TableRow key={row.eventId}>
                        <TableCell className="px-4 py-3 text-[12px] font-mono text-[#346EF6]">{row.eventId}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.bookingId}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.vehicle}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.customer}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#1A2340]">{row.eventType}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.location}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.timestamp}</TableCell>
                        <TableCell className="px-4 py-3"><Badge className={`border ${severityBadge(row.severity)}`}>{row.severity}</Badge></TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{row.videoEvidence}</TableCell>
                        <TableCell className="px-4 py-3">
                          <Button size="sm" variant="outline" className="h-8 rounded-lg text-[11px]">
                            <Eye size={12} className="mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* TODO: Replace mock data with backend API integration once endpoints are ready. */}
      <Card className="rounded-2xl border border-dashed border-[#DDE3EE] bg-[#FAFBFD] shadow-none">
        <CardContent className="p-4 flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-[#A0AABF] mt-0.5" />
          <p className="text-[12px] text-[#6B7589]">
            Analytics shown here use mock data for UI development. Hook this page to reporting endpoints and telemetry services next.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default ReportsAnalytics;
