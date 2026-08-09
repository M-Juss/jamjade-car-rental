"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CalendarCheck,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  KeyRound,
  Loader2,
  PhilippinePeso,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { GENERIC_ERROR_MESSAGE } from "@/services/http";
import {
  getDashboard,
  type DashboardResponse,
} from "@/services/report";

const chartConfigBookings = { bookings: { label: "Bookings", color: "#346EF6" } };
const chartConfigRevenue = { revenue: { label: "Revenue", color: "#346EF6" } };

const statusColor: Record<string, string> = {
  Available: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Rented: "border-blue-200 bg-muted text-primary",
  Maintenance: "border-amber-200 bg-amber-50 text-amber-700",
  Unavailable: "border-slate-200 bg-slate-50 text-slate-600",
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  Approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const ACTIVITIES_PER_PAGE = 5;

function messageFromError() {
  return GENERIC_ERROR_MESSAGE;
}

function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(value);
}

function formatActivityDate(value?: string | null) {
  if (!value) return "Time unavailable";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function EmptyState({ message }: { message: string }) {
  return <div className="py-10 text-center text-[12px] text-muted-foreground">{message}</div>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [activityPage, setActivityPage] = useState(1);

  useEffect(() => {
    let active = true;

    getDashboard()
      .then((response) => {
        if (active) setData(response);
      })
      .catch(() => {
        if (active) setError(messageFromError());
      });

    return () => {
      active = false;
    };
  }, []);

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay, ease: "easeOut" as const },
  });

  if (!data && !error) {
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
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary } = data;
  const activityPageCount = Math.max(1, Math.ceil(data.recentActivities.length / ACTIVITIES_PER_PAGE));
  const paginatedActivities = data.recentActivities.slice(
    (activityPage - 1) * ACTIVITIES_PER_PAGE,
    activityPage * ACTIVITIES_PER_PAGE,
  );
  const kpis = [
    { label: "Total Revenue", value: formatCurrency(summary.totalRevenue, true), icon: PhilippinePeso, iconBg: "bg-muted", iconColor: "text-primary" },
    { label: "Total Vehicles", value: summary.totalVehicles.toLocaleString(), icon: Car, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
    { label: "Total Customers", value: summary.totalCustomers.toLocaleString(), icon: Users, iconBg: "bg-violet-50", iconColor: "text-violet-600" },
    { label: "Completed Bookings", value: summary.completedBookings.toLocaleString(), icon: CheckCircle2, iconBg: "bg-teal-50", iconColor: "text-teal-600" },
    { label: "Active Rentals", value: summary.activeRentals.toLocaleString(), icon: KeyRound, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
    { label: "Approved Bookings", value: summary.approvedBookings.toLocaleString(), icon: CalendarCheck, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  ];

  return (
    <div className="min-h-screen space-y-6 bg-background p-4 md:p-6 lg:p-8">
      <motion.div {...fadeUp(0)}>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Live booking, revenue, customer, and fleet activity.</p>
      </motion.div>

      <motion.div
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.07 } }, hidden: {} }}
      >
        {kpis.map(({ label, value, icon: Icon, iconBg, iconColor }) => (
          <motion.div
            key={label}
            variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.35, ease: "easeOut" as const }}
          >
            <Card className="h-full rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <CardContent className="p-4">
                <div className={`mb-3 flex size-9 items-center justify-center rounded-xl ${iconBg}`}>
                  <Icon size={17} className={iconColor} strokeWidth={2.2} />
                </div>
                <p className="text-[22px] font-bold leading-none text-foreground">{value}</p>
                <p className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div {...fadeUp(0.15)} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-[14px] font-bold text-foreground">Monthly Bookings</CardTitle>
            <CardDescription className="text-[12px] text-muted-foreground">Bookings created during the last 12 months</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ChartContainer config={chartConfigBookings} className="h-[220px] w-full">
              <LineChart data={data.monthlyBookings} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="bookings" stroke="#346EF6" strokeWidth={2.5} dot={{ r: 3, fill: "#346EF6", strokeWidth: 0 }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-[14px] font-bold text-foreground">Revenue Overview</CardTitle>
            <CardDescription className="text-[12px] text-muted-foreground">Received payments during the last 12 months</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ChartContainer config={chartConfigRevenue} className="h-[220px] w-full">
              <BarChart data={data.monthlyRevenue} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(Number(value), true)} />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value) => [formatCurrency(Number(value ?? 0)), "Revenue"]}
                />
                <Bar dataKey="revenue" fill="#346EF6" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div {...fadeUp(0.22)} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-[14px] font-bold text-foreground">Fleet Status</CardTitle>
            <CardDescription className="text-[12px] text-muted-foreground">Current vehicle availability breakdown</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-5">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <ChartContainer config={{}} className="h-[180px] w-[180px] shrink-0">
                <PieChart>
                  <Pie data={data.fleetStatus} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value">
                    {data.fleetStatus.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <div className="flex w-full flex-1 flex-col gap-2.5">
                {data.fleetStatus.map(({ name, value, color }) => (
                  <div key={name} className="flex items-center justify-between rounded-xl bg-background px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
                      <span className="text-[12.5px] font-medium text-muted-foreground">{name}</span>
                    </div>
                    <span className="text-[13px] font-bold text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-[14px] font-bold text-foreground">Top Vehicles</CardTitle>
            <CardDescription className="text-[12px] text-muted-foreground">Highest performing vehicles by booking count</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {data.topVehicles.length === 0 ? (
              <EmptyState message="No vehicle booking data is available yet." />
            ) : (
              <div className="space-y-1.5">
                {data.topVehicles.map(({ id, name, bookings, revenue, status }) => (
                  <div key={id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-background">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <Car size={17} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold text-foreground">{name}</p>
                      <p className="text-[11px] text-subtle-foreground">{bookings} bookings · {formatCurrency(revenue)}</p>
                    </div>
                    <Badge className={`border ${statusColor[status] ?? "border-slate-200 bg-slate-50 text-slate-600"}`}>
                      {status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div {...fadeUp(0.28)}>
        <Card className="overflow-hidden rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-[14px] font-bold text-foreground">Approved Bookings</CardTitle>
            <CardDescription className="text-[12px] text-muted-foreground">Latest approved bookings</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {data.approvedBookings.length === 0 ? (
              <EmptyState message="There are no approved bookings." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px]">
                  <thead>
                    <tr className="border-b border-border">
                      {["Booking ID", "Customer", "Vehicle", "Pickup", "Return", "Status"].map((heading) => (
                        <th key={heading} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-wider text-subtle-foreground">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.approvedBookings.map((booking) => (
                      <tr key={booking.internalId} className="border-b border-background hover:bg-background">
                        <td className="px-5 py-3 font-mono text-[12px] font-semibold text-primary">{booking.bookingId}</td>
                        <td className="px-5 py-3 text-[12.5px] font-medium text-foreground">{booking.customer}</td>
                        <td className="px-5 py-3 text-[12px] text-muted-foreground">{booking.vehicle}</td>
                        <td className="px-5 py-3 text-[12px] text-muted-foreground">{booking.rentalDate ?? "N/A"}</td>
                        <td className="px-5 py-3 text-[12px] text-muted-foreground">{booking.returnDate ?? "N/A"}</td>
                        <td className="px-5 py-3">
                          <Badge className={`border ${statusColor.Approved}`}>Approved</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div {...fadeUp(0.33)}>
        <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-[14px] font-bold text-foreground">Recent Activities</CardTitle>
            <CardDescription className="text-[12px] text-muted-foreground">Latest booking and payment updates</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {data.recentActivities.length === 0 ? (
              <EmptyState message="No recent activity is available." />
            ) : (
              <div className="space-y-1">
                {paginatedActivities.map((activity, index) => {
                  const Icon = activity.type === "payment" ? CreditCard : CalendarCheck;
                  const color = activity.type === "payment" ? "text-violet-600" : "text-primary";
                  const background = activity.type === "payment" ? "bg-violet-50" : "bg-muted";

                  return (
                    <div key={`${activity.occurredAt}-${(activityPage - 1) * ACTIVITIES_PER_PAGE + index}`} className="flex items-start gap-3.5 py-2.5">
                      <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${background}`}>
                        <Icon size={15} className={color} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="text-[12.5px] font-medium leading-snug text-foreground">{activity.label}</p>
                        <p className="mt-0.5 text-[11px] text-subtle-foreground">{formatActivityDate(activity.occurredAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {data.recentActivities.length > ACTIVITIES_PER_PAGE ? (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-4">
                <p className="text-[11.5px] text-subtle-foreground">
                  Showing {(activityPage - 1) * ACTIVITIES_PER_PAGE + 1}–
                  {Math.min(activityPage * ACTIVITIES_PER_PAGE, data.recentActivities.length)} of {data.recentActivities.length}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Previous activity page"
                    onClick={() => setActivityPage((page) => Math.max(1, page - 1))}
                    disabled={activityPage === 1}
                    className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span className="min-w-16 text-center text-[11.5px] font-medium text-muted-foreground">
                    Page {activityPage} of {activityPageCount}
                  </span>
                  <button
                    type="button"
                    aria-label="Next activity page"
                    onClick={() => setActivityPage((page) => Math.min(activityPageCount, page + 1))}
                    disabled={activityPage === activityPageCount}
                    className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
