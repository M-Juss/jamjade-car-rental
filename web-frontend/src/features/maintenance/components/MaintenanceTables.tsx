"use client";

import {
  Ban,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Pencil,
  Play,
  XCircle,
} from "lucide-react";
import {
  TableActionMenu,
  type TableActionMenuItem,
} from "@/components/common/TableActionMenu";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MaintenancePlan, MaintenanceRecord } from "@/services/maintenance";
import { MaintenanceStatusBadge } from "./MaintenanceStatusBadge";

const headClassName = "whitespace-nowrap px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-subtle-foreground";
const cellClassName = "px-4 py-3 text-[12px] text-muted-foreground";

function formatDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);
}

function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-0 bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
      {children}
    </Card>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-12 text-center text-[12px] text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );
}

type VehiclePlansTableProps = {
  plans: MaintenancePlan[];
  onSchedule: (planId: string) => void;
  onEdit: (plan: MaintenancePlan) => void;
  onDeactivate: (plan: MaintenancePlan) => void;
};

export function VehiclePlansTable({
  plans,
  onSchedule,
  onEdit,
  onDeactivate,
}: VehiclePlansTableProps) {
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border bg-background hover:bg-background">
            {["Plan", "Category", "Cycle", "Next Due", "Status", "Actions"].map((heading) => (
              <TableHead key={heading} className={headClassName}>{heading}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.length === 0 ? (
            <EmptyRow colSpan={6} message="No maintenance plans are configured for this vehicle." />
          ) : plans.map((plan) => (
            <TableRow key={plan.id} className="border-b border-background hover:bg-background">
              <TableCell className="px-4 py-3 text-[12.5px] font-semibold text-foreground">
                {plan.name}
              </TableCell>
              <TableCell className={cellClassName}>{plan.categoryLabel}</TableCell>
              <TableCell className={cellClassName}>
                {plan.triggerType !== "date" ? `${plan.intervalKm?.toLocaleString()} km` : null}
                {plan.triggerType === "both" ? " or " : null}
                {plan.triggerType !== "mileage" ? `${plan.intervalDays} days` : null}
              </TableCell>
              <TableCell className={cellClassName}>
                {plan.nextDueOdometer != null ? `${plan.nextDueOdometer.toLocaleString()} km` : "—"}
                {plan.nextDueOdometer != null && plan.nextDueDate ? " / " : null}
                {plan.nextDueDate ?? ""}
              </TableCell>
              <TableCell className="px-4 py-3">
                <MaintenanceStatusBadge value={plan.dueStatus} label={plan.dueStatusLabel} />
              </TableCell>
              <TableCell className="px-4 py-3">
                <TableActionMenu
                  label={`Open actions for ${plan.name}`}
                  items={[
                    {
                      label: "Schedule",
                      icon: <CalendarPlus size={13} className="mr-2" />,
                      onClick: () => onSchedule(plan.id),
                      disabled: !plan.isActive,
                    },
                    {
                      label: "Edit",
                      icon: <Pencil size={13} className="mr-2" />,
                      onClick: () => onEdit(plan),
                      disabled: !plan.isActive,
                    },
                    {
                      label: "Deactivate",
                      icon: <Ban size={13} className="mr-2" />,
                      onClick: () => onDeactivate(plan),
                      disabled: !plan.isActive,
                      separatorBefore: true,
                      variant: "danger",
                    },
                  ]}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}

export function DueMaintenanceTable({
  plans,
  onSchedule,
}: {
  plans: MaintenancePlan[];
  onSchedule: (planId: string) => void;
}) {
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border bg-background hover:bg-background">
            {["Vehicle", "Maintenance", "Due", "Status", "Action"].map((heading) => (
              <TableHead key={heading} className={headClassName}>{heading}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.length === 0 ? (
            <EmptyRow colSpan={5} message="No due or overdue maintenance plans match this view." />
          ) : plans.map((plan) => (
            <TableRow key={plan.id} className="border-b border-background hover:bg-background">
              <TableCell className="px-4 py-3 text-[12.5px] font-semibold text-foreground">
                {plan.vehicle?.name ?? "Vehicle unavailable"}
              </TableCell>
              <TableCell className="px-4 py-3">
                <p className="text-[12.5px] font-semibold text-foreground">{plan.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{plan.categoryLabel}</p>
              </TableCell>
              <TableCell className={cellClassName}>
                {plan.mileageRemaining != null
                  ? `${Math.abs(plan.mileageRemaining).toLocaleString()} km ${plan.mileageRemaining < 0 ? "overdue" : "remaining"}`
                  : null}
                {plan.mileageRemaining != null && plan.daysRemaining != null ? " · " : null}
                {plan.daysRemaining != null
                  ? `${Math.abs(plan.daysRemaining)} day(s) ${plan.daysRemaining < 0 ? "overdue" : "remaining"}`
                  : null}
              </TableCell>
              <TableCell className="px-4 py-3">
                <MaintenanceStatusBadge value={plan.dueStatus} label={plan.dueStatusLabel} />
              </TableCell>
              <TableCell className="px-4 py-3">
                <TableActionMenu
                  label={`Open actions for ${plan.name}`}
                  items={[{
                    label: "Schedule",
                    icon: <CalendarPlus size={13} className="mr-2" />,
                    onClick: () => onSchedule(plan.id),
                  }]}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}

type MaintenanceRecordsTableProps = {
  records: MaintenanceRecord[];
  onStart: (record: MaintenanceRecord) => void;
  onComplete: (record: MaintenanceRecord) => void;
  onCancel: (record: MaintenanceRecord) => void;
  onCondition: (record: MaintenanceRecord) => void;
};

export function MaintenanceRecordsTable({
  records,
  onStart,
  onComplete,
  onCancel,
  onCondition,
}: MaintenanceRecordsTableProps) {
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border bg-background hover:bg-background">
            {["Vehicle", "Maintenance", "Schedule", "Provider / Technician", "Status", "Cost", "Actions"].map((heading) => (
              <TableHead key={heading} className={headClassName}>{heading}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <EmptyRow colSpan={7} message="No maintenance records match this view." />
          ) : records.map((record) => {
            const canCreateCondition = record.status === "completed"
              && ["corrective", "body_repair"].includes(record.category)
              && !record.resultingConditionInspectionId;
            const actions: TableActionMenuItem[] = [
              ...(record.status === "scheduled" ? [
                {
                  label: "Start",
                  icon: <Play size={13} className="mr-2" />,
                  onClick: () => onStart(record),
                  variant: "success" as const,
                },
                {
                  label: "Cancel",
                  icon: <XCircle size={13} className="mr-2" />,
                  onClick: () => onCancel(record),
                  separatorBefore: true,
                  variant: "danger" as const,
                },
              ] : []),
              ...(record.status === "in_progress" ? [{
                label: "Complete",
                icon: <CheckCircle2 size={13} className="mr-2" />,
                onClick: () => onComplete(record),
                variant: "success" as const,
              }] : []),
              ...(canCreateCondition ? [{
                label: "Record Condition",
                icon: <ClipboardCheck size={13} className="mr-2" />,
                onClick: () => onCondition(record),
              }] : []),
            ];

            return (
              <TableRow key={record.id} className="border-b border-background align-top hover:bg-background">
                <TableCell className="px-4 py-3 text-[12.5px] font-semibold text-foreground">
                  {record.vehicle?.name ?? "Vehicle unavailable"}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <p className="text-[12.5px] font-semibold text-foreground">{record.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{record.categoryLabel}</p>
                  {record.description || record.workPerformed || record.notes ? (
                    <details className="mt-2 text-[11px] text-muted-foreground">
                      <summary className="cursor-pointer font-medium text-primary">View details</summary>
                      {record.description ? <p className="mt-2 whitespace-normal">{record.description}</p> : null}
                      {record.workPerformed ? <p className="mt-2 whitespace-normal"><strong>Work:</strong> {record.workPerformed}</p> : null}
                      {record.notes ? <p className="mt-2 whitespace-normal"><strong>Notes:</strong> {record.notes}</p> : null}
                    </details>
                  ) : null}
                </TableCell>
                <TableCell className={cellClassName}>
                  {formatDate(record.scheduledStart)}<br />
                  {formatDate(record.scheduledEnd)}
                </TableCell>
                <TableCell className={cellClassName}>
                  {record.serviceProvider ?? "—"}<br />
                  {record.technician ?? "—"}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <MaintenanceStatusBadge value={record.status} label={record.statusLabel} />
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3 text-[12px] font-semibold text-foreground">
                  {record.status === "completed" ? formatCurrency(record.totalCost) : "—"}
                </TableCell>
                <TableCell className="px-4 py-3">
                  {actions.length ? (
                    <TableActionMenu
                      label={`Open actions for ${record.title}`}
                      items={actions}
                    />
                  ) : (
                    <span className="text-subtle-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableCard>
  );
}
