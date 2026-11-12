"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { FormDialogContent, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import type { RentalDrivingGrade } from "@/services/fleet/fleet.service";

const maneuverLabels = {
  harsh_acceleration: "Harsh acceleration",
  harsh_braking: "Harsh braking",
  harsh_cornering: "Harsh cornering",
  harsh_swerve: "Harsh swerving",
} as const;

export function formatDrivingGrade(grading?: RentalDrivingGrade) {
  if (grading?.status === "pending") return "Finalizing";
  const value = grading?.score != null ? `${grading.score} / ${grading.maximum}` : "Not graded";
  return grading?.sync_incomplete ? `${value} · Incomplete sync` : value;
}

export function GradingDialog({ grading }: { grading: RentalDrivingGrade | null }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" variant="outline" size="sm"><Info className="size-4" aria-hidden="true" />Grading</Button></DialogTrigger>
    <FormDialogContent width="compact">
      <FormDialogHeader title="Grading" icon={Info} onClose={() => setOpen(false)} closeLabel="Close grading" />
      <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-5 text-sm sm:px-6">
        {grading ? <>
          <p>Starts at {grading.maximum} points and the minimum score is 0. Only confirmed harsh events deduct points.</p>
          <dl className="divide-y divide-border">{Object.entries(maneuverLabels).map(([key, label]) => <div key={key} className="flex items-center justify-between gap-4 py-3"><dt>{label}</dt><dd className="shrink-0 font-medium tabular-nums">−{grading.breakdown[key as keyof typeof maneuverLabels].points_each} points</dd></div>)}</dl>
        </> : <p role="status" className="text-muted-foreground">Grading details are unavailable until analysis loads.</p>}
      </div>
    </FormDialogContent>
  </Dialog>;
}

export function ScoreCalculation({ grading }: { grading: RentalDrivingGrade | null }) {
  return <section className="space-y-3">
    <h2 className="text-sm font-semibold">Score calculation</h2>
    {!grading ? <p role="status" className="text-sm text-muted-foreground">Loading calculation…</p>
      : grading.status === "pending" ? <p role="status" className="text-sm text-muted-foreground">The grade will appear when the report is finalized.</p>
      : grading.score === null ? <p className="text-sm text-muted-foreground">No motion readings received.</p>
        : <>
          <dl className="space-y-2 text-sm">{Object.entries(maneuverLabels).map(([key, label]) => {
            const item = grading.breakdown[key as keyof typeof maneuverLabels];
            return (
              <div key={key} className="flex items-baseline justify-between gap-4">
                <dt className="min-w-0">
                  <span className="font-medium tabular-nums">{item.count} × </span>{label}
                  <span className="ml-2 text-xs text-muted-foreground">({item.points_each} points)</span>
                </dt>
                <dd className="shrink-0 font-medium tabular-nums">−{item.deduction}</dd>
              </div>
            );
          })}
            <div className="flex items-baseline justify-between gap-4 font-semibold"><dt>Total deductions</dt><dd className="shrink-0 tabular-nums">−{grading.deductions}</dd></div>
          </dl>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <p className="text-sm font-medium">Total Grade</p>
            <p className="shrink-0 text-right text-xl font-semibold text-foreground tabular-nums">{grading.score}<span className="text-sm font-normal text-muted-foreground"> / {grading.maximum}</span>{grading.sync_incomplete ? <span className="block text-xs font-normal text-muted-foreground">Incomplete sync</span> : null}</p>
          </div>
        </>}
  </section>;
}
