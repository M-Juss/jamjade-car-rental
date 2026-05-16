"use client";

import { useState } from "react";
import {
  DollarSign, Car, Users, CheckCircle2, KeyRound, Clock,
  TrendingUp, TrendingDown, Eye, Check, X, CalendarCheck,
  RotateCcw, CreditCard, UserPlus, Wrench,
} from "lucide-react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import { motion } from "framer-motion";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const monthlyBookings = [
  { month: "Jan", bookings: 42 }, { month: "Feb", bookings: 58 },
  { month: "Mar", bookings: 75 }, { month: "Apr", bookings: 63 },
  { month: "May", bookings: 91 }, { month: "Jun", bookings: 84 },
  { month: "Jul", bookings: 110 }, { month: "Aug", bookings: 98 },
  { month: "Sep", bookings: 87 }, { month: "Oct", bookings: 120 },
  { month: "Nov", bookings: 105 }, { month: "Dec", bookings: 134 },
];

const monthlyRevenue = [
  { month: "Jan", revenue: 182000 }, { month: "Feb", revenue: 241000 },
  { month: "Mar", revenue: 318000 }, { month: "Apr", revenue: 274000 },
  { month: "May", revenue: 392000 }, { month: "Jun", revenue: 358000 },
  { month: "Jul", revenue: 471000 }, { month: "Aug", revenue: 415000 },
  { month: "Sep", revenue: 376000 }, { month: "Oct", revenue: 512000 },
  { month: "Nov", revenue: 448000 }, { month: "Dec", revenue: 574000 },
];

const fleetStatus = [
  { name: "Available", value: 38, color: "#346EF6" },
  { name: "Rented", value: 27, color: "#10B981" },
  { name: "Maintenance", value: 8, color: "#F59E0B" },
];

const topVehicles = [
  { id: 1, name: "Toyota Fortuner", bookings: 48, revenue: "₱192,000", status: "Available", img: "🚙" },
  { id: 2, name: "Honda CR-V", bookings: 41, revenue: "₱164,000", status: "Rented", img: "🚗" },
  { id: 3, name: "Mitsubishi Montero", bookings: 37, revenue: "₱148,000", status: "Available", img: "🛻" },
];

const pendingBookings = [
  { id: "BK-0091", customer: "Maria Santos", vehicle: "Toyota Fortuner", pickup: "May 12, 2026", return: "May 16, 2026", status: "Pending" },
  { id: "BK-0092", customer: "Juan dela Cruz", vehicle: "Honda CR-V", pickup: "May 13, 2026", return: "May 15, 2026", status: "Pending" },
  { id: "BK-0093", customer: "Ana Reyes", vehicle: "Mitsubishi Montero", pickup: "May 14, 2026", return: "May 18, 2026", status: "Under Review" },
  { id: "BK-0094", customer: "Carlos Mendoza", vehicle: "Ford Ranger", pickup: "May 15, 2026", return: "May 17, 2026", status: "Pending" },
  { id: "BK-0095", customer: "Liza Uy", vehicle: "Toyota Vios", pickup: "May 16, 2026", return: "May 20, 2026", status: "Under Review" },
];

const activities = [
  { icon: CalendarCheck, label: "Booking #BK-0090 confirmed", time: "2 min ago", color: "text-[#346EF6]", bg: "bg-[#EEF4FF]" },
  { icon: RotateCcw, label: "Honda CR-V returned by J. Reyes", time: "18 min ago", color: "text-emerald-600", bg: "bg-emerald-50" },
  { icon: CreditCard, label: "Payment ₱12,500 received — BK-0088", time: "45 min ago", color: "text-violet-600", bg: "bg-violet-50" },
  { icon: UserPlus, label: "New customer registered: Celine Go", time: "1 hr ago", color: "text-[#346EF6]", bg: "bg-[#EEF4FF]" },
  { icon: Wrench, label: "Ford Ranger sent for maintenance", time: "2 hrs ago", color: "text-amber-600", bg: "bg-amber-50" },
  { icon: CalendarCheck, label: "Booking #BK-0089 confirmed", time: "3 hrs ago", color: "text-[#346EF6]", bg: "bg-[#EEF4FF]" },
  { icon: CreditCard, label: "Payment ₱9,800 received — BK-0087", time: "5 hrs ago", color: "text-violet-600", bg: "bg-violet-50" },
];

// ─── KPI DATA ─────────────────────────────────────────────────────────────────

// TODO: Extract into reusable component: <KpiCard />
const kpiData = [
  { label: "Total Revenue", value: "₱4.56M", icon: DollarSign, change: "+12.4%", up: true, iconBg: "bg-[#EEF4FF]", iconColor: "text-[#346EF6]" },
  { label: "Total Vehicles", value: "73", icon: Car, change: "+3 this month", up: true, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  { label: "Total Customers", value: "1,284", icon: Users, change: "+8.1%", up: true, iconBg: "bg-violet-50", iconColor: "text-violet-600" },
  { label: "Completed Bookings", value: "847", icon: CheckCircle2, change: "+5.3%", up: true, iconBg: "bg-teal-50", iconColor: "text-teal-600" },
  { label: "Active Rentals", value: "27", icon: KeyRound, change: "-2 from yesterday", up: false, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  { label: "Pending Bookings", value: "14", icon: Clock, change: "+4 today", up: false, iconBg: "bg-rose-50", iconColor: "text-rose-500" },
];

const statusColor: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rented: "bg-[#EEF4FF] text-[#346EF6] border-blue-200",
  Maintenance: "bg-amber-50 text-amber-700 border-amber-200",
  Pending: "bg-rose-50 text-rose-600 border-rose-200",
  "Under Review": "bg-violet-50 text-violet-700 border-violet-200",
};

const chartConfigBookings = { bookings: { label: "Bookings", color: "#346EF6" } };
const chartConfigRevenue = { revenue: { label: "Revenue", color: "#346EF6" } };

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [bookingStates, setBookingStates] = useState<Record<string, string>>({});

  const handleAction = (id: string, action: string) => {
    setBookingStates((prev) => ({ ...prev, [id]: action }));
  };

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay, ease: "easeOut" },
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 bg-[#F5F5F5] min-h-screen">

      {/* ================= PAGE HEADER ================= */}
      <motion.div {...fadeUp(0)}>
        <h1 className="text-2xl font-bold text-[#1A2340] tracking-tight">Dashboard</h1>
        <p className="text-sm text-[#8896A7] mt-0.5">Welcome back — here's what's happening today.</p>
      </motion.div>

      {/* ================= KPI SECTION ================= */}
      {/* TODO: Extract into reusable component: <KpiCard /> */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.07 } }, hidden: {} }}
      >
        {kpiData.map(({ label, value, icon: Icon, change, up, iconBg, iconColor }) => (
          <motion.div
            key={label}
            variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.06)] bg-white hover:shadow-[0_4px_20px_rgba(52,110,246,0.12)] hover:-translate-y-0.5 transition-all duration-200 cursor-default">
              <CardContent className="p-4">
                <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
                  <Icon size={17} className={iconColor} strokeWidth={2.2} />
                </div>
                <p className="text-[22px] font-bold text-[#1A2340] leading-none">{value}</p>
                <p className="text-[11px] text-[#8896A7] mt-1 font-medium">{label}</p>
                <div className={`flex items-center gap-1 mt-2 text-[10.5px] font-semibold ${up ? "text-emerald-600" : "text-rose-500"}`}>
                  {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {change}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* ================= CHARTS ROW ================= */}
      <motion.div {...fadeUp(0.15)} className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Monthly Bookings Line Chart */}
        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.06)] bg-white">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-[14px] font-bold text-[#1A2340]">Monthly Bookings</CardTitle>
            <CardDescription className="text-[12px] text-[#8896A7]">Booking volume trend — Jan to Dec 2025</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ChartContainer config={chartConfigBookings} className="h-[220px] w-full">
              <LineChart data={monthlyBookings} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone" dataKey="bookings" stroke="#346EF6" strokeWidth={2.5}
                  dot={{ r: 3, fill: "#346EF6", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#346EF6", strokeWidth: 0 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Revenue Bar Chart */}
        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.06)] bg-white">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-[14px] font-bold text-[#1A2340]">Revenue Overview</CardTitle>
            <CardDescription className="text-[12px] text-[#8896A7]">Monthly revenue in Philippine Peso — 2025</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ChartContainer config={chartConfigRevenue} className="h-[220px] w-full">
              <BarChart data={monthlyRevenue} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip content={<ChartTooltipContent />} formatter={(v: number) => [`₱${v.toLocaleString()}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="#346EF6" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* ================= FLEET STATUS + TOP VEHICLES ================= */}
      <motion.div {...fadeUp(0.22)} className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Fleet Status Donut */}
        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.06)] bg-white">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-[14px] font-bold text-[#1A2340]">Fleet Status</CardTitle>
            <CardDescription className="text-[12px] text-[#8896A7]">Current vehicle availability breakdown</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-5">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ChartContainer config={{}} className="h-[180px] w-[180px] flex-shrink-0">
                <PieChart>
                  <Pie data={fleetStatus} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value">
                    {fleetStatus.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <div className="flex flex-col gap-3 flex-1 w-full">
                {fleetStatus.map(({ name, value, color }) => (
                  <div key={name} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#F5F5F5]">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-[12.5px] font-medium text-[#4A5568]">{name}</span>
                    </div>
                    <span className="text-[13px] font-bold text-[#1A2340]">{value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#EEF4FF]">
                  <span className="text-[12.5px] font-semibold text-[#346EF6]">Total Fleet</span>
                  <span className="text-[13px] font-bold text-[#346EF6]">
                    {fleetStatus.reduce((a, b) => a + b.value, 0)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Vehicles */}
        {/* TODO: Extract into reusable component: <VehicleRow /> */}
        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.06)] bg-white">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-[14px] font-bold text-[#1A2340]">Top 3 Vehicles</CardTitle>
            <CardDescription className="text-[12px] text-[#8896A7]">Highest performing vehicles by bookings</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5">
              {topVehicles.map(({ id, name, bookings, revenue, status, img }) => (
                <div
                  key={id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F5F5F5] transition-colors duration-150 group cursor-default"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#F5F5F5] flex items-center justify-center text-xl flex-shrink-0">
                    {img}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-[#1A2340] truncate">{name}</p>
                    <p className="text-[11px] text-[#A0AABF]">{bookings} bookings · {revenue}</p>
                  </div>
                  <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-lg border ${statusColor[status]}`}>
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ================= PENDING BOOKINGS TABLE ================= */}
      <motion.div {...fadeUp(0.28)}>
        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.06)] bg-white">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-[14px] font-bold text-[#1A2340]">Pending Bookings</CardTitle>
            <CardDescription className="text-[12px] text-[#8896A7]">Bookings awaiting confirmation or review</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="border-b border-[#F0F2F7]">
                    {["Booking ID", "Customer", "Vehicle", "Pickup", "Return", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left text-[10.5px] font-semibold text-[#A0AABF] uppercase tracking-wider px-5 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingBookings.map((b) => {
                    const state = bookingStates[b.id];
                    return (
                      <tr key={b.id} className="border-b border-[#F8F9FC] hover:bg-[#F5F5F5] transition-colors duration-100">
                        <td className="px-5 py-3 text-[12px] font-mono font-semibold text-[#346EF6]">{b.id}</td>
                        <td className="px-5 py-3 text-[12.5px] font-medium text-[#1A2340]">{b.customer}</td>
                        <td className="px-5 py-3 text-[12px] text-[#4A5568]">{b.vehicle}</td>
                        <td className="px-5 py-3 text-[12px] text-[#4A5568]">{b.pickup}</td>
                        <td className="px-5 py-3 text-[12px] text-[#4A5568]">{b.return}</td>
                        <td className="px-5 py-3">
                          <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-lg border ${statusColor[state === "confirmed" ? "Available" : state === "rejected" ? "Pending" : b.status]}`}>
                            {state === "confirmed" ? "Confirmed" : state === "rejected" ? "Rejected" : b.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <button className="p-1.5 rounded-lg hover:bg-[#EEF4FF] text-[#8896A7] hover:text-[#346EF6] transition-colors duration-150" title="View">
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => handleAction(b.id, "confirmed")}
                              disabled={!!state}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 text-[#8896A7] hover:text-emerald-600 transition-colors duration-150 disabled:opacity-40"
                              title="Confirm"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={() => handleAction(b.id, "rejected")}
                              disabled={!!state}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-[#8896A7] hover:text-rose-500 transition-colors duration-150 disabled:opacity-40"
                              title="Reject"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ================= RECENT ACTIVITIES ================= */}
      <motion.div {...fadeUp(0.33)}>
        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.06)] bg-white">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-[14px] font-bold text-[#1A2340]">Recent Activities</CardTitle>
            <CardDescription className="text-[12px] text-[#8896A7]">Latest system events and updates</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[17px] top-2 bottom-2 w-px bg-[#EEF1F8]" />
              <div className="space-y-1">
                {activities.map(({ icon: Icon, label, time, color, bg }, i) => (
                  <div key={i} className="flex items-start gap-3.5 py-2.5 group">
                    <div className={`relative z-10 w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={15} className={color} strokeWidth={2.2} />
                    </div>
                    <div className="flex-1 min-w-0 pt-1.5">
                      <p className="text-[12.5px] font-medium text-[#1A2340] leading-snug">{label}</p>
                      <p className="text-[11px] text-[#A0AABF] mt-0.5">{time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

    </div>
  );
}