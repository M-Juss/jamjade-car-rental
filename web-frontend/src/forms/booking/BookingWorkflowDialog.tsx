"use client";

import { Fragment, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Car, CheckCircle2, ReceiptText } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookingDialogFooter } from "@/modules/management/bookings/components/BookingDialogFooter";
import { Card, CardContent } from "@/components/ui/card";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { FormDialogContent, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { appToast } from "@/lib/toast";
import { ApiError } from "@/services/http";
import { assignDriver, completeBooking, finalizeReturnCharges, getBooking, getDrivers, markBookingReturned, startRental, startTelematicsHandover, type BookingRecord, type DriverCandidate } from "@/services/booking";
import { assignDriverSchema, type AssignDriverFormValues } from "@/validations/booking/schemas";
import { bookingActionLabels, nextBookingAction } from "@/modules/management/bookings/booking-next-action";
import { bookingActionBlockers, bookingWorkflowPhase, bookingWorkflowTitles, type BookingWorkflowAction } from "@/modules/management/bookings/booking-workflow";
import { BookingWorkflowProgress } from "@/modules/management/bookings/components/BookingWorkflowProgress";
import { BookingInspectionForm } from "./BookingInspectionForm";
import { AdditionalChargesForm } from "./AdditionalChargesForm";
import { BookingStageContent } from "./BookingDetailsDialog";

function Requirements({ items }: { items: string[] }) {
  return items.length ? <div role="status" className="rounded-xl border border-warning-border bg-warning-surface p-3 text-xs text-foreground">
    <p className="font-semibold">Resolve these requirements to continue</p><ul className="mt-2 list-disc space-y-1 pl-5">{items.map((item) => <li key={item}>{item}</li>)}</ul>
  </div> : null;
}

function WorkflowPanel({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const actions = isValidElement<{ children: ReactNode }>(footer) && footer.type === Fragment ? footer.props.children : footer;
  return <><div data-workflow-body className="min-h-0 min-w-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-4 p-4 sm:p-6">{children}</div></div>
    <BookingDialogFooter>{actions}</BookingDialogFooter></>;
}

function money(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

function BookingContext({ booking }: { booking: BookingRecord }) {
  return <Card className="gap-0 rounded-xl border border-border bg-background py-3 ring-0"><CardContent>
    <dl className="grid gap-x-4 gap-y-3 text-xs sm:grid-cols-2">
      <div><dt className="text-muted-foreground">Vehicle</dt><dd className="mt-1 font-semibold text-foreground">{[booking.brand, booking.vehicleName, booking.model].filter(Boolean).join(" ")}</dd></div>
      <div><dt className="text-muted-foreground">Customer</dt><dd className="mt-1 font-semibold text-foreground">{booking.customer?.name ?? "Not recorded"}</dd></div>
      <div><dt className="text-muted-foreground">Rental type</dt><dd className="mt-1 font-semibold text-foreground">{booking.driverOption === "self_drive" ? "Self Drive" : "With Assigned Driver"}</dd></div>
      {booking.driverOption === "owners_driver" ? <div><dt className="text-muted-foreground">Assigned Driver</dt><dd className="mt-1 font-semibold text-foreground">{booking.assignedDriver?.name ?? "Not assigned"}</dd></div> : null}
    </dl>
  </CardContent></Card>;
}

function CustomerBalance({ booking }: { booking: BookingRecord }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background p-3 text-xs">
    <span className="text-muted-foreground">Customer balance</span><strong className="text-base text-foreground">{money(booking.remainingBalance)}</strong>
  </div>;
}

export function BookingWorkflowDialog({ action, booking, onClose, onUpdated }: {
  action: BookingWorkflowAction; booking: BookingRecord; onClose: () => void; onUpdated: (booking: BookingRecord) => void;
}) {
  const [currentAction, setCurrentAction] = useState<BookingWorkflowAction | null>(action);
  const [phase] = useState(() => bookingWorkflowPhase(action));
  const [isActing, setIsActing] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [savedAction, setSavedAction] = useState<BookingWorkflowAction | null>(null);
  const [chargeEntryOpen, setChargeEntryOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [drivers, setDrivers] = useState<DriverCandidate[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driversError, setDriversError] = useState(false);
  const [driversReload, setDriversReload] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const driverForm = useForm<AssignDriverFormValues>({ resolver: zodResolver(assignDriverSchema), defaultValues: { driver_id: booking.assignedDriver ? String(booking.assignedDriver.id) : "" } });
  const selectedDriver = useWatch({ control: driverForm.control, name: "driver_id" });
  const busy = isActing || formBusy || refreshing;
  const close = () => { if (!busy) onClose(); };
  const blockers = bookingActionBlockers(booking, currentAction);

  useEffect(() => {
    const body = contentRef.current?.querySelector<HTMLElement>("[data-workflow-body]");
    if (body) body.scrollTop = 0;
    contentRef.current?.querySelector<HTMLHeadingElement>("[data-workflow-heading]")?.focus({ preventScroll: true });
  }, [currentAction, chargeEntryOpen, savedAction, confirmationOpen]);

  useEffect(() => {
    if (currentAction !== "assign-driver" && currentAction !== "reassign-driver") return;
    let ignore = false;
    void getDrivers().then((records) => { if (!ignore) { setDrivers(records); setDriversError(false); } })
      .catch(() => { if (!ignore) { setDriversError(true); appToast.error("Available drivers could not be loaded."); } })
      .finally(() => { if (!ignore) setDriversLoading(false); });
    return () => { ignore = true; };
  }, [currentAction, driversReload]);

  useEffect(() => {
    const waitingForSetup = ["view-setup", "calibration-pending"].includes(currentAction ?? "") && booking.telematicsSetupStatus === "in_progress";
    const waitingForPayment = currentAction === "complete" && booking.statusKey === "returned";
    if ((!waitingForSetup && !waitingForPayment) || savedAction || refreshing || confirmationOpen) return;
    let ignore = false;
    const interval = window.setInterval(() => {
      void getBooking(booking.backendId).then((record) => {
        if (ignore) return;
        onUpdated(record);
        setCurrentAction(phase === "prepare" && record.statusKey !== "confirmed" ? null : nextBookingAction(record));
        setRefreshError(false);
      }).catch(() => { if (!ignore) setRefreshError(true); });
    }, 5000);
    return () => { ignore = true; window.clearInterval(interval); };
  }, [currentAction, booking.backendId, booking.statusKey, booking.telematicsSetupStatus, phase, onUpdated, savedAction, refreshing, confirmationOpen]);

  const refreshSaved = async (completedAction: BookingWorkflowAction) => {
    setSavedAction(completedAction);
    setRefreshing(true);
    setRefreshError(false);
    try {
      const latest = await getBooking(booking.backendId);
      onUpdated(latest);
      setChargeEntryOpen(false);
      setCurrentAction(completedAction === "start-rental" || phase === "prepare" && latest.statusKey !== "confirmed" ? null : nextBookingAction(latest));
      setSavedAction(null);
    } catch { setRefreshError(true); }
    finally { setRefreshing(false); }
  };

  const refreshBooking = async () => {
    if (savedAction) return refreshSaved(savedAction);
    setRefreshing(true);
    setRefreshError(false);
    try {
      const latest = await getBooking(booking.backendId);
      onUpdated(latest);
      setCurrentAction(phase === "prepare" && latest.statusKey !== "confirmed" ? null : nextBookingAction(latest));
    } catch { setRefreshError(true); }
    finally { setRefreshing(false); }
  };

  const run = async (operation: () => Promise<unknown>, success: string) => {
    if (busy || !currentAction) return;
    setIsActing(true);
    try {
      await operation();
      appToast.success(success);
      setConfirmationOpen(false);
      await refreshSaved(currentAction);
    } catch { appToast.error(`${currentAction === "reassign-driver" ? "Reassign Driver" : bookingActionLabels[currentAction]} could not be completed. Check the requirements and try again.`); }
    finally { setIsActing(false); }
  };

  const assign = driverForm.handleSubmit(async (values) => {
    if (busy) return;
    setIsActing(true);
    try {
      await assignDriver(booking, Number(values.driver_id));
      appToast.success("Driver assigned successfully.");
      await refreshSaved(currentAction === "reassign-driver" ? "reassign-driver" : "assign-driver");
    } catch (error) {
      if (error instanceof ApiError && error.errors?.driver_id?.[0]) driverForm.setError("driver_id", { type: "server", message: error.errors.driver_id[0] });
      else driverForm.setError("root", { type: "server", message: "The driver could not be assigned. Please try again." });
      appToast.error("The driver could not be assigned. Check availability and try again.");
    } finally { setIsActing(false); }
  }, () => appToast.error("Select a driver to assign."));

  const confirmation = currentAction === "review-charges"
    ? { title: "Finalize Return Charges", heading: "Finalize Return Charges", confirmLabel: "Confirm Finalization", description: "Finish the charge review for this return. You will confirm the physical vehicle return next.", operation: finalizeReturnCharges, success: "Return charges finalized." }
    : currentAction === "start-rental"
      ? { title: "Start Rental", heading: "Confirm Rental Release", confirmLabel: "Confirm Release", description: "Release the vehicle and change this booking to Ongoing?", operation: startRental, success: "Rental started successfully." }
      : currentAction === "mark-returned"
        ? { title: "Mark Returned", heading: "Confirm Vehicle Return", confirmLabel: "Confirm Return", description: "Record the physical vehicle return and change this booking to Returned? Any unpaid customer balance remains due.", operation: markBookingReturned, success: "Vehicle marked Returned successfully." }
        : currentAction === "complete"
          ? { title: "Complete Booking", heading: "Confirm Booking Completion", confirmLabel: "Complete Booking", description: "Close this settled booking as Completed?", operation: completeBooking, success: "Booking completed successfully." }
          : null;

  const chargeSummary = <section className="space-y-3">
    <h2 data-workflow-heading={chargeEntryOpen ? undefined : ""} tabIndex={-1} className="text-sm font-bold text-foreground">Review Return Charges</h2>
    <p className="text-xs leading-5 text-muted-foreground">Add any charges, then finalize the review. No charges? You can continue with an empty review.</p>
    <details className="rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-xs font-semibold text-foreground">View finalized Incoming Inspection</summary>
      <div className="mt-3"><BookingStageContent stage="incoming" booking={booking} /></div>
    </details>
    <BookingStageContent stage="charges" booking={booking} />
    <div className="grid gap-2 rounded-xl bg-background p-3 text-xs sm:grid-cols-2">
      <p>Customer charges: <strong>{money((booking.additionalCharges ?? []).filter((charge) => charge.responsibility === "customer").reduce((sum, charge) => sum + charge.amount, 0))}</strong></p>
      {booking.driverOption === "owners_driver" ? <p>Driver charges: <strong>{money((booking.additionalCharges ?? []).filter((charge) => charge.responsibility === "driver").reduce((sum, charge) => sum + charge.amount, 0))}</strong></p> : null}
    </div>
  </section>;

  let content: ReactNode;
  if (savedAction) {
    content = <WorkflowPanel footer={<><Button variant="outline" disabled={busy} onClick={close}>Close</Button><Button disabled={busy} onClick={() => void refreshSaved(savedAction)}>{refreshing ? "Refreshing..." : "Refresh Booking"}</Button></>}>
      <h2 data-workflow-heading tabIndex={-1} className="text-sm font-bold text-foreground">Your action was saved</h2>
      <p role="status" className="text-xs text-muted-foreground">{refreshError ? "The latest booking details could not be loaded. Refresh to continue. Your saved action will not be repeated." : "Loading the next step..."}</p>
    </WorkflowPanel>;
  } else if (!currentAction) {
    content = <WorkflowPanel footer={<Button variant="outline" onClick={close}>Close</Button>}>
      <div role="status" className="flex items-center gap-3"><CheckCircle2 className="size-5 text-success" /><h2 data-workflow-heading tabIndex={-1} className="text-sm font-bold text-foreground">{booking.statusKey === "ongoing" ? "Rental Started" : "Booking " + booking.adminStatus}</h2></div>
      <p className="text-xs text-muted-foreground">{booking.statusKey === "ongoing" ? "Rental preparation is complete. Open Process Return when the vehicle comes back." : "The booking has no further action in this workflow."}</p>
    </WorkflowPanel>;
  } else if (confirmationOpen && confirmation) {
    content = <WorkflowPanel footer={<><Button variant="outline" disabled={busy} onClick={() => setConfirmationOpen(false)}>Back to Review</Button><Button disabled={busy || blockers.length > 0} onClick={() => void run(() => confirmation.operation(booking), confirmation.success)}>{isActing ? "Saving..." : confirmation.confirmLabel}</Button></>}>
      <h2 id="booking-workflow-confirmation-title" data-workflow-heading tabIndex={-1} className="text-sm font-bold text-foreground">{confirmation.heading}</h2>
      <p id="booking-workflow-confirmation-description" className="text-sm leading-6 text-foreground">{confirmation.description}</p>
      <BookingContext booking={booking} />
      {currentAction === "review-charges" ? <p className="rounded-xl border border-warning-border bg-warning-surface p-3 text-xs leading-5 text-foreground">This locks the charge review. Charges cannot be added afterward.</p> : <CustomerBalance booking={booking} />}
      <Requirements items={blockers} />
    </WorkflowPanel>;
  } else if ((currentAction === "outgoing" || currentAction === "incoming") && blockers.length === 0) {
    content = <BookingInspectionForm key={currentAction} type={currentAction} booking={booking} onClose={close} onBusyChange={setFormBusy} onSaved={() => refreshSaved(currentAction)} />;
  } else if (currentAction === "assign-driver" || currentAction === "reassign-driver") {
    content = <form className="flex min-h-0 flex-auto flex-col overflow-hidden" onSubmit={assign} noValidate>
      <div data-workflow-body className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-4 p-4 sm:p-6">
        <h2 data-workflow-heading tabIndex={-1} className="text-sm font-bold text-foreground">{currentAction === "reassign-driver" ? "Reassign Driver" : "Assign Driver"}</h2>
        <p className="text-xs leading-5 text-muted-foreground">Choose an eligible driver for this rental. Saving continues to the next required step.</p>
        {driverForm.formState.errors.root?.message ? <p role="alert" className="text-xs text-destructive">{driverForm.formState.errors.root.message}</p> : null}
        <SelectWithLabel id="booking-driver" label="Driver" required disabled={busy || driversLoading || driversError} placeholder="Select a driver"
          options={drivers.map((driver) => ({ value: String(driver.id), label: driver.hasOutstandingBalance ? driver.name + " · Outstanding balance" : driver.name, disabled: driver.hasOutstandingBalance }))}
          value={selectedDriver} onValueChange={(value) => driverForm.setValue("driver_id", value, { shouldDirty: true })} error={driverForm.formState.errors.driver_id?.message} />
        {driversLoading ? <p role="status" className="text-xs text-muted-foreground">Loading available drivers...</p> : driversError ? <div className="space-y-2"><p role="alert" className="text-xs text-destructive">Drivers could not be loaded.</p><Button type="button" variant="outline" onClick={() => { setDriversLoading(true); setDriversReload((value) => value + 1); }}>Retry</Button></div> : drivers.length === 0 ? <p className="text-xs text-muted-foreground">No drivers are available.</p> : null}
      </div></div>
      <BookingDialogFooter><Button type="button" variant="outline" disabled={busy} onClick={close}>Close</Button><Button type="submit" disabled={busy || driversLoading || driversError || drivers.length === 0}>{isActing ? "Saving..." : "Save & Continue"}</Button></BookingDialogFooter>
    </form>;
  } else if (currentAction === "prepare-handover") {
    content = <WorkflowPanel footer={<><Button variant="outline" disabled={busy} onClick={close}>Close</Button><Button disabled={busy || !booking.telematicsHandover?.eligibility?.canStartHandover} onClick={() => void run(() => startTelematicsHandover(booking), "Telematics handover started.")}>{isActing ? "Starting..." : "Start Handover & Continue"}</Button></>}>
      <h2 data-workflow-heading tabIndex={-1} className="text-sm font-bold text-foreground">Start Telematics Handover</h2>
      <p className="text-xs text-muted-foreground">Start handover so the renter can complete setup on their phone. This workflow will show their progress as checks are saved.</p>
      <Requirements items={blockers} />
      <BookingStageContent stage="handover" booking={booking} />
    </WorkflowPanel>;
  } else if (currentAction === "view-setup" || currentAction === "calibration-pending") {
    content = <WorkflowPanel footer={<><Button variant="outline" disabled={busy} onClick={close}>Close</Button><Button disabled={busy} onClick={() => void refreshBooking()}>{refreshing ? "Refreshing..." : "Refresh Progress"}</Button></>}>
      <h2 data-workflow-heading tabIndex={-1} className="text-sm font-bold text-foreground">{bookingActionLabels[currentAction]}</h2>
      <p role="status" className="text-xs leading-5 text-muted-foreground">{currentAction === "calibration-pending" ? "Device checks are complete. Calibration is the remaining release requirement." : "The renter completes setup in the mobile app. Progress refreshes automatically every 5 seconds."}</p>
      {currentAction === "calibration-pending" ? <>
        <BookingStageContent stage="calibration" booking={booking} />
        <details className="rounded-xl border border-border p-3"><summary className="cursor-pointer text-xs font-semibold text-foreground">Device checks — complete</summary><div className="mt-3"><BookingStageContent stage="device-setup" booking={booking} /></div></details>
      </> : <>
        <BookingStageContent stage="device-setup" booking={booking} />
        <details className="rounded-xl border border-border p-3"><summary className="cursor-pointer text-xs font-semibold text-foreground">Calibration requirements</summary><div className="mt-3"><BookingStageContent stage="calibration" booking={booking} /></div></details>
      </>}
    </WorkflowPanel>;
  } else if (currentAction === "review-charges" && chargeEntryOpen) {
    content = <AdditionalChargesForm booking={booking} onCancel={() => setChargeEntryOpen(false)} onBusyChange={setFormBusy} onSaved={() => refreshSaved("review-charges")} />;
  } else if (currentAction === "review-charges") {
    content = <WorkflowPanel footer={<><Button variant="outline" disabled={busy} onClick={close}>Close</Button><Button disabled={busy} onClick={() => setConfirmationOpen(true)}>Finalize Charges</Button></>}>
      {chargeSummary}
      <Button variant="outline" onClick={() => setChargeEntryOpen(true)}>Add Charges</Button>
    </WorkflowPanel>;
  } else {
    content = <WorkflowPanel footer={<><Button variant="outline" disabled={busy} onClick={close}>Close</Button>
      {confirmation ? <Button disabled={busy || blockers.length > 0} onClick={() => setConfirmationOpen(true)}>{confirmation.title}</Button> : <Button disabled={busy} onClick={() => void refreshBooking()}>{refreshing ? "Refreshing..." : "Refresh Requirements"}</Button>}
    </>}>
      <h2 data-workflow-heading tabIndex={-1} className="text-sm font-bold text-foreground">{bookingActionLabels[currentAction]}</h2>
      <Requirements items={blockers} />
      {currentAction === "start-rental" ? <p className="text-xs leading-5 text-muted-foreground">Preparation is saved. Review this rental before confirming vehicle release.</p> : null}
      <BookingContext booking={booking} />
      {confirmation ? <CustomerBalance booking={booking} /> : null}
      {currentAction === "mark-returned" || currentAction === "complete" ? <p className="text-xs leading-5 text-muted-foreground">{currentAction === "mark-returned" ? "Marking Returned records the physical return. Any unpaid customer balance remains due; completion is a separate step." : "Complete after customer payment is settled. Driver-responsible charges do not block completion."}</p> : null}
      {blockers.length > 0 && confirmation ? <Button variant="outline" disabled={busy} onClick={() => void refreshBooking()}>{refreshing ? "Refreshing..." : "Refresh Requirements"}</Button> : null}
    </WorkflowPanel>;
  }

  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
    <FormDialogContent ref={contentRef} {...(confirmationOpen ? { role: "alertdialog", "aria-labelledby": "booking-workflow-confirmation-title", "aria-describedby": "booking-workflow-confirmation-description" } : {})} width={confirmationOpen || savedAction || !currentAction || ["assign-driver", "reassign-driver"].includes(currentAction) ? "compact" : ["outgoing", "incoming"].includes(currentAction) && blockers.length === 0 ? "wide" : "default"} onEscapeKeyDown={(event) => { if (busy || confirmationOpen) event.preventDefault(); if (confirmationOpen && !busy) setConfirmationOpen(false); }} onInteractOutside={(event) => { if (busy || confirmationOpen) event.preventDefault(); }}>
      <FormDialogHeader title={bookingWorkflowTitles[phase]} icon={phase === "prepare" ? Car : ReceiptText} onClose={close} closeLabel="Close booking workflow" />
      <BookingWorkflowProgress booking={booking} phase={phase} action={currentAction} />
      {booking.telematicsHandover?.eligibility?.testMode && phase === "prepare" ? <p role="status" className="shrink-0 bg-warning-surface px-4 py-2 text-xs text-foreground sm:px-6">Handover test mode is enabled. Readiness requirements are relaxed for local testing; check results remain real.</p> : null}
      {refreshError && !savedAction ? <p role="alert" className="shrink-0 px-4 py-2 text-xs text-destructive sm:px-6">Booking updates could not be loaded. Refresh to check the latest state.</p> : null}
      {content}
    </FormDialogContent>
  </Dialog>;
}
