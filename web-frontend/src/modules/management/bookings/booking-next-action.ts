import type { BookingRecord } from "@/services/booking";

export const TELEMATICS_DEVICE_STEPS = ["device_check", "motion_permission", "location_permission", "background_location", "gps_check", "phone_mount"];
const TELEMATICS_CALIBRATION_STEPS = [
  { type: "stationary_calibration", label: "Stationary" },
  { type: "forward_calibration", label: "Forward Reference" },
] as const;

export function setupStepsPassed(booking: BookingRecord, types: string[]) {
  const steps = booking.telematicsHandover?.steps ?? [];
  return types.every((type) => steps.some((step) => step.type === type && step.status === "passed"));
}

export function bookingCalibrationProgress(booking: BookingRecord) {
  const handover = booking.telematicsHandover;
  const steps = TELEMATICS_CALIBRATION_STEPS.map(({ type, label }) => {
    const saved = handover?.steps.find((step) => step.type === type);
    return { type, label, status: saved?.status ?? "pending", failureReason: saved?.failureReason };
  });
  return {
    steps,
    passed: steps.filter((step) => step.status === "passed").length,
    total: steps.length,
    next: handover?.setup?.status === "in_progress" && handover.eligibility?.canWorkSetup
      ? steps.find((step) => step.type === handover.calibration.nextStep)
      : undefined,
  };
}

export type BookingNextAction =
  | "assign-driver"
  | "outgoing"
  | "prepare-handover"
  | "view-setup"
  | "calibration-pending"
  | "start-rental"
  | "receive-vehicle"
  | "review-late-charge"
  | "incoming"
  | "review-charges"
  | "complete";

export function nextBookingAction(booking: BookingRecord): BookingNextAction | null {
  if (booking.statusKey === "confirmed") {
    if (booking.driverOption === "owners_driver" && !booking.assignedDriver) return "assign-driver";
    if (!booking.rentalProgress?.outgoingFinalized && !booking.telematicsHandover?.eligibility?.testMode) return "outgoing";
    if (booking.telematicsSetupStatus === "ready_for_release") return "start-rental";
    if (booking.telematicsSetupStatus === "in_progress") {
      return bookingCalibrationProgress(booking).next ? "calibration-pending" : "view-setup";
    }
    if (booking.telematicsSetupStatus === "released") return "view-setup";
    return "prepare-handover";
  }

  if (booking.statusKey === "ongoing") {
    if (!booking.lateReturn?.vehicleReceivedAt) return "receive-vehicle";
    if (!booking.rentalProgress?.incomingFinalized) return "incoming";
    if ((booking.lateReturn?.billableHours ?? 0) > 0 && !booking.lateReturn?.reviewedAt) return "review-late-charge";
    return "review-charges";
  }

  if (booking.statusKey === "returned") return "complete";
  return null;
}

export const bookingActionLabels: Record<BookingNextAction, string> = {
  "assign-driver": "Assign Driver",
  outgoing: "Start Outgoing Inspection",
  "prepare-handover": "Continue Preparation",
  "view-setup": "View Setup Progress",
  "calibration-pending": "Calibration Pending",
  "start-rental": "Start Rental",
  "receive-vehicle": "Record Vehicle Received",
  "review-late-charge": "Review Late Return Charge",
  incoming: "Start Incoming Inspection",
  "review-charges": "Review Return Charges",
  complete: "Complete Booking",
};
