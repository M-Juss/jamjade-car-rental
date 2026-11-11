import type { BookingRecord } from "@/services/booking";
import type { BookingNextAction } from "./booking-next-action";

export type BookingWorkflowAction = BookingNextAction | "reassign-driver";
export type BookingWorkflowPhase = "prepare" | "return" | "finish";
export type BookingWorkflowStep = {
  key: BookingWorkflowAction;
  label: string;
  done: boolean;
};

export function bookingWorkflowPhase(
  action: BookingWorkflowAction,
): BookingWorkflowPhase {
  if (action === "complete") return "finish";
  if (
    [
      "receive-vehicle",
      "incoming",
      "review-late-charge",
      "review-charges",
    ].includes(action)
  )
    return "return";
  return "prepare";
}

export const bookingWorkflowTitles: Record<BookingWorkflowPhase, string> = {
  prepare: "Prepare Rental",
  return: "Process Return",
  finish: "Finish Booking",
};

export function bookingWorkflowSteps(
  booking: BookingRecord,
  phase: BookingWorkflowPhase,
): BookingWorkflowStep[] {
  const returned = ["returned", "completed"].includes(booking.statusKey);
  const released = ["ongoing", "returned", "completed"].includes(
    booking.statusKey,
  );
  const inspectionSkipped = Boolean(booking.telematicsHandover?.eligibility?.testMode && !booking.rentalProgress?.outgoingFinalized);
  if (phase === "prepare")
    return [
      ...(booking.driverOption === "owners_driver"
        ? [
            {
              key: "assign-driver" as const,
              label: "Assign Driver",
              done: Boolean(booking.assignedDriver),
            },
          ]
        : []),
      {
        key: "outgoing" as const,
        label: inspectionSkipped ? "Preparation" : "Outgoing Inspection",
        done: inspectionSkipped || Boolean(booking.rentalProgress?.outgoingFinalized),
      },
      {
        key: "view-setup" as const,
        label: "Setup",
        done: ["ready_for_release", "released"].includes(
          booking.telematicsSetupStatus ?? "",
        ),
      },
      { key: "start-rental", label: "Release", done: released },
    ];
  return [
    {
      key: "receive-vehicle",
      label: "Vehicle Received",
      done: Boolean(booking.lateReturn?.vehicleReceivedAt),
    },
    {
      key: "incoming",
      label: "Incoming Inspection",
      done: Boolean(booking.rentalProgress?.incomingFinalized),
    },
    ...((booking.lateReturn?.billableHours ?? 0) > 0 || booking.lateReturn?.reviewedAt
      ? [{ key: "review-late-charge" as const, label: "Late Charge", done: Boolean(booking.lateReturn?.reviewedAt) }]
      : []),
    {
      key: "review-charges",
      label: "Return Charges",
      done: Boolean(booking.returnChargesFinalizedAt) && returned,
    },
    {
      key: "complete",
      label: "Completion",
      done: booking.statusKey === "completed",
    },
  ];
}

export function bookingWorkflowStepKey(action: BookingWorkflowAction | null) {
  return action === "calibration-pending" ? "view-setup"
    : action === "prepare-handover" ? "outgoing"
    : action === "reassign-driver" ? "assign-driver" : action;
}

export function previousBookingWorkflowStep(
  booking: BookingRecord,
  phase: BookingWorkflowPhase,
  action: BookingWorkflowAction | null,
) {
  const steps = bookingWorkflowSteps(booking, phase);
  const index = action === null ? steps.length
    : steps.findIndex((step) => step.key === bookingWorkflowStepKey(action));
  return steps.slice(0, Math.max(0, index)).findLast((step) => step.done);
}

export function customerSettlementPending(booking: BookingRecord): boolean {
  return (
    booking.remainingBalance > 0 ||
    Boolean(booking.readiness && !booking.readiness.customerChargesSettled)
  );
}

function rentalTimingMessage(booking: BookingRecord, action: "Start Rental" | "Outgoing Inspection"): string {
  if (booking.attention?.key === "not_started")
    return `The rental period has ended. ${action} is unavailable.`;
  if (!booking.rentalStartAt || !booking.rentalEndAt)
    return `${action} is available only during the reserved rental period.`;

  const dateTime = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
  return `${action} is available from ${dateTime.format(new Date(booking.rentalStartAt))} until ${dateTime.format(new Date(booking.rentalEndAt))}.`;
}

export function bookingActionBlockers(
  booking: BookingRecord,
  action: BookingWorkflowAction | null,
  { includeSettlement = true }: { includeSettlement?: boolean } = {},
): string[] {
  const ready = booking.readiness;
  if (action === null) return [];
  if (action === "prepare-handover") {
    const eligibility = booking.telematicsHandover?.eligibility;
    return [
      eligibility?.customerSelfDriveAvailable === false &&
        "Resolve the customer's other active self-drive rental or handover first.",
      eligibility?.operatorAssigned === false && "Assign a rental operator before starting telematics setup.",
      eligibility?.operatorEligible === false && "Assign an active Driver before starting telematics setup.",
      !eligibility?.testMode &&
        !eligibility?.documentsVerified &&
        "Self-drive documents must be approved.",
      !eligibility?.rentalPeriodEligible &&
        (eligibility?.testMode
          ? "Test handover is available on the rental start date or during the reserved period, before it ends."
          : "Handover is available only within the reserved rental period."),
      !eligibility?.testMode &&
        !eligibility?.outgoingInspectionComplete &&
        "Finalize Outgoing Inspection with both signatures.",
    ].filter((item): item is string => Boolean(item));
  }
  if (action === "incoming")
    return [
      !booking.lateReturn?.vehicleReceivedAt &&
        "Record the vehicle as received first.",
      !booking.telematicsHandover?.eligibility?.testMode &&
        !booking.rentalProgress?.outgoingFinalized &&
        "A finalized Outgoing Inspection is required.",
      ["started", "paused"].includes(
        booking.rentalProgress?.latestTripStatus ?? "",
      ) && "End the active telematics trip before Incoming Inspection.",
      !booking.inspectionBaseline &&
        "The outgoing inspection baseline could not be loaded.",
    ].filter((item): item is string => Boolean(item));
  if (
    !["outgoing", "start-rental", "complete", "review-charges"].includes(action)
  )
    return [];
  if (!ready)
    return [
      "Booking readiness could not be loaded. Refresh the booking and try again.",
    ];
  if (action === "complete")
    return [
      booking.statusKey !== "returned" &&
        "The vehicle must be marked Returned first.",
      !ready.incomingFinalized && "Finalize Incoming Inspection.",
      !ready.returnChargesFinalized && "Finalize return-charge review.",
      includeSettlement &&
        customerSettlementPending(booking) &&
        "Customer balance and customer charges must be settled first.",
    ].filter((item): item is string => Boolean(item));
  if (action === "review-charges")
    return [
      booking.statusKey !== "ongoing" && "Return processing requires an ongoing booking.",
      !ready.vehicleReceived && "Record the vehicle as received first.",
      !ready.incomingFinalized && "Finalize Incoming Inspection.",
      (booking.lateReturn?.billableHours ?? 0) > 0 && !booking.lateReturn?.reviewedAt && "Review the late return charge.",
    ].filter((item): item is string => Boolean(item));
  return [
    !ready.bookingConfirmed && "Booking must be confirmed.",
    action === "outgoing" &&
      !ready.outgoingInspectionTimeEligible &&
      rentalTimingMessage(booking, "Outgoing Inspection"),
    action === "outgoing" &&
      !ready.paymentAcceptedForInspection &&
      "An accepted partial or full payment is required.",
    action === "start-rental" &&
      (!ready.fullyPaid || customerSettlementPending(booking)) &&
      "Full customer payment is required.",
    action === "start-rental" &&
      !ready.rentalPeriodEligible &&
      rentalTimingMessage(booking, "Start Rental"),
    (action === "start-rental" || (action === "outgoing" && booking.driverOption === "self_drive")) &&
      !ready.customerSelfDriveAvailable &&
      "Resolve the customer's other active self-drive rental or handover first.",
    !ready.ageEligible && "The renter must meet the age requirement.",
    !ready.documentsApproved && "Self-drive documents must be approved.",
    action === "start-rental" &&
      ready.emergencyContactOnFile === false &&
      "The renter must add an emergency contact before release.",
    !ready.driverAssigned && "Assign a driver before inspection.",
    !ready.driverEligible && "The assigned driver is not eligible.",
    !ready.vehicleOperational &&
      "The vehicle must be operational and available.",
    action === "outgoing" &&
      !booking.inspectionBaseline &&
      "Set a finalized current vehicle condition first.",
    action === "start-rental" &&
      !ready.outgoingFinalized &&
      "Finalize the Outgoing Inspection.",
    action === "start-rental" &&
      !ready.telematicsSetupReady &&
      "Complete Device Setup, Stationary, and Forward Reference in the mobile app before release.",
  ].filter((item): item is string => Boolean(item));
}
