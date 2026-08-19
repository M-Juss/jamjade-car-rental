"use client";

import {
  CalendarPlus,
  CheckCircle2,
  Eye,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { TableActionMenu, type TableActionMenuItem } from "@/components/common/tables/TableActionMenu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MaintenancePlan, MaintenanceRecord } from "@/services/maintenance";
import { MaintenanceStatusBadge } from "./MaintenanceStatusBadge";

const headClassName = "whitespace-nowrap px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-subtle-foreground";
const cellClassName = "whitespace-nowrap px-4 py-3 text-[12px] text-muted-foreground";

function formatDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";
}

function formatDateOnly(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(value))
    : "—";
}

function formatShortDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`))
    : "—";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-0 bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
      <div className="overflow-x-auto">{children}</div>
    </Card>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return <TableRow><TableCell colSpan={colSpan} className="py-12 text-center text-[12px] text-muted-foreground">{message}</TableCell></TableRow>;
}

function interval(plan: MaintenancePlan) {
  const values = [];
  if (plan.intervalKm != null) values.push(`${plan.intervalKm.toLocaleString()} km`);
  if (plan.intervalDays != null) values.push(`${plan.intervalDays.toLocaleString()} days`);
  return values.join(" / ") || "—";
}

function current(plan: MaintenancePlan) {
  const values = [];
  if (plan.triggerType !== "date") values.push(plan.currentOdometer == null ? "Odometer not recorded" : `${plan.currentOdometer.toLocaleString()} km`);
  if (plan.triggerType !== "mileage") values.push("Today");
  return values.join(" / ");
}

function nextDue(plan: MaintenancePlan) {
  const values = [];
  if (plan.nextDueOdometer != null) values.push(`${plan.nextDueOdometer.toLocaleString()} km`);
  if (plan.nextDueDate) values.push(formatShortDate(plan.nextDueDate));
  return values.join(" / ") || "—";
}

function remaining(plan: MaintenancePlan) {
  const values = [];
  if (plan.mileageRemaining != null) values.push(
    plan.mileageRemaining < 0
      ? `${Math.abs(plan.mileageRemaining).toLocaleString()} km over`
      : `${plan.mileageRemaining.toLocaleString()} km`,
  );
  if (plan.daysRemaining != null) values.push(
    plan.daysRemaining < 0 ? `${Math.abs(plan.daysRemaining)} days over` : `${plan.daysRemaining} days`,
  );
  return values.join(" / ") || "—";
}

export function MaintenancePlansTable({
  plans,
  onSchedule,
  onEdit,
  onDelete,
  onViewRecord,
}: {
  plans: MaintenancePlan[];
  onSchedule: (planId: string) => void;
  onEdit: (plan: MaintenancePlan) => void;
  onDelete: (plan: MaintenancePlan) => void;
  onViewRecord: (recordId: string) => void;
}) {
  return (
    <TableCard>
      <Table>
        <TableHeader><TableRow className="border-b border-border bg-background hover:bg-background">
          {["Vehicle", "Maintenance", "Trigger", "Current", "Interval", "Next Due", "Remaining", "Condition", "Action"].map((heading) => <TableHead key={heading} className={headClassName}>{heading}</TableHead>)}
        </TableRow></TableHeader>
        <TableBody>
          {plans.length === 0 ? <EmptyRow colSpan={9} message="No maintenance plans match this view." /> : plans.map((plan) => {
            const items: TableActionMenuItem[] = plan.activeRecord ? [
              { label: "View Scheduled Maintenance", icon: <Eye size={13} className="mr-2" />, onClick: () => onViewRecord(plan.activeRecord!.id) },
              { label: "Edit Plan", icon: <Pencil size={13} className="mr-2" />, onClick: () => onEdit(plan) },
              { label: "Delete Plan", icon: <Trash2 size={13} className="mr-2" />, disabled: true, separatorBefore: true, variant: "danger" },
            ] : [
              { label: "Schedule Maintenance", icon: <CalendarPlus size={13} className="mr-2" />, onClick: () => onSchedule(plan.id) },
              { label: "Edit Plan", icon: <Pencil size={13} className="mr-2" />, onClick: () => onEdit(plan) },
              { label: "Delete Plan", icon: <Trash2 size={13} className="mr-2" />, onClick: () => onDelete(plan), separatorBefore: true, variant: "danger" },
            ];
            return (
              <TableRow key={plan.id} className="border-b border-background hover:bg-background">
                <TableCell className="px-4 py-3 text-[12.5px] font-semibold text-foreground">{plan.vehicle?.name ?? "Vehicle unavailable"}</TableCell>
                <TableCell className="px-4 py-3"><p className="text-[12.5px] font-semibold text-foreground">{plan.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{plan.categoryLabel}</p></TableCell>
                <TableCell className={cellClassName}>{plan.triggerType === "both" ? "Mileage and date" : plan.triggerType[0].toUpperCase() + plan.triggerType.slice(1)}</TableCell>
                <TableCell className={cellClassName}>{current(plan)}</TableCell>
                <TableCell className={cellClassName}>{interval(plan)}</TableCell>
                <TableCell className={cellClassName}>{nextDue(plan)}</TableCell>
                <TableCell className={cellClassName}>{remaining(plan)}</TableCell>
                <TableCell className="px-4 py-3"><MaintenanceStatusBadge value={plan.dueStatus} label={plan.dueStatusLabel} />{plan.activeRecord ? <p className="mt-1 text-[10.5px] font-semibold text-primary">Handled: {plan.activeRecord.statusLabel}</p> : null}</TableCell>
                <TableCell className="px-4 py-3"><TableActionMenu label={`Open actions for ${plan.name}`} items={items} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableCard>
  );
}

export function ScheduledMaintenanceTable({
  records,
  onView,
  onStart,
  onComplete,
  onReschedule,
  onCancel,
  onCondition,
}: {
  records: MaintenanceRecord[];
  onView: (record: MaintenanceRecord) => void;
  onStart: (record: MaintenanceRecord) => void;
  onComplete: (record: MaintenanceRecord) => void;
  onReschedule: (record: MaintenanceRecord) => void;
  onCancel: (record: MaintenanceRecord) => void;
  onCondition: (record: MaintenanceRecord) => void;
}) {
  return (
    <TableCard>
      <Table>
        <TableHeader><TableRow className="border-b border-border bg-background hover:bg-background">
          {["Vehicle", "Maintenance", "Start Date", "Expected End Date", "Provider", "Status", "Action"].map((heading) => <TableHead key={heading} className={headClassName}>{heading}</TableHead>)}
        </TableRow></TableHeader>
        <TableBody>
          {records.length === 0 ? <EmptyRow colSpan={7} message="No scheduled or in-progress maintenance matches this view." /> : records.map((record) => {
            const actions: TableActionMenuItem[] = [
              { label: "View Details", icon: <Eye size={13} className="mr-2" />, onClick: () => onView(record) },
              ...(record.status === "scheduled" ? [
                { label: "Start Maintenance", icon: <Play size={13} className="mr-2" />, onClick: () => onStart(record), variant: "success" as const },
                { label: "Reschedule", icon: <RefreshCw size={13} className="mr-2" />, onClick: () => onReschedule(record) },
                { label: "Cancel", icon: <XCircle size={13} className="mr-2" />, onClick: () => onCancel(record), separatorBefore: true, variant: "danger" as const },
              ] : [
                record.conditionVerificationRequired
                  ? { label: "Continue Condition Verification", icon: <CheckCircle2 size={13} className="mr-2" />, onClick: () => onCondition(record), variant: "success" as const }
                  : { label: "Complete Maintenance", icon: <CheckCircle2 size={13} className="mr-2" />, onClick: () => onComplete(record), variant: "success" as const },
              ]),
            ];
            return (
              <TableRow key={record.id} className="border-b border-background hover:bg-background">
                <TableCell className="px-4 py-3 text-[12.5px] font-semibold text-foreground">{record.vehicle?.name ?? "Vehicle unavailable"}</TableCell>
                <TableCell className="px-4 py-3"><p className="text-[12.5px] font-semibold text-foreground">{record.title}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{record.categoryLabel}</p></TableCell>
                <TableCell className={cellClassName}>{formatDateOnly(record.scheduledStart)}</TableCell>
                <TableCell className={cellClassName}>{formatDateOnly(record.scheduledEnd)}</TableCell>
                <TableCell className={cellClassName}>{record.serviceProvider ?? "—"}</TableCell>
                <TableCell className="px-4 py-3"><MaintenanceStatusBadge value={record.status} label={record.statusLabel} />{record.conditionVerificationRequired ? <p className="mt-1 text-[10.5px] font-semibold text-warning">Condition verification required</p> : null}</TableCell>
                <TableCell className="px-4 py-3"><TableActionMenu label={`Open actions for ${record.title}`} items={actions} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableCard>
  );
}

export function MaintenanceHistoryTable({ records, onView }: { records: MaintenanceRecord[]; onView: (record: MaintenanceRecord) => void }) {
  return (
    <TableCard>
      <Table>
        <TableHeader><TableRow className="border-b border-border bg-background hover:bg-background">
          {["Vehicle", "Maintenance", "Date", "Provider", "Cost", "Status", "Action"].map((heading) => <TableHead key={heading} className={headClassName}>{heading}</TableHead>)}
        </TableRow></TableHeader>
        <TableBody>
          {records.length === 0 ? <EmptyRow colSpan={7} message="No completed or cancelled maintenance matches this view." /> : records.map((record) => (
            <TableRow key={record.id} className="border-b border-background hover:bg-background">
              <TableCell className="px-4 py-3 text-[12.5px] font-semibold text-foreground">{record.vehicle?.name ?? "Vehicle unavailable"}</TableCell>
              <TableCell className="px-4 py-3"><p className="text-[12.5px] font-semibold text-foreground">{record.title}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{record.categoryLabel}</p></TableCell>
              <TableCell className={cellClassName}>{formatDate(record.completedAt ?? record.cancelledAt)}</TableCell>
              <TableCell className={cellClassName}>{record.serviceProvider ?? "—"}</TableCell>
              <TableCell className="whitespace-nowrap px-4 py-3 text-[12px] font-semibold text-foreground">{record.status === "completed" ? formatCurrency(record.totalCost) : "—"}</TableCell>
              <TableCell className="px-4 py-3"><MaintenanceStatusBadge value={record.status} label={record.statusLabel} /></TableCell>
              <TableCell className="px-4 py-3"><Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`View details for ${record.title}`} onClick={() => onView(record)}><Eye /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}
