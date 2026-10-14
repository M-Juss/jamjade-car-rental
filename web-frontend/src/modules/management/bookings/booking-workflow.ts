import type { BookingRecord } from "@/services/booking";
import type { BookingNextAction } from "./booking-next-action";

export type BookingWorkflowAction = BookingNextAction | "reassign-driver";
export type BookingWorkflowPhase = "prepare" | "return" | "finish";

export function bookingWorkflowPhase(action: BookingWorkflowAction): BookingWorkflowPhase {
  if (action === "complete") return "finish";
  if (["incoming", "review-charges", "mark-returned"].includes(action)) return "return";
  return "prepare";
}

export const bookingWorkflowTitles: Record<BookingWorkflowPhase, string> = {
  prepare: "Prepare Rental",
  return: "Process Return",
  finish: "Finish Booking",
};

export function bookingWorkflowSteps(booking: BookingRecord, phase: BookingWorkflowPhase) {
  const returned = ["returned", "completed"].includes(booking.statusKey);
  const released = ["ongoing", "returned", "completed"].includes(booking.statusKey);
  if (phase === "prepare") return [
    ...(booking.driverOption === "owners_driver" ? [{ key: "assign-driver", label: "Driver", done: Boolean(booking.assignedDriver) }] : []),
    ...(!booking.telematicsHandover?.eligibility?.testMode || booking.rentalProgress?.outgoingFinalized
      ? [{ key: "outgoing", label: "Outgoing Inspection", done: Boolean(booking.rentalProgress?.outgoingFinalized) }] : []),
    ...(booking.driverOption === "self_drive" ? [
      { key: "prepare-handover", label: "Handover", done: ["in_progress", "ready_for_release", "released"].includes(booking.telematicsSetupStatus ?? "") },
      { key: "view-setup", label: "Setup", done: ["ready_for_release", "released"].includes(booking.telematicsSetupStatus ?? "") },
    ] : []),
    { key: "start-rental", label: "Release", done: released },
  ];
  return [
    ...(phase === "return" ? [
      { key: "incoming", label: "Incoming Inspection", done: Boolean(booking.rentalProgress?.incomingFinalized) },
      { key: "review-charges", label: "Return Charges", done: Boolean(booking.returnChargesFinalizedAt) },
    ] : []),
    { key: "mark-returned", label: "Returned", done: returned },
    { key: "complete", label: "Completion", done: booking.statusKey === "completed" },
  ];
}

export function bookingActionBlockers(booking: BookingRecord, action: BookingWorkflowAction | null): string[] {
  const ready = booking.readiness;
  if (action === null) return [];
  if (action === "prepare-handover") {
    const eligibility = booking.telematicsHandover?.eligibility;
    return eligibility?.testMode ? [] : [
      !eligibility?.documentsVerified && "Self-drive documents must be approved.",
      !eligibility?.rentalPeriodEligible && "Handover can start only on the scheduled Manila calendar date.",
      !eligibility?.outgoingInspectionComplete && "Finalize Outgoing Inspection with both signatures.",
    ].filter((item): item is string => Boolean(item));
  }
  if (action === "incoming") return [
    !booking.rentalProgress?.outgoingFinalized && "A finalized Outgoing Inspection is required.",
    ["started", "paused"].includes(booking.rentalProgress?.latestTripStatus ?? "") && "End the active telematics trip before Incoming Inspection.",
    !booking.inspectionBaseline && "The outgoing inspection baseline could not be loaded.",
  ].filter((item): item is string => Boolean(item));
  if (!["outgoing", "start-rental", "complete", "mark-returned"].includes(action)) return [];
  if (!ready) return ["Booking readiness could not be loaded. Refresh the booking and try again."];
  if (action === "complete") return [
    booking.statusKey !== "returned" && "The vehicle must be marked Returned first.",
    !ready.incomingFinalized && "Finalize Incoming Inspection.",
    !ready.returnChargesFinalized && "Finalize return-charge review.",
    (booking.remainingBalance > 0 || !ready.customerChargesSettled) && "Customer balance and customer charges must be settled first.",
  ].filter((item): item is string => Boolean(item));
  if (action === "mark-returned") return [
    !ready.incomingFinalized && "Finalize Incoming Inspection.",
    !ready.returnChargesFinalized && "Finalize return-charge review.",
  ].filter((item): item is string => Boolean(item));
  return [
    !ready.bookingConfirmed && "Booking must be confirmed.",
    action === "outgoing" && !ready.paymentAcceptedForInspection && "An accepted partial or full payment is required.",
    action === "start-rental" && !ready.fullyPaid && "Full customer payment is required.",
    !ready.ageEligible && "The renter must meet the age requirement.",
    !ready.documentsApproved && "Self-drive documents must be approved.",
    !ready.driverAssigned && "Assign a driver before inspection.",
    !ready.driverEligible && "The assigned driver is not eligible.",
    !ready.vehicleOperational && "The vehicle must be operational and available.",
    action === "outgoing" && !booking.inspectionBaseline && "Set a finalized current vehicle condition first.",
    action === "start-rental" && !ready.outgoingFinalized && "Finalize the Outgoing Inspection.",
    action === "start-rental" && !ready.telematicsSetupReady && "Complete all telematics checks, including calibration, before release.",
  ].filter((item): item is string => Boolean(item));
}
