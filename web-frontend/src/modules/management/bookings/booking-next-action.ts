import type { BookingRecord } from "@/services/booking";

export const TELEMATICS_DEVICE_STEPS = ["device_check", "motion_permission", "location_permission", "background_location", "gps_check", "geofence_check", "phone_mount"];
export const TELEMATICS_CALIBRATION_STEPS = ["stationary_calibration", "forward_calibration", "braking_calibration", "left_turn_calibration", "right_turn_calibration"];

export function setupStepsPassed(booking: BookingRecord, types: string[]) {
  const steps = booking.telematicsHandover?.steps ?? [];
  return types.every((type) => steps.some((step) => step.type === type && step.status === "passed"));
}

export type BookingNextAction =
  | "assign-driver"
  | "outgoing"
  | "prepare-handover"
  | "view-setup"
  | "calibration-pending"
  | "start-rental"
  | "incoming"
  | "review-charges"
  | "mark-returned"
  | "complete";

export function nextBookingAction(booking: BookingRecord): BookingNextAction | null {
  if (booking.statusKey === "confirmed") {
    if (booking.driverOption === "owners_driver" && !booking.assignedDriver) return "assign-driver";
    if (!booking.rentalProgress?.outgoingFinalized) return "outgoing";
    if (booking.driverOption === "self_drive") {
      if (booking.telematicsSetupStatus === "ready_for_release") return "start-rental";
      if (booking.telematicsSetupStatus === "in_progress") {
        return setupStepsPassed(booking, TELEMATICS_DEVICE_STEPS)
          ? "calibration-pending" : "view-setup";
      }
      if (booking.telematicsSetupStatus === "released") return "view-setup";
      return "prepare-handover";
    }
    return "start-rental";
  }

  if (booking.statusKey === "ongoing") {
    if (!booking.rentalProgress?.incomingFinalized) return "incoming";
    return booking.returnChargesFinalizedAt ? "mark-returned" : "review-charges";
  }

  if (booking.statusKey === "returned") return "complete";
  return null;
}

export const bookingActionLabels: Record<BookingNextAction, string> = {
  "assign-driver": "Assign Driver",
  outgoing: "Start Outgoing Inspection",
  "prepare-handover": "Prepare Handover",
  "view-setup": "View Setup Progress",
  "calibration-pending": "Calibration Pending",
  "start-rental": "Start Rental",
  incoming: "Start Incoming Inspection",
  "review-charges": "Review Return Charges",
  "mark-returned": "Mark Returned",
  complete: "Complete Booking",
};
