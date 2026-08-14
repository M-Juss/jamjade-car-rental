"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Car,
  CheckCircle2,
  Clock3,
  Download,
  Loader2,
  PhilippinePeso,
  Search,
  XCircle,
} from "lucide-react";
import { appToast } from "@/lib/toast";
import {
  Area,
  AreaChart,
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
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/common/KpiCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GENERIC_ERROR_MESSAGE } from "@/services/http";
import {
  downloadReport,
  getReports,
  type ReportRange,
  type ReportsResponse,
} from "@/services/report";

const chartConfig = {
  revenue: { label: "Revenue", color: "#346EF6" },
  bookings: { label: "Bookings", color: "#93C5FD" },
  completed: { label: "Completed", color: "#346EF6" },
  new: { label: "New", color: "#346EF6" },
  returning: { label: "Returning", color: "#10B981" },
  count: { label: "Events", color: "#F59E0B" },
  value: { label: "Revenue", color: "#346EF6" },
};

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

function statusBadge(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "completed" || normalized === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "ongoing" || normalized === "confirmed") return "border-blue-200 bg-muted text-primary";
  if (normalized.includes("partial") || normalized === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "cancelled" || normalized === "rejected" || normalized === "refunded") return "border-rose-200 bg-rose-50 text-rose-600";

  return "border-border bg-background text-muted-foreground";
}

function maintenanceBadge(status: string) {
  if (status === "Good") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Due") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-600";
}

function severityBadge(severity: string) {
  const normalized = severity.toLowerCase();

  if (normalized === "low") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-600";
}

function EmptyState({ message }: { message: string }) {
  return <div className="py-10 text-center text-[12px] text-muted-foreground">{message}</div>;
}

export function ReportsAnalytics() {
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [range, setRange] = useState<ReportRange>("12_months");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getReports(range));
    } catch {
      setError(messageFromError());
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    let active = true;

    getReports(range)
      .then((response) => {
        if (active) setData(response);
      })
      .catch(() => {
        if (active) setError(messageFromError());
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [range]);

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay },
  });

  const query = search.trim().toLowerCase();
  const filteredRevenueRows = useMemo(
    () => (data?.revenueTransactions ?? []).filter((row) =>
      `${row.bookingId} ${row.customer} ${row.vehicle} ${row.paymentMethod}`.toLowerCase().includes(query)
    ),
    [data, query],
  );
  const filteredBookingRows = useMemo(
    () => (data?.bookings ?? []).filter((row) =>
      `${row.bookingId} ${row.customer} ${row.vehicle} ${row.status}`.toLowerCase().includes(query)
    ),
    [data, query],
  );
  const filteredFleetRows = useMemo(
    () => (data?.fleet ?? []).filter((row) =>
      `${row.vehicle} ${row.model ?? ""} ${row.maintenanceStatus}`.toLowerCase().includes(query)
    ),
    [data, query],
  );
  const filteredCustomerRows = useMemo(
    () => (data?.customers ?? []).filter((row) =>
      `${row.name} ${row.email}`.toLowerCase().includes(query)
    ),
    [data, query],
  );
  const filteredRiskRows = useMemo(
    () => (data?.riskEvents ?? []).filter((row) =>
      `${row.eventId} ${row.bookingId} ${row.customer} ${row.vehicle} ${row.eventType}`.toLowerCase().includes(query)
    ),
    [data, query],
  );

  const handleDownload = async (format: "pdf" | "excel") => {
    setDownloading(format);

    try {
      await downloadReport(format, range);
    } catch {
      appToast.error(
        `The ${format === "pdf" ? "PDF" : "Excel"} report could not be downloaded. Please try again.`,
      );
    } finally {
      setDownloading(null);
    }
  };

  if (!data && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Loading reports and analytics
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="max-w-md rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-500" />
              <div>
                <p className="font-semibold text-foreground">Reports could not be loaded</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
            <Button
              onClick={() => {
                setIsLoading(true);
                setError("");
                void load();
              }}
              className="mt-4 w-full rounded-xl"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const kpis = [
    { label: "Total Revenue", value: formatCurrency(data.summary.totalRevenue, true), icon: PhilippinePeso, bg: "bg-muted", color: "text-primary" },
    { label: "Total Bookings", value: data.summary.totalBookings.toLocaleString(), icon: BookOpen, bg: "bg-emerald-50", color: "text-emerald-600" },
    { label: "Completed Rentals", value: data.summary.completedBookings.toLocaleString(), icon: CheckCircle2, bg: "bg-slate-50", color: "text-slate-600" },
    { label: "Active Rentals", value: data.summary.activeRentals.toLocaleString(), icon: Car, bg: "bg-blue-50", color: "text-blue-600" },
    { label: "Cancelled Bookings", value: data.summary.cancelledBookings.toLocaleString(), icon: XCircle, bg: "bg-rose-50", color: "text-rose-500" },
    { label: "Average Duration", value: `${data.summary.averageBookingDuration} days`, icon: Clock3, bg: "bg-violet-50", color: "text-violet-600" },
  ];
  const revenueBreakdownIcons = [PhilippinePeso, Car, BarChart3, AlertCircle];
  const fleetHighlightIcons = [BarChart3, Clock3, AlertCircle, Car];

  return (
    <div className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
      <motion.div {...fadeUp(0)} className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Live revenue, booking, fleet, customer, and telematics reporting.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={range}
            onValueChange={(value) => {
              setIsLoading(true);
              setError("");
              setRange(value as ReportRange);
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-xl border-border bg-white text-[13px] sm:w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6_months">Last 6 months</SelectItem>
              <SelectItem value="12_months">Last 12 months</SelectItem>
              <SelectItem value="this_year">This year</SelectItem>
              <SelectItem value="all_time">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={downloading !== null}
            onClick={() => void handleDownload("excel")}
            className="h-10 rounded-xl border-border text-[13px] text-muted-foreground"
          >
            {downloading === "excel" ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Download size={14} className="mr-2" />}
            Export CSV
          </Button>
          <Button
            variant="outline"
            disabled={downloading !== null}
            onClick={() => void handleDownload("pdf")}
            className="h-10 rounded-xl border-border text-[13px] text-muted-foreground"
          >
            {downloading === "pdf" ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Download size={14} className="mr-2" />}
            Export PDF
          </Button>
        </div>
      </motion.div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <motion.div {...fadeUp(0.08)} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-3">
        {kpis.map(({ label, value, icon, bg, color }) => (
          <KpiCard
            key={label}
            label={label}
            value={value}
            icon={icon}
            iconClassName={`${bg} ${color}`}
          />
        ))}
      </motion.div>

      <div className="relative">
        <Search size={13} className="absolute top-1/2 left-3 -translate-y-1/2 text-subtle-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search report records..."
          className="h-10 rounded-xl border-border bg-white pl-9 text-[12.5px]"
        />
        {isLoading && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-primary" />}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <motion.div {...fadeUp(0.12)}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl border border-border bg-white/60 p-1">
            <TabsTrigger value="overview" className="text-[12px]">Overview</TabsTrigger>
            <TabsTrigger value="revenue" className="text-[12px]">Revenue</TabsTrigger>
            <TabsTrigger value="bookings" className="text-[12px]">Bookings</TabsTrigger>
            <TabsTrigger value="fleet" className="text-[12px]">Fleet Performance</TabsTrigger>
            <TabsTrigger value="customers" className="text-[12px]">Customer Insights</TabsTrigger>
            <TabsTrigger value="risk" className="text-[12px]">Risk & Telematics</TabsTrigger>
          </TabsList>
        </motion.div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-[14px]">Revenue Trend</CardTitle>
                <CardDescription className="text-[12px]">Received payment performance by month</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <LineChart data={data.revenueTrend} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(Number(value), true)} />
                    <ChartTooltip content={<ChartTooltipContent />} formatter={(value) => [formatCurrency(Number(value ?? 0)), "Revenue"]} />
                    <Line type="monotone" dataKey="revenue" stroke="#346EF6" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-[14px]">Booking Status Distribution</CardTitle>
                <CardDescription className="text-[12px]">Booking status mix for the selected period</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col items-center gap-4 md:flex-row">
                  <ChartContainer config={chartConfig} className="h-[220px] w-[220px] shrink-0">
                    <PieChart>
                      <Pie data={data.bookingStatusDistribution} dataKey="value" innerRadius={58} outerRadius={86} paddingAngle={2}>
                        {data.bookingStatusDistribution.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                  <div className="w-full flex-1 space-y-2">
                    {data.bookingStatusDistribution.map((item) => (
                      <div key={item.name} className="flex items-center justify-between rounded-xl bg-background px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-[12px] text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="text-[12px] font-semibold text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)] xl:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-[14px]">Monthly Booking Performance</CardTitle>
                <CardDescription className="text-[12px]">Bookings created versus completed rentals</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <BarChart data={data.bookingPerformance} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="bookings" fill="#93C5FD" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="completed" fill="#346EF6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-[14px]">Recent Highlights</CardTitle>
                <CardDescription className="text-[12px]">Insights calculated from current records</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {data.highlights.map((item) => (
                  <div key={item} className="flex items-start gap-2 rounded-xl bg-background px-3 py-2.5">
                    <BarChart3 size={13} className="mt-0.5 shrink-0 text-primary" />
                    <p className="text-[12px] text-muted-foreground">{item}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Revenue by Month</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <AreaChart data={data.revenueTrend} margin={{ left: -16, right: 8 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#346EF6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#346EF6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(Number(value), true)} />
                    <ChartTooltip content={<ChartTooltipContent />} formatter={(value) => [formatCurrency(Number(value ?? 0)), "Revenue"]} />
                    <Area type="monotone" dataKey="revenue" stroke="#346EF6" fill="url(#revenueFill)" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Revenue by Rental Type</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <BarChart data={data.revenueByRentalType} margin={{ left: -6, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" vertical={false} />
                    <XAxis dataKey="type" tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(Number(value), true)} />
                    <ChartTooltip content={<ChartTooltipContent />} formatter={(value) => [formatCurrency(Number(value ?? 0)), "Revenue"]} />
                    <Bar dataKey="value" fill="#346EF6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {data.revenueBreakdown.map((item, index) => {
              const Icon = revenueBreakdownIcons[index] ?? PhilippinePeso;

              return (
                <KpiCard
                  key={item.label}
                  label={item.label}
                  value={formatCurrency(item.value, true)}
                  icon={Icon}
                  iconClassName="bg-muted text-primary"
                />
              );
            })}
          </div>

          <Card className="overflow-hidden rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <CardHeader className="pb-2"><CardTitle className="text-[14px]">Revenue Transactions</CardTitle></CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-background">
                      {["Booking ID", "Customer", "Vehicle", "Rental Type", "Payment Method", "Amount", "Paid Date", "Status"].map((heading) => (
                        <TableHead key={heading} className="px-4 py-3 text-[10.5px]">{heading}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRevenueRows.length === 0 ? (
                      <TableRow><TableCell colSpan={8}><EmptyState message="No revenue transactions found." /></TableCell></TableRow>
                    ) : filteredRevenueRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="px-4 py-3 font-mono text-[12px] text-primary">{row.bookingId}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] font-medium text-foreground">{row.customer}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.vehicle}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.rentalType}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.paymentMethod}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] font-semibold text-foreground">{formatCurrency(row.amount)}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.paidDate ?? "N/A"}</TableCell>
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
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)] xl:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Booking Volume</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <LineChart data={data.bookingPerformance} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line dataKey="bookings" stroke="#346EF6" strokeWidth={2.2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Cancellation Analytics</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                <div className="rounded-xl bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">Cancellation & Rejection Rate</p>
                  <p className="text-[18px] font-bold text-rose-500">{data.cancellation.rate}%</p>
                </div>
                <div className="rounded-xl bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">Cancelled</p>
                  <p className="text-[18px] font-bold text-foreground">{data.cancellation.cancelled}</p>
                </div>
                <div className="rounded-xl bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">Rejected</p>
                  <p className="text-[18px] font-bold text-foreground">{data.cancellation.rejected}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <CardHeader className="pb-2"><CardTitle className="text-[14px]">Booking Records</CardTitle></CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-background">
                      {["Booking ID", "Customer", "Vehicle", "Rental Date", "Return Date", "Total Cost", "Status"].map((heading) => (
                        <TableHead key={heading} className="px-4 py-3 text-[10.5px]">{heading}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookingRows.length === 0 ? (
                      <TableRow><TableCell colSpan={7}><EmptyState message="No booking records found." /></TableCell></TableRow>
                    ) : filteredBookingRows.map((row) => (
                      <TableRow key={row.internalId}>
                        <TableCell className="px-4 py-3 font-mono text-[12px] text-primary">{row.bookingId}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] font-medium text-foreground">{row.customer}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.vehicle}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.rentalDate ?? "N/A"}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.returnDate ?? "N/A"}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] font-semibold text-foreground">{formatCurrency(row.totalCost)}</TableCell>
                        <TableCell className="px-4 py-3"><Badge className={`border ${statusBadge(row.status)}`}>{row.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fleet" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {data.fleetHighlights.map((item, index) => {
              const Icon = fleetHighlightIcons[index] ?? Car;

              return (
                <KpiCard
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  description={item.sub}
                  icon={Icon}
                  iconClassName="bg-muted text-primary"
                />
              );
            })}
          </div>

          <Card className="overflow-hidden rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <CardHeader className="pb-2"><CardTitle className="text-[14px]">Fleet Performance Table</CardTitle></CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-background">
                      {["Vehicle", "Model", "Total Bookings", "Received Revenue", "Utilization", "Maintenance", "Incidents"].map((heading) => (
                        <TableHead key={heading} className="px-4 py-3 text-[10.5px]">{heading}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFleetRows.length === 0 ? (
                      <TableRow><TableCell colSpan={7}><EmptyState message="No fleet records found." /></TableCell></TableRow>
                    ) : filteredFleetRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="px-4 py-3 text-[12px] font-medium text-foreground">{row.vehicle}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.model ?? "N/A"}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.totalBookings}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] font-semibold text-foreground">{formatCurrency(row.revenue)}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.utilization}%</TableCell>
                        <TableCell className="px-4 py-3"><Badge className={`border ${maintenanceBadge(row.maintenanceStatus)}`}>{row.maintenanceStatus}</Badge></TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.incidents}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">New vs Returning Customers</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <AreaChart data={data.newVsReturning} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="new" stroke="#346EF6" fill="#DBEAFE" fillOpacity={0.8} />
                    <Area type="monotone" dataKey="returning" stroke="#10B981" fill="#D1FAE5" fillOpacity={0.65} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Customers with Cancellations</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.customerCancellationLeaders.length === 0 ? (
                  <EmptyState message="No customer cancellations in this period." />
                ) : data.customerCancellationLeaders.map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between rounded-xl bg-background px-3 py-2.5">
                    <div>
                      <p className="text-[12px] font-medium text-foreground">{customer.name}</p>
                      <p className="text-[11px] text-muted-foreground">{customer.email}</p>
                    </div>
                    <Badge className="border border-rose-200 bg-rose-50 text-rose-600">
                      {customer.cancelledBookings}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <CardHeader className="pb-2"><CardTitle className="text-[14px]">Customer Insights Table</CardTitle></CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-background">
                      {["Customer", "Email", "Total Bookings", "Completed", "Cancelled / Rejected", "Total Spent", "Last Booking"].map((heading) => (
                        <TableHead key={heading} className="px-4 py-3 text-[10.5px]">{heading}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomerRows.length === 0 ? (
                      <TableRow><TableCell colSpan={7}><EmptyState message="No customer records found." /></TableCell></TableRow>
                    ) : filteredCustomerRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="px-4 py-3 text-[12px] font-medium text-foreground">{row.name}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.email}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.totalBookings}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-emerald-700">{row.completedBookings}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-rose-600">{row.cancelledBookings}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] font-semibold text-foreground">{formatCurrency(row.totalSpent)}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.lastBookingDate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Risk Event Analytics</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {data.riskEventCounts.length === 0 ? (
                  <EmptyState message="No telematics risk events in this period." />
                ) : (
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <BarChart data={data.riskEventCounts} margin={{ left: -10, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" vertical={false} />
                      <XAxis dataKey="type" tick={{ fontSize: 10, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Risk Summary</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.riskSummary.length === 0 ? (
                  <EmptyState message="No risk summary is available." />
                ) : data.riskSummary.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl bg-background px-3 py-2.5">
                    <div>
                      <p className="text-[12px] text-muted-foreground">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">{item.count} events</p>
                    </div>
                    <Badge className={`border ${severityBadge(item.severity)}`}>{item.severity}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
            <CardHeader className="pb-2"><CardTitle className="text-[14px]">Risk & Telematics Events</CardTitle></CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-background">
                      {["Event ID", "Booking ID", "Vehicle", "Customer", "Event Type", "Location", "Time Stamp", "Severity"].map((heading) => (
                        <TableHead key={heading} className="px-4 py-3 text-[10.5px]">{heading}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRiskRows.length === 0 ? (
                      <TableRow><TableCell colSpan={8}><EmptyState message="No risk events found." /></TableCell></TableRow>
                    ) : filteredRiskRows.map((row) => (
                      <TableRow key={row.eventId}>
                        <TableCell className="px-4 py-3 font-mono text-[12px] text-primary">{row.eventId}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.bookingId}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.vehicle}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.customer}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-foreground">{row.eventType}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.location}</TableCell>
                        <TableCell className="px-4 py-3 text-[12px] text-muted-foreground">{row.timestamp ?? "N/A"}</TableCell>
                        <TableCell className="px-4 py-3"><Badge className={`border ${severityBadge(row.severity)}`}>{row.severity}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ReportsAnalytics;
