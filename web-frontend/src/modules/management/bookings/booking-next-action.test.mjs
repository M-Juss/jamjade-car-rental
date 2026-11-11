import assert from "node:assert/strict";
import test from "node:test";
import { bookingCalibrationProgress, nextBookingAction, TELEMATICS_DEVICE_STEPS } from "./booking-next-action.ts";

function handoverBooking(driverOption) {
  return {
    statusKey: "confirmed",
    driverOption,
    assignedDriver: driverOption === "owners_driver" ? { id: 1 } : null,
    rentalProgress: { outgoingFinalized: true },
    telematicsSetupStatus: "in_progress",
    telematicsHandover: {
      eligibility: { canWorkSetup: true },
      setup: { status: "in_progress" },
      calibration: { nextStep: "forward_calibration" },
      steps: [
        ...TELEMATICS_DEVICE_STEPS.map((type) => ({ type, status: "passed" })),
        { type: "forward_calibration", status: "failed", failureReason: "Repeat the forward movement." },
        { type: "braking_calibration", status: "passed" },
        { type: "stationary_calibration", status: "passed" },
      ],
    },
  };
}

test("both rental types show the same ordered calibration checks and preserve retry feedback", () => {
  for (const rentalType of ["self_drive", "owners_driver"]) {
    const booking = handoverBooking(rentalType);
    const progress = bookingCalibrationProgress(booking);
    assert.deepEqual(progress.steps.map((step) => step.label), ["Stationary", "Forward Reference"]);
    assert.equal(progress.passed, 1);
    assert.equal(progress.total, 2);
    assert.equal(progress.next.failureReason, "Repeat the forward movement.");
    assert.equal(nextBookingAction(booking), "calibration-pending");
  }
});

test("release follows Laravel readiness, including when a calibration restart is needed", () => {
  const booking = handoverBooking("self_drive");
  const handover = booking.telematicsHandover;
  handover.steps.find((step) => step.type === "forward_calibration").status = "passed";
  handover.calibration.nextStep = null;
  assert.equal(bookingCalibrationProgress(booking).passed, 2);
  assert.equal(nextBookingAction(booking), "view-setup");

  booking.telematicsSetupStatus = "ready_for_release";
  handover.setup.status = "ready_for_release";
  assert.equal(bookingCalibrationProgress(booking).next, undefined);
  assert.equal(nextBookingAction(booking), "start-rental");

  booking.telematicsSetupStatus = "in_progress";
  handover.setup.status = "in_progress";
  handover.calibration.nextStep = "stationary_calibration";
  handover.steps = handover.steps.filter((step) => !["stationary_calibration", "forward_calibration"].includes(step.type));
  assert.equal(bookingCalibrationProgress(booking).passed, 0);
  assert.equal(bookingCalibrationProgress(booking).next.label, "Stationary");
  assert.equal(nextBookingAction(booking), "calibration-pending");
});
