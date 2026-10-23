"use client";

import { Eye, FileCheck2 } from "lucide-react";
import { useState } from "react";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { VehicleConditionSnapshot } from "@/modules/management/vehicles/inspection";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { MaintenanceRecord } from "@/services/maintenance";
import { MaintenanceStatusBadge } from "./MaintenanceStatusBadge";

function formatDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value))
    : "—";
}

function formatDateOnly(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value))
    : "—";
}

function currency(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

function Detail({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-subtle-foreground">{label}</p>
      <div className="mt-1 text-xs font-semibold leading-5 text-foreground">{value || "—"}</div>
    </div>
  );
}

export function MaintenanceDetailsDialog({
  record,
  onOpenChange,
}: {
  record: MaintenanceRecord | null;
  onOpenChange: () => void;
}) {
  const [conditionOpen, setConditionOpen] = useState(false);
  if (!record) return null;

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onOpenChange(); }}>
        <FormDialogContent width="wide">
          <FormDialogHeader title="Maintenance Details" icon={Eye} onClose={onOpenChange} closeLabel="Close maintenance details" />
          <div className="grid flex-1 gap-5 overflow-y-auto px-6 py-5">
            <section className="grid gap-4 rounded-2xl border border-border bg-background p-4 sm:grid-cols-4">
              <Detail label="Vehicle" value={record.vehicle?.name} />
              <Detail label="Maintenance" value={record.title} />
              <Detail label="Category" value={record.categoryLabel} />
              <Detail label="Status" value={<MaintenanceStatusBadge value={record.status} label={record.statusLabel} />} />
            </section>
            <section>
              <h3 className="mb-3 text-sm font-bold text-foreground">Schedule and Actual Work</h3>
              <div className="grid gap-4 border-y border-border py-4 sm:grid-cols-3">
                <Detail label="Scheduled Start Date" value={formatDateOnly(record.scheduledStart)} />
                <Detail label="Expected End Date" value={formatDateOnly(record.scheduledEnd)} />
                <Detail label="Actual Start" value={formatDate(record.actualStartedAt)} />
                {record.status === "completed" ? <Detail label="Completed" value={formatDate(record.completedAt)} /> : null}
                {record.status === "cancelled" ? <Detail label="Cancelled" value={formatDate(record.cancelledAt)} /> : null}
                <Detail label="Service Provider" value={record.serviceProvider} />
              </div>
            </section>
            {(record.description || record.workPerformed || record.notes || record.cancellationReason) ? (
              <section>
                <h3 className="mb-3 text-sm font-bold text-foreground">Work and Notes</h3>
                <div className="grid gap-4 border-y border-border py-4 sm:grid-cols-2">
                  {record.description ? <Detail label="Description" value={<p className="whitespace-pre-wrap">{record.description}</p>} /> : null}
                  {record.workPerformed ? <Detail label="Work Performed" value={<p className="whitespace-pre-wrap">{record.workPerformed}</p>} /> : null}
                  {record.notes ? <Detail label="Internal Notes" value={<p className="whitespace-pre-wrap">{record.notes}</p>} /> : null}
                  {record.cancellationReason ? <Detail label="Cancellation Reason" value={<p className="whitespace-pre-wrap">{record.cancellationReason}</p>} /> : null}
                </div>
              </section>
            ) : null}
            {(record.status === "completed" || record.odometerAtStart != null || record.odometerAtCompletion != null) ? (
              <section>
                <h3 className="mb-3 text-sm font-bold text-foreground">Completion Evidence</h3>
                <div className="grid gap-4 border-y border-border py-4 sm:grid-cols-4">
                  <Detail label="Starting Odometer" value={record.odometerAtStart != null ? `${record.odometerAtStart.toLocaleString()} km` : undefined} />
                  <Detail label="Completion Odometer" value={record.odometerAtCompletion != null ? `${record.odometerAtCompletion.toLocaleString()} km` : undefined} />
                  <Detail label="Completed By" value={record.completedBy?.name} />
                  <Detail label="Total Cost" value={record.status === "completed" ? currency(record.totalCost) : undefined} />
                  <Detail label="Parts" value={currency(record.partsCost)} />
                  <Detail label="Labor" value={currency(record.laborCost)} />
                  <Detail label="Other" value={currency(record.otherCost)} />
                </div>
              </section>
            ) : null}
            {record.resultingCondition ? (
              <Button type="button" variant="outline" onClick={() => setConditionOpen(true)}>
                <FileCheck2 /> View Resulting Vehicle Condition
              </Button>
            ) : null}
          </div>
          <FormDialogFooter><Button type="button" onClick={onOpenChange}>Close</Button></FormDialogFooter>
        </FormDialogContent>
      </Dialog>
      {record.resultingCondition ? (
        <Dialog open={conditionOpen} onOpenChange={setConditionOpen}>
          <FormDialogContent width="wide" className="h-[92dvh] max-h-[900px]">
            <FormDialogHeader title="Resulting Vehicle Condition" icon={FileCheck2} onClose={() => setConditionOpen(false)} closeLabel="Close resulting vehicle condition" />
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <VehicleConditionSnapshot inspection={record.resultingCondition} />
            </div>
            <FormDialogFooter><Button type="button" onClick={() => setConditionOpen(false)}>Close</Button></FormDialogFooter>
          </FormDialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
