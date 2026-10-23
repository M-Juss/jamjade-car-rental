"use client";

import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";

import { ManagementTable as Table, ManagementTableCell as TableCell, TableCard } from "@/components/common/tables/ManagementTable";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { useTablePagination } from "@/components/common/tables/useTablePagination";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Car,
  CheckCircle2,
  Clock3,
  Loader2,
  PhilippinePeso,
} from "lucide-react";
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
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GENERIC_ERROR_MESSAGE } from "@/services/http";
import { formatPhilippinePeso } from "@/lib/formatters/currency";
import {
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
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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

  const revenuePagination = useTablePagination(data?.revenueTransactions ?? [], range);
  const bookingPagination = useTablePagination(data?.bookings ?? [], range);
  const fleetPagination = useTablePagination(data?.fleet ?? [], range);
  const customerPagination = useTablePagination(data?.customers ?? [], range);
  const riskPagination = useTablePagination(data?.riskEvents ?? [], range);

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
    { label: "Gross Receipts", value: formatPhilippinePeso(data.summary.totalRevenue, true), icon: PhilippinePeso, bg: "bg-muted", color: "text-primary" },
    { label: "Refunds Returned", value: formatPhilippinePeso(data.refundSummary.amountReturned, true), icon: PhilippinePeso, bg: "bg-muted", color: "text-primary" },
    { label: "Net Receipts", value: formatPhilippinePeso(data.refundSummary.netReceipts, true), icon: PhilippinePeso, bg: "bg-muted", color: "text-primary" },
    { label: "Total Bookings", value: data.summary.totalBookings.toLocaleString(), icon: BookOpen, bg: "bg-emerald-50", color: "text-emerald-600" },
    { label: "Completed Rentals", value: data.summary.completedBookings.toLocaleString(), icon: CheckCircle2, bg: "bg-slate-50", color: "text-slate-600" },
    { label: "Active Rentals", value: data.summary.activeRentals.toLocaleString(), icon: Car, bg: "bg-blue-50", color: "text-blue-600" },
  ];
  const revenueBreakdown = data.revenueBreakdown
    .filter((item) => item.label !== "Delivery Tolls")
    .map((item) => item.label === "Delivery Fees" ? {
      label: "Delivery Charges",
      value: item.value + (data.revenueBreakdown.find((row) => row.label === "Delivery Tolls")?.value ?? 0),
    } : item)
    .slice(0, 4);
  const revenueBreakdownIcons = [PhilippinePeso, Car, BarChart3, AlertCircle];
  const fleetHighlightIcons = [BarChart3, Clock3, AlertCircle, Car];

  return (
    <div className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <ManagementPageHeading title="Reports & Analytics" description="Review revenue, bookings, and fleet performance." />
        <div className="flex flex-col gap-2 sm:flex-row">
          {isLoading ? <span role="status" className="flex items-center text-primary"><Loader2 className="size-4 animate-spin" /><span className="sr-only">Updating reports</span></span> : null}
          <FilterSelect
            value={range}
            onValueChange={(value: ReportRange) => {
              setIsLoading(true);
              setError("");
              setRange(value);
            }}
            ariaLabel="Select report period"
            height="large"
            className="bg-white text-[13px] sm:w-[170px]"
            options={[
              { value: "6_months", label: "Last 6 months" },
              { value: "12_months", label: "Last 12 months" },
              { value: "this_year", label: "This year" },
              { value: "all_time", label: "All time" },
            ]}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-3">
        {kpis.map(({ label, value, icon, bg, color }) => (
          <KpiCard
            key={label}
            label={label}
            value={value}
            icon={icon}
            iconClassName={`${bg} ${color}`}
          />
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <div>
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl border border-border bg-white/60 p-1">
            <TabsTrigger value="overview" className="text-[12px]">Overview</TabsTrigger>
            <TabsTrigger value="revenue" className="text-[12px]">Revenue</TabsTrigger>
            <TabsTrigger value="bookings" className="text-[12px]">Bookings</TabsTrigger>
            <TabsTrigger value="fleet" className="text-[12px]">Fleet Performance</TabsTrigger>
            <TabsTrigger value="customers" className="text-[12px]">Customer Insights</TabsTrigger>
            <TabsTrigger value="risk" className="text-[12px]">Risk & Telematics</TabsTrigger>
          </TabsList>
        </div>

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
                    <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} tickFormatter={(value) => formatPhilippinePeso(Number(value), true)} />
                    <ChartTooltip content={<ChartTooltipContent />} formatter={(value) => [formatPhilippinePeso(Number(value ?? 0)), "Revenue"]} />
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F7" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#A0AABF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} tickFormatter={(value) => formatPhilippinePeso(Number(value), true)} />
                    <ChartTooltip content={<ChartTooltipContent />} formatter={(value) => [formatPhilippinePeso(Number(value ?? 0)), "Revenue"]} />
                    <Area type="monotone" dataKey="revenue" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.12} strokeWidth={2} />
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
                    <YAxis tick={{ fontSize: 11, fill: "#A0AABF" }} axisLine={false} tickLine={false} tickFormatter={(value) => formatPhilippinePeso(Number(value), true)} />
                    <ChartTooltip content={<ChartTooltipContent />} formatter={(value) => [formatPhilippinePeso(Number(value ?? 0)), "Revenue"]} />
                    <Bar dataKey="value" fill="#346EF6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {revenueBreakdown.map((item, index) => {
              const Icon = revenueBreakdownIcons[index] ?? PhilippinePeso;

              return (
                <KpiCard
                  key={item.label}
                  label={item.label}
                  value={formatPhilippinePeso(item.value, true)}
                  icon={Icon}
                  iconClassName="bg-muted text-primary"
                />
              );
            })}
          </div>

          <div>
            <TableCard>
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Revenue Transactions</CardTitle></CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="min-w-0">
                  <Table>
                    <colgroup>
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "17%" }} />
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "12%" }} />
                      <col />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="bg-background">
                        {["Booking ID", "Customer", "Vehicle", "Rental Type", "Payment Method", "Amount", "Paid Date", "Status"].map((heading) => (
                          <TableHead key={heading} className="px-4 py-3 text-[10.5px]">{heading}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenuePagination.total === 0 ? (
                        <TableRow><TableCell colSpan={8}><EmptyState message="No revenue transactions found." /></TableCell></TableRow>
                      ) : revenuePagination.rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell data-label="Booking ID" className="px-4 py-3 font-mono text-[12px] text-primary">{row.bookingId}</TableCell>
                          <TableCell data-label="Customer" className="px-4 py-3 text-[12px] font-medium text-foreground">{row.customer}</TableCell>
                          <TableCell data-label="Vehicle" className="px-4 py-3 text-[12px] text-muted-foreground">{row.vehicle}</TableCell>
                          <TableCell data-label="Rental Type" className="px-4 py-3 text-[12px] text-muted-foreground">{row.rentalType}</TableCell>
                          <TableCell data-label="Payment Method" className="px-4 py-3 text-[12px] text-muted-foreground">{row.paymentMethod}</TableCell>
                          <TableCell data-label="Amount" className="px-4 py-3 text-[12px] font-semibold text-foreground">{formatPhilippinePeso(row.amount)}</TableCell>
                          <TableCell data-label="Paid Date" className="px-4 py-3 text-[12px] text-muted-foreground">{row.paidDate ?? "N/A"}</TableCell>
                          <TableCell data-label="Status" className="px-4 py-3"><Badge className={`border ${statusBadge(row.status)}`}>{row.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </TableCard>
            <TablePagination {...revenuePagination} label="Revenue report pagination" disabled={isLoading} />
          </div>
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

          <div>
            <TableCard>
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Booking Records</CardTitle></CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="min-w-0">
                  <Table>
                    <colgroup>
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "13%" }} />
                      <col style={{ width: "13%" }} />
                      <col />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "10%" }} />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="bg-background">
                        {["Booking ID", "Customer", "Vehicle", "Rental Date", "Return Date", "Monitoring Zones", "Total Cost", "Status"].map((heading) => (
                          <TableHead key={heading} className="px-4 py-3 text-[10.5px]">{heading}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookingPagination.total === 0 ? (
                        <TableRow><TableCell colSpan={8}><EmptyState message="No booking records found." /></TableCell></TableRow>
                      ) : bookingPagination.rows.map((row) => (
                        <TableRow key={row.internalId}>
                          <TableCell data-label="Booking ID" className="px-4 py-3 font-mono text-[12px] text-primary">{row.bookingId}</TableCell>
                          <TableCell data-label="Customer" className="px-4 py-3 text-[12px] font-medium text-foreground">{row.customer}</TableCell>
                          <TableCell data-label="Vehicle" className="px-4 py-3 text-[12px] text-muted-foreground">{row.vehicle}</TableCell>
                          <TableCell data-label="Rental Date" className="px-4 py-3 text-[12px] text-muted-foreground">{row.rentalDate ?? "N/A"}</TableCell>
                          <TableCell data-label="Return Date" className="px-4 py-3 text-[12px] text-muted-foreground">{row.returnDate ?? "N/A"}</TableCell>
                          <TableCell data-label="Monitoring Zones" className="px-4 py-3 text-[12px] text-muted-foreground">{row.monitoringZones?.length ? row.monitoringZones.map((zone, index) => <span key={index} className="block font-medium text-foreground">{zone.name}</span>) : "—"}</TableCell>
                          <TableCell data-label="Total Cost" className="px-4 py-3 text-[12px] font-semibold text-foreground">{formatPhilippinePeso(row.totalCost)}</TableCell>
                          <TableCell data-label="Status" className="px-4 py-3"><Badge className={`border ${statusBadge(row.status)}`}>{row.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </TableCard>
            <TablePagination {...bookingPagination} label="Booking report pagination" disabled={isLoading} />
          </div>
        </TabsContent>

        <TabsContent value="fleet" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {data.fleetHighlights.slice(0, 4).map((item, index) => {
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

          <div>
            <TableCard>
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Fleet Performance Table</CardTitle></CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="min-w-0">
                  <Table>
                    <colgroup>
                      <col style={{ width: "22%" }} />
                      <col />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "10%" }} />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="bg-background">
                        {["Vehicle", "Model", "Total Bookings", "Received Revenue", "Utilization", "Maintenance", "Incidents"].map((heading) => (
                          <TableHead key={heading} className="px-4 py-3 text-[10.5px]">{heading}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fleetPagination.total === 0 ? (
                        <TableRow><TableCell colSpan={7}><EmptyState message="No fleet records found." /></TableCell></TableRow>
                      ) : fleetPagination.rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell data-label="Vehicle" className="px-4 py-3 text-[12px] font-medium text-foreground">{row.vehicle}</TableCell>
                          <TableCell data-label="Model" className="px-4 py-3 text-[12px] text-muted-foreground">{row.model ?? "N/A"}</TableCell>
                          <TableCell data-label="Total Bookings" className="px-4 py-3 text-[12px] text-muted-foreground">{row.totalBookings}</TableCell>
                          <TableCell data-label="Received Revenue" className="px-4 py-3 text-[12px] font-semibold text-foreground">{formatPhilippinePeso(row.revenue)}</TableCell>
                          <TableCell data-label="Utilization" className="px-4 py-3 text-[12px] text-muted-foreground">{row.utilization}%</TableCell>
                          <TableCell data-label="Maintenance" className="px-4 py-3"><Badge className={`border ${maintenanceBadge(row.maintenanceStatus)}`}>{row.maintenanceStatus}</Badge></TableCell>
                          <TableCell data-label="Incidents" className="px-4 py-3 text-[12px] text-muted-foreground">{row.incidents}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </TableCard>
            <TablePagination {...fleetPagination} label="Fleet report pagination" disabled={isLoading} />
          </div>
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

          <div>
            <TableCard>
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Customer Insights Table</CardTitle></CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="min-w-0">
                  <Table>
                    <colgroup>
                      <col style={{ width: "18%" }} />
                      <col />
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "13%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "13%" }} />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="bg-background">
                        {["Customer", "Email", "Total Bookings", "Completed", "Cancelled / Rejected", "Total Spent", "Last Booking"].map((heading) => (
                          <TableHead key={heading} className="px-4 py-3 text-[10.5px]">{heading}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerPagination.total === 0 ? (
                        <TableRow><TableCell colSpan={7}><EmptyState message="No customer records found." /></TableCell></TableRow>
                      ) : customerPagination.rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell data-label="Customer" className="px-4 py-3 text-[12px] font-medium text-foreground">{row.name}</TableCell>
                          <TableCell data-label="Email" className="px-4 py-3 text-[12px] text-muted-foreground">{row.email}</TableCell>
                          <TableCell data-label="Total Bookings" className="px-4 py-3 text-[12px] text-muted-foreground">{row.totalBookings}</TableCell>
                          <TableCell data-label="Completed" className="px-4 py-3 text-[12px] text-emerald-700">{row.completedBookings}</TableCell>
                          <TableCell data-label="Cancelled / Rejected" className="px-4 py-3 text-[12px] text-rose-600">{row.cancelledBookings}</TableCell>
                          <TableCell data-label="Total Spent" className="px-4 py-3 text-[12px] font-semibold text-foreground">{formatPhilippinePeso(row.totalSpent)}</TableCell>
                          <TableCell data-label="Last Booking" className="px-4 py-3 text-[12px] text-muted-foreground">{row.lastBookingDate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </TableCard>
            <TablePagination {...customerPagination} label="Customer report pagination" disabled={isLoading} />
          </div>
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

          <div>
            <TableCard>
              <CardHeader className="pb-2"><CardTitle className="text-[14px]">Risk & Telematics Events</CardTitle></CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="min-w-0">
                  <Table>
                    <colgroup>
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "13%" }} />
                      <col />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "10%" }} />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="bg-background">
                        {["Event ID", "Booking ID", "Vehicle", "Customer", "Event Type", "Location", "Time Stamp", "Severity"].map((heading) => (
                          <TableHead key={heading} className="px-4 py-3 text-[10.5px]">{heading}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {riskPagination.total === 0 ? (
                        <TableRow><TableCell colSpan={8}><EmptyState message="No risk events found." /></TableCell></TableRow>
                      ) : riskPagination.rows.map((row) => (
                        <TableRow key={row.eventId}>
                          <TableCell data-label="Event ID" className="px-4 py-3 font-mono text-[12px] text-primary">{row.eventId}</TableCell>
                          <TableCell data-label="Booking ID" className="px-4 py-3 text-[12px] text-muted-foreground">{row.bookingId}</TableCell>
                          <TableCell data-label="Vehicle" className="px-4 py-3 text-[12px] text-muted-foreground">{row.vehicle}</TableCell>
                          <TableCell data-label="Customer" className="px-4 py-3 text-[12px] text-muted-foreground">{row.customer}</TableCell>
                          <TableCell data-label="Event Type" className="px-4 py-3 text-[12px] text-foreground">{row.eventType}</TableCell>
                          <TableCell data-label="Location" className="px-4 py-3 text-[12px] text-muted-foreground">{row.location}</TableCell>
                          <TableCell data-label="Time Stamp" className="px-4 py-3 text-[12px] text-muted-foreground">{row.timestamp ?? "N/A"}</TableCell>
                          <TableCell data-label="Severity" className="px-4 py-3"><Badge className={`border ${severityBadge(row.severity)}`}>{row.severity}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </TableCard>
            <TablePagination {...riskPagination} label="Risk report pagination" disabled={isLoading} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ReportsAnalytics;
