import { CheckCircle2, Circle } from "lucide-react";
import type { BookingRecord } from "@/services/booking";
import { cn } from "@/lib/utils";
import { bookingWorkflowSteps, type BookingWorkflowAction, type BookingWorkflowPhase } from "../booking-workflow";

export function BookingWorkflowProgress({ booking, phase, action }: {
  booking: BookingRecord; phase: BookingWorkflowPhase; action: BookingWorkflowAction | null;
}) {
  const active = action === "calibration-pending" ? "view-setup" : action === "reassign-driver" ? "assign-driver" : action;
  const steps = bookingWorkflowSteps(booking, phase);
  const activeIndex = steps.findIndex((step) => step.key === active);
  return <div className="shrink-0 space-y-2 border-b border-border bg-background px-4 py-3 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <p className="font-semibold text-foreground">{booking.bookingCode}</p>
      {activeIndex >= 0 ? <p className="text-muted-foreground">Step {activeIndex + 1} of {steps.length}</p> : null}
    </div>
    <ol aria-label="Booking workflow progress" className="flex flex-wrap gap-x-3 gap-y-2">
      {steps.map((step, index) => <li key={step.key} aria-current={step.key === active ? "step" : undefined}
        className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", step.key === active && "font-semibold text-primary")}>
        {step.done ? <CheckCircle2 size={14} className="shrink-0 text-success" aria-hidden="true" /> : step.key === active ? <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">{index + 1}</span> : <Circle size={14} className="shrink-0" aria-hidden="true" />}
        <span className="sr-only sm:not-sr-only">{step.label}</span><span className="sr-only">{step.done ? " — complete" : step.key === active ? " — current step" : " — pending"}</span>
      </li>)}
    </ol>
  </div>;
}
