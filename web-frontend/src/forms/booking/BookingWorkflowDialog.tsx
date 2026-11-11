"use client";

import {
  Fragment,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Car, CheckCircle2, ReceiptText } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingDialogFooter } from "@/modules/management/bookings/components/BookingDialogFooter";
import { Card, CardContent } from "@/components/ui/card";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import {
  FormDialogContent,
  FormDialogHeader,
} from "@/components/common/forms/FormDialogLayout";
import { appToast } from "@/lib/toast";
import { ApiError, OwnerVerificationCancelled } from "@/services/http";
import {
  assignDriver,
  completeBooking,
  deleteAdditionalCharge,
  finalizeBookingReturn,
  getBooking,
  getDrivers,
  startRental,
  startTelematicsHandover,
  type BookingRecord,
  type AdditionalChargeRecord,
  type DriverCandidate,
} from "@/services/booking";
import {
  assignDriverSchema,
  type AssignDriverFormValues,
} from "@/validations/booking/schemas";
import {
  bookingActionLabels,
  bookingCalibrationProgress,
  nextBookingAction,
  setupStepsPassed,
  TELEMATICS_DEVICE_STEPS,
} from "@/modules/management/bookings/booking-next-action";
import {
  bookingActionBlockers,
  bookingWorkflowPhase,
  bookingWorkflowSteps,
  bookingWorkflowTitles,
  customerSettlementPending,
  previousBookingWorkflowStep,
  type BookingWorkflowAction,
} from "@/modules/management/bookings/booking-workflow";
import { BookingWorkflowProgress } from "@/modules/management/bookings/components/BookingWorkflowProgress";
import { BookingInspectionForm } from "./BookingInspectionForm";
import { ReceiveVehicleForm } from "./ReceiveVehicleForm";
import { LateReturnChargeForm } from "./LateReturnChargeForm";
import { LateReturnSummary } from "@/modules/management/bookings/components/LateReturnSummary";
import { AdditionalChargesForm } from "./AdditionalChargesForm";
import { BookingStageContent } from "./BookingDetailsDialog";
import { formatReturnDateTime } from "@/services/booking/return-time";

function Requirements({ items }: { items: string[] }) {
  return items.length ? (
    <div
      role="status"
      className="rounded-xl border border-warning-border bg-warning-surface p-3 text-xs text-foreground"
    >
      {items.length === 1 ? (
        <p>{items[0]}</p>
      ) : (
        <>
          <p className="font-semibold">Resolve these requirements to continue</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  ) : null;
}

function WorkflowPanel({
  children,
  footer,
}: {
  children: ReactNode;
  footer: ReactNode;
}) {
  const actions =
    isValidElement<{ children: ReactNode }>(footer) && footer.type === Fragment
      ? footer.props.children
      : footer;
  return (
    <>
      <div
        data-workflow-body
        className="min-h-0 min-w-0 flex-auto overflow-y-auto overscroll-contain"
      >
        <div className="space-y-3 p-4 sm:p-5">{children}</div>
      </div>
      <BookingDialogFooter>{actions}</BookingDialogFooter>
    </>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);
}

function BookingContext({ booking, columns = 2 }: { booking: BookingRecord; columns?: 2 | 3 }) {
  return (
    <Card className="gap-0 rounded-xl border border-border bg-background py-3 ring-0">
      <CardContent>
        <dl className={`grid gap-x-4 gap-y-3 text-xs ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <div>
            <dt className="text-muted-foreground">Vehicle</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {[booking.brand, booking.vehicleName, booking.model]
                .filter(Boolean)
                .join(" ")}
              {booking.vehiclePlateNumber ? <span className="mt-1 block text-xs font-normal text-muted-foreground">{booking.vehiclePlateNumber}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {booking.customer?.name ?? "Not recorded"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Rental type</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {booking.driverOption === "self_drive"
                ? "Self Drive"
                : "With Assigned Driver"}
            </dd>
          </div>
          {booking.driverOption === "owners_driver" ? (
            <div>
              <dt className="text-muted-foreground">Assigned Driver</dt>
              <dd className="mt-1 font-semibold text-foreground">
                {booking.assignedDriver?.name ?? "Not assigned"}
              </dd>
            </div>
          ) : ["returned", "completed"].includes(booking.statusKey) ? (
            <div>
              <dt className="text-muted-foreground">Vehicle received</dt>
              <dd className="mt-1 font-semibold text-foreground">
                {formatReturnDateTime(booking.lateReturn?.vehicleReceivedAt)}
              </dd>
            </div>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
}

function CustomerBalance({ booking }: { booking: BookingRecord }) {
  const pending = customerSettlementPending(booking);
  if (!pending) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background p-3 text-xs">
      <span className="text-muted-foreground">Customer balance</span>
      <strong className="text-base text-foreground">
        {money(booking.remainingBalance)}
      </strong>
    </div>
  );
}

export function BookingWorkflowDialog({
  action,
  booking,
  onClose,
  onUpdated,
}: {
  action: BookingWorkflowAction;
  booking: BookingRecord;
  onClose: () => void;
  onUpdated: (booking: BookingRecord) => void;
}) {
  const [currentAction, setCurrentAction] =
    useState<BookingWorkflowAction | null>(action);
  const [phase] = useState(() => bookingWorkflowPhase(action));
  const [reviewAction, setReviewAction] = useState<BookingWorkflowAction | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [savedAction, setSavedAction] = useState<BookingWorkflowAction | null>(
    null,
  );
  const [chargeEntryOpen, setChargeEntryOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<AdditionalChargeRecord>();
  const [deletingCharge, setDeletingCharge] = useState<AdditionalChargeRecord>();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [drivers, setDrivers] = useState<DriverCandidate[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driversError, setDriversError] = useState(false);
  const [driversReload, setDriversReload] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const confirmationButtonRef = useRef<HTMLButtonElement>(null);
  const driverForm = useForm<AssignDriverFormValues>({
    resolver: zodResolver(assignDriverSchema),
    defaultValues: {
      driver_id: booking.assignedDriver
        ? String(booking.assignedDriver.id)
        : "",
    },
  });
  const selectedDriver = useWatch({
    control: driverForm.control,
    name: "driver_id",
  });
  const busy = isActing || formBusy || refreshing;
  const steps = bookingWorkflowSteps(booking, phase);
  const previousStep = previousBookingWorkflowStep(booking, phase, reviewAction ?? currentAction);
  const currentStepLabel = steps.find((step) => step.key === currentAction)?.label
    ?? (currentAction === "calibration-pending" ? "Setup" : "Booking");
  const returnToCurrent = () => setReviewAction(null);
  const previous = () => {
    if (!busy && previousStep) setReviewAction(previousStep.key);
  };
  const previousButton = <Button type="button" variant="outline" disabled={busy || !previousStep} onClick={previous}>Previous</Button>;
  const returnButton = <Button type="button" disabled={busy} onClick={returnToCurrent}>Back to {currentStepLabel}</Button>;
  const reviewingDriver = reviewAction === "assign-driver" && booking.statusKey === "confirmed";
  const driverChanged = selectedDriver !== (booking.assignedDriver ? String(booking.assignedDriver.id) : "");
  const close = () => {
    if (!busy) onClose();
  };
  const blockers = bookingActionBlockers(booking, currentAction);
  const visibleBlockers =
    currentAction === "complete"
      ? bookingActionBlockers(booking, currentAction, {
          includeSettlement: false,
        })
      : blockers;
  const calibration = bookingCalibrationProgress(booking);
  const deviceChecksPassed = setupStepsPassed(booking, TELEMATICS_DEVICE_STEPS);
  const operatorLabel = booking.driverOption === "owners_driver" ? "The assigned driver" : "The renter";

  useEffect(() => {
    const visibleContent = contentRef.current?.querySelector<HTMLElement>(
      reviewAction ? "[data-workflow-review]" : "[data-workflow-current]",
    );
    const body = visibleContent?.querySelector<HTMLElement>("[data-workflow-body]");
    if (body) body.scrollTop = 0;
    visibleContent
      ?.querySelector<HTMLHeadingElement>("[data-workflow-heading]")
      ?.focus({ preventScroll: true });
  }, [currentAction, reviewAction, chargeEntryOpen, savedAction]);

  useEffect(() => {
    if (
      currentAction !== "assign-driver" &&
      currentAction !== "reassign-driver" &&
      !reviewingDriver
    )
      return;
    let ignore = false;
    void getDrivers()
      .then((records) => {
        if (!ignore) {
          setDrivers(records);
          setDriversError(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setDriversError(true);
          appToast.error("Available drivers could not be loaded.");
        }
      })
      .finally(() => {
        if (!ignore) setDriversLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [currentAction, reviewingDriver, driversReload]);

  useEffect(() => {
    const waitingForSetup =
      ["view-setup", "calibration-pending"].includes(currentAction ?? "") &&
      booking.telematicsSetupStatus === "in_progress";
    const waitingForPayment =
      currentAction === "complete" && booking.statusKey === "returned";
    const waitingForRelease =
      currentAction === "start-rental" && booking.statusKey === "confirmed";
    const waitingForInspection =
      currentAction === "outgoing" && booking.statusKey === "confirmed" &&
      !booking.readiness?.outgoingInspectionTimeEligible;
    if (
      (!waitingForSetup && !waitingForPayment && !waitingForRelease && !waitingForInspection) ||
      savedAction ||
      refreshing ||
      (confirmationOpen && !waitingForRelease)
    )
      return;
    let ignore = false;
    const interval = window.setInterval(() => {
      void getBooking(booking.backendId)
        .then((record) => {
          if (ignore) return;
          const nextAction = phase === "prepare" && record.statusKey !== "confirmed"
            ? null
            : nextBookingAction(record);
          if (currentAction === "start-rental" && nextAction !== "start-rental") {
            setConfirmationOpen(false);
          }
          onUpdated(record);
          setCurrentAction(nextAction);
          setRefreshError(false);
        })
        .catch(() => {
          if (!ignore) setRefreshError(true);
        });
    }, 5000);
    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, [
    currentAction,
    booking.backendId,
    booking.statusKey,
    booking.telematicsSetupStatus,
    booking.readiness?.outgoingInspectionTimeEligible,
    phase,
    onUpdated,
    savedAction,
    refreshing,
    confirmationOpen,
  ]);

  const refreshSaved = async (completedAction: BookingWorkflowAction) => {
    setSavedAction(completedAction);
    setReviewAction(null);
    setRefreshing(true);
    setRefreshError(false);
    try {
      const latest = await getBooking(booking.backendId);
      onUpdated(latest);
      driverForm.reset({ driver_id: latest.assignedDriver ? String(latest.assignedDriver.id) : "" });
      setChargeEntryOpen(false);
      setEditingCharge(undefined);
      setCurrentAction(
        completedAction === "start-rental" ||
          (phase === "prepare" && latest.statusKey !== "confirmed")
          ? null
          : nextBookingAction(latest),
      );
      setSavedAction(null);
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  };

  const refreshBooking = async () => {
    if (savedAction) return refreshSaved(savedAction);
    setRefreshing(true);
    setRefreshError(false);
    try {
      const latest = await getBooking(booking.backendId);
      onUpdated(latest);
      setCurrentAction(
        phase === "prepare" && latest.statusKey !== "confirmed"
          ? null
          : nextBookingAction(latest),
      );
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  };

  const run = async (operation: () => Promise<unknown>, success: string) => {
    if (
      busy ||
      !currentAction ||
      blockers.length > 0 ||
      (currentAction === "start-rental" && refreshError)
    )
      return;
    setIsActing(true);
    try {
      await operation();
      appToast.success(success);
      setConfirmationOpen(false);
      await refreshSaved(currentAction);
    } catch (error) {
      appToast.error(error instanceof ApiError && error.errors?.booking?.[0]
        ? error.errors.booking[0]
        : currentAction === "review-charges" ? "Return processing could not be finalized. Check the requirements and try again."
          : `${currentAction === "reassign-driver" ? "Reassign Driver" : bookingActionLabels[currentAction]} could not be completed. Check the requirements and try again.`);
    } finally {
      setIsActing(false);
    }
  };

  const assign = driverForm.handleSubmit(
    async (values) => {
      if (busy) return;
      setIsActing(true);
      try {
        await assignDriver(booking, Number(values.driver_id));
        appToast.success("Driver assigned successfully.");
        await refreshSaved(
          currentAction === "reassign-driver"
            ? "reassign-driver"
            : "assign-driver",
        );
      } catch (error) {
        if (error instanceof ApiError && error.errors?.driver_id?.[0])
          driverForm.setError("driver_id", {
            type: "server",
            message: error.errors.driver_id[0],
          });
        else
          driverForm.setError("root", {
            type: "server",
            message: "The driver could not be assigned. Please try again.",
          });
        appToast.error(
          "The driver could not be assigned. Check availability and try again.",
        );
      } finally {
        setIsActing(false);
      }
    },
    () => appToast.error("Select a driver to assign."),
  );

  const confirmation =
    currentAction === "review-charges"
      ? {
          title: "Finalize Charges & Mark Returned",
          heading: "Finalize Charges & Mark Returned",
          confirmLabel: "Confirm Return",
          description:
            "This locks return charges and marks the vehicle as Returned. Any unpaid customer balance remains due.",
          operation: finalizeBookingReturn,
          success: "Charges finalized and vehicle marked Returned.",
        }
      : currentAction === "start-rental"
        ? {
            title: "Start Rental",
            heading: "Confirm Rental Release",
            confirmLabel: "Confirm Release",
            description:
              "Release the vehicle and change this booking to Ongoing?",
            operation: startRental,
            success: "Rental started successfully.",
          }
        : currentAction === "complete"
          ? {
              title: "Complete Booking",
              heading: "Confirm Booking Completion",
              confirmLabel: "Complete Booking",
              description: "Close this settled booking as Completed?",
              operation: completeBooking,
              success: "Booking completed successfully.",
            }
          : null;

  const deleteCharge = async () => {
    if (busy || !deletingCharge) return;
    setIsActing(true);
    try {
      await deleteAdditionalCharge(booking, deletingCharge.id);
      setDeletingCharge(undefined);
      appToast.success("Return charge deleted.");
      await refreshSaved("review-charges");
    } catch (error) {
      if (error instanceof OwnerVerificationCancelled) return;
      appToast.error(error instanceof ApiError && error.errors?.charges?.[0]
        ? error.errors.charges[0] : "The charge could not be deleted. Refresh the booking and try again.");
    } finally { setIsActing(false); }
  };

  const chargeSummary = (
    <section className="space-y-3">
      <h2
        data-workflow-heading={chargeEntryOpen ? undefined : ""}
        tabIndex={-1}
        className="text-sm font-semibold text-foreground"
      >
        Review Return Charges
      </h2>
      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-xs font-semibold text-foreground">
          View finalized Incoming Inspection
        </summary>
        <div className="mt-3">
          <BookingStageContent stage="incoming" booking={booking} />
        </div>
      </details>
      <LateReturnSummary booking={booking} />
      <BookingStageContent stage="charges" booking={booking} chargeActions={{
        disabled: busy,
        onEdit: (charge) => { setEditingCharge(charge); setChargeEntryOpen(true); },
        onDelete: setDeletingCharge,
      }} />
    </section>
  );

  const driverContent = (
      <form
        className="flex min-h-0 flex-auto flex-col overflow-hidden"
        onSubmit={(event) => {
          if (booking.assignedDriver && !driverChanged) {
            event.preventDefault();
            if (reviewingDriver) returnToCurrent();
            else setCurrentAction(nextBookingAction(booking));
            return;
          }
          void assign(event);
        }}
        noValidate
      >
        <div
          data-workflow-body
          className="min-h-0 flex-auto overflow-y-auto overscroll-contain"
        >
          <div className="space-y-4 p-4 sm:p-6">
              <h2
                data-workflow-heading
                tabIndex={-1}
                className={currentAction === "reassign-driver" || reviewingDriver ? "text-sm font-semibold text-foreground" : "sr-only"}
              >
                {currentAction === "reassign-driver" || reviewingDriver ? "Reassign Driver" : "Assign Driver"}
              </h2>
            {driverForm.formState.errors.root?.message ? (
              <p role="alert" className="text-xs text-destructive">
                {driverForm.formState.errors.root.message}
              </p>
            ) : null}
            <SelectWithLabel
              id="booking-driver"
              label="Driver"
              required
              disabled={busy || driversLoading || driversError}
              placeholder="Select a driver"
              options={drivers.map((driver) => ({
                value: String(driver.id),
                label: driver.name,
                description: driver.hasOutstandingBalance ? "Outstanding balance" : undefined,
                disabled: driver.hasOutstandingBalance,
              }))}
              value={selectedDriver}
              onValueChange={(value) =>
                driverForm.setValue("driver_id", value, { shouldDirty: true })
              }
              error={driverForm.formState.errors.driver_id?.message}
            />
            {driversLoading ? (
              <p role="status" className="text-xs text-muted-foreground">
                Loading available drivers...
              </p>
            ) : driversError ? (
              <div className="space-y-2">
                <p role="alert" className="text-xs text-destructive">
                  Drivers could not be loaded.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDriversLoading(true);
                    setDriversReload((value) => value + 1);
                  }}
                >
                  Retry
                </Button>
              </div>
            ) : drivers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No drivers are available.
              </p>
            ) : null}
          </div>
        </div>
        <BookingDialogFooter>
          {previousButton}
          <Button
            type="submit"
            disabled={
              busy || ((!booking.assignedDriver || driverChanged) && (driversLoading || driversError || drivers.length === 0))
            }
          >
            {isActing ? "Saving..." : booking.assignedDriver && !driverChanged
              ? `Back to ${reviewingDriver ? currentStepLabel : steps.find((step) => step.key === nextBookingAction(booking))?.label ?? "Booking"}`
              : "Save & Continue"}
          </Button>
        </BookingDialogFooter>
      </form>
  );

  let content: ReactNode;
  if (savedAction) {
    content = (
      <WorkflowPanel
        footer={
          <>
            <Button variant="outline" disabled>Previous</Button>
            <Button
              disabled={busy}
              onClick={() => void refreshSaved(savedAction)}
            >
              {refreshing ? "Refreshing..." : "Refresh Booking"}
            </Button>
          </>
        }
      >
        <h2
          data-workflow-heading
          tabIndex={-1}
          className="text-sm font-semibold text-foreground"
        >
          Your action was saved
        </h2>
        <p role="status" className="text-xs text-muted-foreground">
          {refreshError
            ? "The latest booking details could not be loaded. Refresh to continue. Your saved action will not be repeated."
            : "Loading the next step..."}
        </p>
      </WorkflowPanel>
    );
  } else if (!currentAction) {
    content = (
      <WorkflowPanel
        footer={previousButton}
      >
        <div role="status" className="flex items-center gap-3">
          <CheckCircle2 className="size-5 text-success" />
          <h2
            data-workflow-heading
            tabIndex={-1}
            className="text-sm font-semibold text-foreground"
          >
            {booking.statusKey === "ongoing"
              ? "Rental Started"
              : "Booking " + booking.adminStatus}
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {booking.statusKey === "ongoing"
            ? "Rental preparation is complete. Open Process Return when the vehicle comes back."
            : "The booking has no further action in this workflow."}
        </p>
      </WorkflowPanel>
    );
  } else if (currentAction === "receive-vehicle") {
    content = (
      <ReceiveVehicleForm
        booking={booking}
        onCancel={previous}
        previousDisabled={!previousStep}
        onBusyChange={setFormBusy}
        onSaved={() => refreshSaved("receive-vehicle")}
      />
    );
  } else if (currentAction === "review-late-charge") {
    content = (
      <LateReturnChargeForm
        booking={booking}
        onCancel={previous}
        previousDisabled={!previousStep}
        onBusyChange={setFormBusy}
        onSaved={() => refreshSaved("review-late-charge")}
      />
    );
  } else if (
    (currentAction === "outgoing" || currentAction === "incoming") &&
    blockers.length === 0
  ) {
    content = (
      <BookingInspectionForm
        key={currentAction}
        type={currentAction}
        booking={booking}
        onClose={previous}
        previousDisabled={!previousStep}
        onBusyChange={setFormBusy}
        onSaved={() => refreshSaved(currentAction)}
      />
    );
  } else if (
    currentAction === "assign-driver" ||
    currentAction === "reassign-driver"
  ) {
    content = driverContent;
  } else if (currentAction === "prepare-handover") {
    content = (
      <WorkflowPanel
        footer={
          <>
            {previousButton}
            <Button
              disabled={
                busy ||
                !booking.telematicsHandover?.eligibility?.canStartHandover
              }
              onClick={() =>
                void run(
                  () => startTelematicsHandover(booking),
                  "Telematics handover started.",
                )
              }
            >
              {isActing ? "Starting..." : "Continue to Setup"}
            </Button>
          </>
        }
      >
        <h2
          data-workflow-heading
          tabIndex={-1}
          className="text-sm font-semibold text-foreground"
        >
          {booking.rentalProgress?.outgoingFinalized ? "Outgoing Inspection" : "Rental Preparation"}
        </h2>
        <Requirements items={visibleBlockers} />
        {booking.rentalProgress?.outgoingFinalized ? (
          <details className="rounded-xl border border-border p-3 text-xs text-foreground">
            <summary className="cursor-pointer font-semibold">View finalized Outgoing Inspection</summary>
            <div className="mt-3"><BookingStageContent stage="outgoing" booking={booking} /></div>
          </details>
        ) : <BookingContext booking={booking} />}
      </WorkflowPanel>
    );
  } else if (
    currentAction === "view-setup" ||
    currentAction === "calibration-pending"
  ) {
    content = (
      <WorkflowPanel
        footer={
          <>
            {previousButton}
            <Button disabled={busy} onClick={() => void refreshBooking()}>
              {refreshing ? "Refreshing..." : "Refresh Progress"}
            </Button>
          </>
        }
      >
        <h2
          data-workflow-heading
          tabIndex={-1}
          className="text-sm font-semibold text-foreground"
        >
          {bookingActionLabels[currentAction]}
        </h2>
        {currentAction === "calibration-pending" || !deviceChecksPassed ? (
          <p role="status" className="text-xs leading-5 text-muted-foreground">
            {currentAction === "calibration-pending"
              ? `${operatorLabel} completes Stationary and Forward Reference in the mobile app. ${calibration.passed} of ${calibration.total} passed.`
              : `${operatorLabel} completes the device checks in the mobile app before calibration.`}
          </p>
        ) : null}
        {currentAction === "calibration-pending" ? (
          <>
            <BookingStageContent stage="calibration" booking={booking} />
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-xs font-semibold text-foreground">
                Device checks — complete
              </summary>
              <div className="mt-3">
                <BookingStageContent stage="device-setup" booking={booking} />
              </div>
            </details>
          </>
        ) : (
          <>
            <BookingStageContent stage="device-setup" booking={booking} />
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-xs font-semibold text-foreground">
                Calibration requirements
              </summary>
              <div className="mt-3">
                <BookingStageContent stage="calibration" booking={booking} />
              </div>
            </details>
          </>
        )}
      </WorkflowPanel>
    );
  } else if (currentAction === "review-charges" && chargeEntryOpen) {
    content = (
      <AdditionalChargesForm
        key={editingCharge?.id ?? "new"}
        booking={booking}
        editingCharge={editingCharge}
        onCancel={() => { setChargeEntryOpen(false); setEditingCharge(undefined); }}
        onBusyChange={setFormBusy}
        onSaved={() => refreshSaved("review-charges")}
      />
    );
  } else if (currentAction === "review-charges") {
    content = (
      <WorkflowPanel
        footer={
          <>
            {previousButton}
            <Button ref={confirmationButtonRef} disabled={busy || blockers.length > 0} onClick={() => setConfirmationOpen(true)}>
              Finalize Charges &amp; Mark Returned
            </Button>
          </>
        }
      >
        {chargeSummary}
        <Requirements items={visibleBlockers} />
        {!booking.returnChargesFinalizedAt ? <Button variant="outline" disabled={busy} onClick={() => { setEditingCharge(undefined); setChargeEntryOpen(true); }}>
          Add Charges
        </Button> : null}
      </WorkflowPanel>
    );
  } else {
    content = (
      <WorkflowPanel
        footer={
          <>
            {previousButton}
            {confirmation ? (
              <Button
                ref={confirmationButtonRef}
                disabled={
                  busy ||
                  blockers.length > 0 ||
                  (currentAction === "start-rental" && refreshError)
                }
                onClick={() => setConfirmationOpen(true)}
              >
                {confirmation.title}
              </Button>
            ) : (
              <Button disabled={busy} onClick={() => void refreshBooking()}>
                {refreshing ? "Refreshing..." : "Refresh Requirements"}
              </Button>
            )}
          </>
        }
      >
        <div className={currentAction === "start-rental" ? "sr-only" : "flex flex-wrap items-center justify-between gap-2"}>
          <h2
            data-workflow-heading
            tabIndex={-1}
            className="text-sm font-semibold text-foreground"
          >
            {bookingActionLabels[currentAction]}
          </h2>
          {currentAction === "complete" && booking.statusKey === "returned" && booking.readiness && customerSettlementPending(booking) ? (
            <Badge role="status" className="ml-auto border-warning-border bg-warning-surface text-warning">
              Awaiting settlement
            </Badge>
          ) : null}
        </div>
        {currentAction === "start-rental" ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {calibration.passed === calibration.total
              ? "Stationary and Forward Reference passed. Review this rental before confirming release."
              : "Review this rental before confirming release."}
          </p>
        ) : null}
        <BookingContext booking={booking} columns={currentAction === "start-rental" ? 3 : 2} />
        <Requirements items={visibleBlockers} />
        {confirmation ? <CustomerBalance booking={booking} /> : null}
        {(blockers.length > 0 || refreshError) && confirmation && currentAction !== "complete" && currentAction !== "start-rental" ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void refreshBooking()}
          >
            {refreshing ? "Refreshing..." : "Refresh Requirements"}
          </Button>
        ) : null}
      </WorkflowPanel>
    );
  }

  let reviewContent: ReactNode;
  if (reviewAction) {
    const reviewLabel = steps.find((step) => step.key === reviewAction)?.label ?? "Booking";
    let savedDetails: ReactNode;
    if (reviewAction === "outgoing" || reviewAction === "incoming") {
      savedDetails = <BookingStageContent stage={reviewAction} booking={booking} />;
    } else if (reviewAction === "view-setup") {
      savedDetails = <><BookingStageContent stage="device-setup" booking={booking} /><BookingStageContent stage="calibration" booking={booking} /></>;
    } else if (reviewAction === "review-charges") {
      savedDetails = <BookingStageContent stage="charges" booking={booking} />;
    } else if (reviewAction === "review-late-charge") {
      savedDetails = <LateReturnSummary booking={booking} />;
    } else if (reviewAction === "receive-vehicle") {
      savedDetails = <dl className="grid gap-3 text-xs sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Scheduled return</dt><dd className="mt-1 font-semibold text-foreground">{formatReturnDateTime(booking.rentalEndAt)}</dd></div>
        <div><dt className="text-muted-foreground">Date and time received</dt><dd className="mt-1 font-semibold text-foreground">{formatReturnDateTime(booking.lateReturn?.vehicleReceivedAt)}</dd></div>
      </dl>;
    } else {
      const savedTime = reviewAction === "complete" ? booking.completedAt
          : reviewAction === "assign-driver" ? booking.driverAssignedAt
            : booking.telematicsHandover?.setup?.releasedAt;
      savedDetails = <><BookingContext booking={booking} />{savedTime ? <p className="text-xs text-muted-foreground">{formatReturnDateTime(savedTime)}</p> : null}</>;
    }
    reviewContent = reviewingDriver ? driverContent : <WorkflowPanel footer={<>{previousButton}{returnButton}</>}>
      <h2 data-workflow-heading tabIndex={-1} className="text-sm font-semibold text-foreground">{reviewLabel}</h2>
      {savedDetails}
    </WorkflowPanel>;
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <FormDialogContent
        ref={contentRef}
        width={
          reviewAction === "outgoing" || reviewAction === "incoming" ? "wide"
            : reviewingDriver ? "compact"
            : reviewAction ? "default"
            : savedAction ||
          !currentAction ||
          ["assign-driver", "reassign-driver"].includes(currentAction)
            ? "compact"
            : ["outgoing", "incoming"].includes(currentAction) &&
                blockers.length === 0
              ? "wide"
              : "default"
        }
        onEscapeKeyDown={(event) => {
          if (busy || confirmationOpen) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy || confirmationOpen) event.preventDefault();
        }}
      >
        <FormDialogHeader
          title={bookingWorkflowTitles[phase]}
          icon={phase === "prepare" ? Car : ReceiptText}
          onClose={close}
          closeDisabled={busy}
          closeLabel="Close booking workflow"
          className="py-3"
          endContent={<span className="text-sm font-semibold text-foreground">{booking.bookingCode}</span>}
        />
        <BookingWorkflowProgress
          booking={booking}
          phase={phase}
          action={reviewAction ?? currentAction}
        />
        {booking.telematicsHandover?.eligibility?.testMode &&
        phase === "prepare" ? (
          <p
            role="status"
            className="shrink-0 bg-warning-surface px-4 py-2 text-xs text-foreground sm:px-6"
          >
            Handover test mode is enabled. Readiness requirements are relaxed
            for local testing; check results remain real.
          </p>
        ) : null}
        {refreshError && !savedAction ? (
          <p
            role="alert"
            className="shrink-0 px-4 py-2 text-xs text-destructive sm:px-6"
          >
            {currentAction === "complete" || currentAction === "start-rental"
              ? "Booking updates could not be loaded. Retrying automatically..."
              : "Booking updates could not be loaded. Refresh to check the latest state."}
          </p>
        ) : null}
        <div data-workflow-current hidden={Boolean(reviewAction)} className={reviewAction ? "hidden" : "flex min-h-0 flex-auto flex-col"}>
          {content}
        </div>
        {reviewAction ? <div data-workflow-review className="flex min-h-0 flex-auto flex-col">{reviewContent}</div> : null}
      </FormDialogContent>
      <AlertDialog open={Boolean(deletingCharge)} onOpenChange={(open) => { if (!open && !busy) setDeletingCharge(undefined); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete return charge?</AlertDialogTitle>
            <AlertDialogDescription>Remove {deletingCharge?.typeLabel} ({money(deletingCharge?.amount ?? 0)}) from this booking?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => void deleteCharge()}>{isActing ? "Deleting..." : "Delete Charge"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={confirmationOpen && Boolean(confirmation) && !reviewAction}
        onOpenChange={(open) => {
          if (!busy) setConfirmationOpen(open);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            confirmationButtonRef.current?.focus({ preventScroll: true });
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.heading}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Requirements items={visibleBlockers} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Back to Review</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || blockers.length > 0 || (currentAction === "start-rental" && refreshError)}
              onClick={(event) => {
                event.preventDefault();
                if (confirmation) void run(() => confirmation.operation(booking), confirmation.success);
              }}
            >
              {isActing ? "Saving..." : confirmation?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
