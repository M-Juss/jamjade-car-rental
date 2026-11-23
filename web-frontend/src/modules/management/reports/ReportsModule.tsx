"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight, Clock3, Download, Loader2, PhilippinePeso } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { ManagementTable, ManagementTableCell, TableCard } from "@/components/common/tables/ManagementTable";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPhilippinePeso } from "@/lib/formatters/currency";
import { appToast } from "@/lib/toast";
import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";
import { useManagementSession } from "@/modules/management/shell/context/ManagementSessionProvider";
import { CustomerFeedbackDialog } from "./components/CustomerFeedbackDialog";
import { OperatorsNeedingAttention } from "./components/OperatorsNeedingAttention";
import { OperatorBookingsDialog, type OperatorBookingsScope } from "@/modules/management/driving-analysis/components/OperatorBookingsDialog";
import type { DrivingOperator } from "@/services/booking";
import {
  downloadReport, getReports, type ReportChart, type ReportData, type ReportFormat,
  type ReportPeriod, type ReportSection, type ReportSelection,
} from "@/services/report";

const timeZone = "Asia/Manila";
const earliestDate = "1900-01-01";
const periods = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];
const sections: Array<{ value: ReportSection; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "revenue", label: "Revenue" },
  { value: "bookings", label: "Bookings" },
  { value: "fleet", label: "Fleet Performance" },
  { value: "customers", label: "Customer Insights" },
  { value: "telematics", label: "Risk & Telematics" },
];
const colors = ["var(--primary)", "var(--success)", "var(--warning)", "var(--destructive)"];
const outcomeColors: Record<string, string> = {
  cancelled: "var(--destructive)",
  rejected: "var(--warning)",
  no_show: "var(--muted-foreground)",
};
const metricIcons = { money: PhilippinePeso, count: BarChart3, hours: Clock3 };

function todayInManila() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  return parts.filter((part) => part.type !== "literal").map((part) => part.value).join("-");
}

function adjacentPeriod(date: string, period: ReportPeriod, direction: number) {
  const start = new Date(`${date}T00:00:00Z`);
  switch (period) {
    case "day":
      start.setUTCDate(start.getUTCDate() + direction);
      break;
    case "week":
      start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7 + 7 * direction);
      break;
    case "month":
      start.setUTCMonth(start.getUTCMonth() + direction, 1);
      break;
    case "year":
      start.setUTCFullYear(start.getUTCFullYear() + direction, 0, 1);
      break;
  }
  return start.toISOString().slice(0, 10);
}

const calendarDate = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" });
const reportDateTime = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone });
const reportDate = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone });
const numbers = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });
const compactNumbers = new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 });

function formatValue(
  value: string | number | null | undefined,
  format: ReportFormat | "text" | "datetime" | "date" | "rating",
  compact = false,
) {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "datetime") return reportDateTime.format(new Date(value));
  if (format === "date") return reportDate.format(new Date(value));
  if (format === "text") return String(value);
  if (format === "rating") return `${Number(value).toFixed(1)} / 5`;
  if (format === "money") return formatPhilippinePeso(Number(value), compact);
  const formatted = (compact ? compactNumbers : numbers).format(Number(value));
  return format === "hours" ? `${formatted} hrs` : formatted;
}

function ReportChartCard({ chart }: { chart: ReportChart }) {
  const horizontal = chart.type === "horizontal";
  const formatTick = (value: number) => formatValue(value, chart.format, true);
  const config = Object.fromEntries(chart.series.map(({ key, label }, index) => [
    key, { label, color: outcomeColors[key] ?? colors[index] },
  ]));
  const axes = (
    <>
      <CartesianGrid horizontal={!horizontal} vertical={horizontal} />
      <XAxis
        type={horizontal ? "number" : "category"}
        dataKey={horizontal ? undefined : "label"}
        allowDecimals={chart.format !== "count"}
        tickLine={false}
        axisLine={false}
        minTickGap={20}
        tickFormatter={horizontal ? formatTick : undefined}
      />
      <YAxis
        type={horizontal ? "category" : "number"}
        dataKey={horizontal ? "label" : undefined}
        width={horizontal ? 122 : 54}
        allowDecimals={chart.format !== "count"}
        tickLine={false}
        axisLine={false}
        tickFormatter={horizontal ? undefined : formatTick}
      />
      <ChartTooltip
        content={<ChartTooltipContent formatter={(value, key) => (
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-muted-foreground">{config[String(key)]?.label}</span>
            <span className="font-medium tabular-nums">{formatValue(Number(value), chart.format)}</span>
          </div>
        )} />}
      />
      {chart.series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
    </>
  );

  return (
    <Card className="min-w-0 rounded-2xl border border-border bg-surface shadow-none">
      <CardHeader className="pb-2"><CardTitle className="text-sm">{chart.title}</CardTitle></CardHeader>
      <CardContent className="pt-0">
        {chart.points.length === 0 ? <div role="status" className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">No data for this period.</div> :
        <ChartContainer config={config} className="h-[250px] w-full">
          {chart.type === "line" ? (
            <LineChart data={chart.points} margin={{ right: 12 }}>
              {axes}
              {chart.series.map(({ key }) => (
                <Line key={key} dataKey={key} stroke={config[key].color} strokeWidth={2} dot={false} isAnimationActive={false} />
              ))}
            </LineChart>
          ) : (
            <BarChart data={chart.points} layout={horizontal ? "vertical" : "horizontal"} margin={{ right: 12 }}>
              {axes}
              {chart.series.map(({ key }) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={config[key].color}
                  maxBarSize={40}
                  isAnimationActive={false}
                  stackId={chart.type === "stacked" ? "total" : undefined}
                />
              ))}
            </BarChart>
          )}
        </ChartContainer>
        }
      </CardContent>
    </Card>
  );
}

function ReportTable({
  table, onPageChange, onViewFeedback,
}: {
  table: NonNullable<ReportData["table"]>;
  onPageChange: (page: number) => void;
  onViewFeedback: (customer: { id: number; name: string }, trigger: HTMLButtonElement) => void;
}) {
  return (
    <div>
      <TableCard>
        <ManagementTable aria-label={table.title}>
          <TableHeader>
            <TableRow className="bg-background">
              {table.columns.map(({ key, label }) => (
                <TableHead key={key} className="px-4 py-3 text-xs">{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.length === 0 ? (
              <TableRow>
                <ManagementTableCell colSpan={table.columns.length} className="py-10 text-center text-muted-foreground">
                  No records found.
                </ManagementTableCell>
              </TableRow>
            ) : table.rows.map((row, index) => (
              <TableRow key={index}>
                {table.columns.map(({ key, label, format }) => (
                  <ManagementTableCell key={key} data-label={label} className="px-4 py-3 text-sm whitespace-normal">
                    {key === "lifetime_rating" && Number(row.rating_count) > 0 ? <Button variant="link" className="h-auto whitespace-normal p-0 text-sm" aria-label={`View lifetime ratings for ${row.customer}`} onClick={event => onViewFeedback({ id: Number(row.customer_id), name: String(row.customer) }, event.currentTarget)}>{Number(row[key]).toFixed(1)} / 5 ({row.rating_count})</Button> : key === "lifetime_rating" ? "—" : formatValue(row[key], key === "last_completed" ? "date" : format)}
                  </ManagementTableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </ManagementTable>
      </TableCard>
      <TablePagination
        total={table.total}
        page={table.page}
        lastPage={table.lastPage}
        onPageChange={onPageChange}
        label="Report pagination"
      />
    </div>
  );
}

export function ReportsAnalytics() {
  const { portal, user } = useManagementSession();
  const [feedbackCustomer, setFeedbackCustomer] = useState<{ id: number; name: string } | null>(null);
  const feedbackTrigger = useRef<HTMLButtonElement | null>(null);
  const [attentionOperator, setAttentionOperator] = useState<{ operator: DrivingOperator; scope: OperatorBookingsScope } | null>(null);
  const operatorTrigger = useRef<HTMLButtonElement | null>(null);
  const canCurateFeedback = user?.permissions?.includes("view financial reports") ?? false;
  const visibleSections = canCurateFeedback ? sections : sections.filter(section => ["bookings", "telematics"].includes(section.value));
  const [selection, setSelection] = useState<ReportSelection>(() => ({
    period: "month", date: todayInManila(), section: canCurateFeedback ? "overview" : "bookings", page: 1,
  }));
  const [searchInput, setSearchInput] = useState("");
  const [result, setResult] = useState<{ selection: ReportSelection; data: ReportData } | null>(null);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [retry, setRetry] = useState(0);
  const data = result?.selection === selection ? result.data : null;
  const search = searchInput.trim();
  const searchPending = search !== (selection.search ?? "");

  useEffect(() => {
    if (!searchPending) return;

    const timer = window.setTimeout(() => {
      setError(false);
      setSelection((current) => ({ ...current, search, page: 1, operatorPage: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, searchPending]);

  useEffect(() => {
    let active = true;
    getReports(selection)
      .then((response) => {
        if (active) setResult({ selection, data: response });
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => { active = false; };
  }, [retry, selection]);

  function update(next: Partial<ReportSelection>) {
    setError(false);
    const pagingOnly = Object.keys(next).every(key => key === "page" || key === "operatorPage");
    setSelection((current) => ({ ...current, ...(!pagingOnly ? { page: 1, operatorPage: 1 } : {}), ...next }));
  }

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadReport(selection);
    } catch {
      appToast.error("CSV could not be downloaded. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  const today = todayInManila();
  const previous = adjacentPeriod(selection.date, selection.period, -1);
  const next = adjacentPeriod(selection.date, selection.period, 1);
  const rangeStart = new Date(`${adjacentPeriod(selection.date, selection.period, 0)}T00:00:00Z`);
  const rangeEnd = new Date(`${next}T00:00:00Z`);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() - 1);
  const charts = data?.charts.filter((chart) => ["overview", "revenue"].includes(selection.section) || chart.points.length > 0) ?? [];
  const permissions = user?.permissions ?? [];
  const canViewDrivingAnalysis = permissions.includes("manage bookings") && permissions.includes("view fleet tracker");

  return (
    <div className="min-w-0 space-y-5 bg-background p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ManagementPageHeading title="Reports and Analytics" description={calendarDate.formatRange(rangeStart, rangeEnd)} />
        <Button type="button" variant="outline" onClick={exportCsv} disabled={!data || searchPending || exporting}>
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {exporting ? "Downloading..." : "Download CSV"}
        </Button>
      </div>

      <div className="grid items-center gap-2 lg:grid-cols-[minmax(0,3fr)_minmax(22rem,1fr)]">
        <SearchInput
          value={searchInput}
          onValueChange={setSearchInput}
          placeholder="Search reports..."
          aria-label="Search reports by booking code, customer, or vehicle"
          maxLength={160}
          wrapperClassName="w-full"
        />
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap">
          <div className="flex min-w-0 flex-[1_1_14rem] items-center gap-1">
            <Button
              type="button" variant="outline" size="icon" aria-label="Previous period"
              disabled={previous < earliestDate} onClick={() => update({ date: previous })}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Input
              type="date" aria-label="Report date" className="min-w-0 flex-1 bg-surface"
              value={selection.date} min={earliestDate} max={today}
              onChange={(event) => {
                if (event.target.value && event.target.validity.valid) update({ date: event.target.value });
              }}
            />
            <Button
              type="button" variant="outline" size="icon" aria-label="Next period"
              disabled={next > today} onClick={() => update({ date: next })}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <FilterSelect<ReportPeriod>
            value={selection.period}
            onValueChange={(period) => update({ period })}
            ariaLabel="Report period"
            className="min-w-0 flex-[1_1_7rem]"
            options={periods}
          />
        </div>
      </div>

      <Tabs value={selection.section} onValueChange={(section) => update({ section: section as ReportSection })} className="gap-4">
        <TabsList aria-label="Report sections">
          {visibleSections.map(({ value, label }) => <TabsTrigger key={value} value={value}>{label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value={selection.section} className="space-y-4">
          {error ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive-border bg-destructive-surface p-4 text-destructive">
              Report could not be loaded.
              <Button variant="outline" size="sm" onClick={() => { setError(false); setRetry((value) => value + 1); }}>
                Try again
              </Button>
            </div>
          ) : !data ? (
            <div role="status" className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading report...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
                {data.metrics.map((metric) => (
                  <KpiCard key={metric.label} label={metric.label} value={formatValue(metric.value, metric.format)} icon={metricIcons[metric.format]} />
                ))}
              </div>
              {charts.length > 0 && (
                <div className={charts.length > 1 ? "grid gap-4 xl:grid-cols-2" : "grid gap-4"}>
                  {charts.map((chart) => <ReportChartCard key={chart.title} chart={chart} />)}
                </div>
              )}
              {data.table && <ReportTable table={data.table} onPageChange={(page) => update({ page })} onViewFeedback={(customer, trigger) => { feedbackTrigger.current = trigger; setFeedbackCustomer(customer); }} />}
              {selection.section === "telematics" && canViewDrivingAnalysis && data.operatorAttention ? <OperatorsNeedingAttention data={data.operatorAttention} onPageChange={operatorPage => update({ operatorPage })} onView={(operator, trigger) => {
                operatorTrigger.current = trigger;
                setAttentionOperator({ operator, scope: { period: selection.period, date: selection.date, search: selection.search ?? "", vehicleId: selection.vehicleId ? String(selection.vehicleId) : undefined, gradedOnly: true } });
              }} /> : null}
              {selection.section === "telematics" && canViewDrivingAnalysis && (
                <Button variant="outline" asChild><Link href={`/${portal}/driving-analysis`}>Driving Analysis</Link></Button>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
      {feedbackCustomer ? <CustomerFeedbackDialog key={feedbackCustomer.id} customer={feedbackCustomer} canCurate={canCurateFeedback} onClose={() => setFeedbackCustomer(null)} onReturnFocus={() => feedbackTrigger.current?.focus()} /> : null}
      {attentionOperator ? <OperatorBookingsDialog key={`${attentionOperator.operator.id}:${attentionOperator.operator.operator_type}`} operator={attentionOperator.operator} scope={attentionOperator.scope} portal={portal} onClose={() => setAttentionOperator(null)} onReturnFocus={() => operatorTrigger.current?.focus()} /> : null}
    </div>
  );
}
export default ReportsAnalytics;
