import { CheckCircle2, Circle } from "lucide-react";
import type { BookingRecord } from "@/services/booking";
import { cn } from "@/lib/utils";
import { bookingWorkflowStepKey, bookingWorkflowSteps, type BookingWorkflowAction, type BookingWorkflowPhase } from "../booking-workflow";

export function BookingWorkflowProgress({ booking, phase, action }: {
  booking: BookingRecord; phase: BookingWorkflowPhase; action: BookingWorkflowAction | null;
}) {
  const active = bookingWorkflowStepKey(action);
  const steps = bookingWorkflowSteps(booking, phase);
  const activeIndex = steps.findIndex((step) => step.key === active);
  return <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 sm:px-6">
    <ol aria-label="Booking workflow progress" className="flex min-w-0 items-center gap-x-3 overflow-x-auto">
      {steps.map((step, index) => <li key={step.key} aria-current={step.key === active ? "step" : undefined}
        className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground", step.key === active && "font-semibold text-primary")}>
        {step.done ? <CheckCircle2 size={14} className="shrink-0 text-success" aria-hidden="true" /> : step.key === active ? <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">{index + 1}</span> : <Circle size={14} className="shrink-0" aria-hidden="true" />}
        <span className="sr-only sm:not-sr-only">{step.label}</span><span className="sr-only">{step.done ? " — complete" : step.key === active ? " — current step" : " — pending"}</span>
      </li>)}
    </ol>
    {activeIndex >= 0 ? <p className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">Step {activeIndex + 1} of {steps.length}</p> : null}
  </div>;
}
