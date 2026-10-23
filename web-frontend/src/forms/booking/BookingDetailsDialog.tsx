"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Car, CheckCircle2, Circle, ClipboardCheck, Radio, ReceiptText } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookingDialogFooter } from "@/modules/management/bookings/components/BookingDialogFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormDialogContent, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { VehicleConditionSnapshot } from "@/modules/management/vehicles/inspection";
import { getBooking, type BookingRecord } from "@/services/booking";
import { CancellationRefundForm, RecordCancellationRefundForm } from "./CancellationRefundForm";
import { ResolveMissedStartForm } from "./ResolveMissedStartForm";
import { ReturnFollowUpForm } from "./ReturnFollowUpForm";
import { LateReturnSummary } from "@/modules/management/bookings/components/LateReturnSummary";
import { BookingMonitoringZones } from "@/modules/management/bookings/components/BookingMonitoringZones";
import { ReturnChargeCards, type ReturnChargeActions } from "@/modules/management/bookings/components/ReturnChargeCards";
import { bookingActionLabels, nextBookingAction, setupStepsPassed, TELEMATICS_CALIBRATION_STEPS, TELEMATICS_DEVICE_STEPS } from "@/modules/management/bookings/booking-next-action";
import { bookingWorkflowPhase, bookingWorkflowTitles } from "@/modules/management/bookings/booking-workflow";

type Stage = "outgoing" | "handover" | "device-setup" | "calibration" | "incoming" | "charges";

function formatDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not recorded";
}

function money(value: number) {
  return "PHP " + Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="rounded-xl bg-background px-3 py-2.5"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-0.5 break-words text-[12.5px] font-semibold text-foreground">{value ?? "—"}</p></div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Card className="gap-0 rounded-2xl border border-border bg-surface py-4 ring-0"><CardContent className="space-y-3"><h2 className="text-sm font-bold text-foreground">{title}</h2>{children}</CardContent></Card>;
}

export function BookingStageContent({ stage, booking, chargeActions }: { stage: Stage; booking: BookingRecord; chargeActions?: ReturnChargeActions }) {
  const inspection = stage === "outgoing" || stage === "incoming"
    ? booking.inspections?.find((item) => item.type === stage && item.status === "finalized") : undefined;

  return <div className="space-y-3">
      {inspection ? <VehicleConditionSnapshot inspection={inspection} /> : null}
      {stage === "handover" ? <>
        <Section title="Handover"><div className="grid gap-2 sm:grid-cols-2">
          <Detail label="Status" value={booking.telematicsHandover?.setup?.status?.replaceAll("_", " ") ?? "Waiting for outgoing inspection"} />
          <Detail label="Started" value={formatDate(booking.telematicsHandover?.setup?.startedAt)} />
          <Detail label="Ready for release" value={formatDate(booking.telematicsHandover?.setup?.readyAt)} />
        </div></Section>
      </> : null}
      {stage === "device-setup" || stage === "calibration" ? <Section title={stage === "calibration" ? "Calibration checks" : "Device and location checks"}>
        {stage === "calibration" ? <p className="text-xs text-muted-foreground">Supervise calibration in a controlled area. The renter starts each recording while parked and leaves the mounted phone untouched while moving. {booking.telematicsHandover?.eligibility?.testMode ? "Local handover test mode relaxes this requirement." : "All five checks must pass before rental release."}</p> : null}
        <div className="grid gap-2">{(booking.telematicsHandover?.steps ?? []).filter((step) => (stage === "calibration" ? TELEMATICS_CALIBRATION_STEPS : TELEMATICS_DEVICE_STEPS).includes(step.type)).map((step) =>
          <div key={step.type} className="rounded-xl bg-background px-3 py-2.5 text-xs">
            <div className="flex justify-between gap-3"><span className="font-semibold text-foreground">{step.label}</span><span className="text-muted-foreground">{step.status.replaceAll("_", " ")}</span></div>
            {step.failureReason ? <p className="mt-1 text-destructive">{step.failureReason}</p> : null}
          </div>
        )}</div></Section> : null}
      {stage === "charges" ? <ReturnChargeCards booking={booking} actions={chargeActions} /> : null}
    </div>;
}

export function BookingStageDialog({ stage, booking, onClose }: { stage: Stage; booking: BookingRecord; onClose: () => void }) {
  const titles: Record<Stage, string> = { outgoing: "Outgoing Inspection", handover: "Telematics Handover", "device-setup": "Device Setup", calibration: "Calibration", incoming: "Incoming Inspection", charges: "Return Charges" };
  const icon = ["handover", "device-setup", "calibration"].includes(stage) ? Radio : stage === "charges" ? ReceiptText : ClipboardCheck;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><FormDialogContent width={stage === "outgoing" || stage === "incoming" ? "wide" : "default"}>
    <FormDialogHeader title={titles[stage]} icon={icon} onClose={onClose} closeLabel={"Close " + titles[stage]} />
    <div className="min-h-0 min-w-0 flex-auto overflow-y-auto overscroll-contain"><div className="p-4 sm:p-6"><BookingStageContent stage={stage} booking={booking} /></div></div>
    <BookingDialogFooter><Button type="button" variant="outline" onClick={onClose}>Back to Booking</Button></BookingDialogFooter>
  </FormDialogContent></Dialog>;
}

export function BookingDetailsDialog({ open, onOpenChange, booking, onContinue, isContinuing = false }: {
  open: boolean; onOpenChange: (open: boolean) => void; booking: BookingRecord; onContinue: (booking: BookingRecord) => void; isContinuing?: boolean;
}) {
  const [details, setDetails] = useState<BookingRecord | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [refundAction, setRefundAction] = useState<"review" | "record" | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const bookingId = booking.backendId;

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    void getBooking(bookingId).then((record) => { if (!ignore) { setDetails(record); setError(false); } })
      .catch(() => { if (!ignore) setError(true); })
    return () => { ignore = true; };
  }, [bookingId, open, reload]);

  useEffect(() => {
    if (!open || !(details?.statusKey === "ongoing" || ["handover", "device-setup", "calibration"].includes(stage ?? "") && details?.telematicsSetupStatus === "in_progress")) return;
    let ignore = false;
    const interval = window.setInterval(() => {
      void getBooking(bookingId).then((record) => { if (!ignore) setDetails(record); }).catch(() => undefined);
    }, 5000);
    return () => { ignore = true; window.clearInterval(interval); };
  }, [bookingId, details?.statusKey, details?.telematicsSetupStatus, open, stage]);

  const close = () => { setRefundAction(null); setResolveOpen(false); setFollowUpOpen(false); setStage(null); setDetails(null); setError(false); onOpenChange(false); };
  const currentDetails = details?.backendId === bookingId ? details : null;
  const nextAction = currentDetails ? nextBookingAction(currentDetails) : null;
  const steps = currentDetails ? [
    { label: "Confirmed", done: ["confirmed", "ongoing", "returned", "completed"].includes(currentDetails.statusKey) },
    { label: "Outgoing Inspection", done: Boolean(currentDetails.readiness?.outgoingFinalized), stage: "outgoing" as Stage },
    ...(currentDetails.driverOption === "self_drive" ? [
      { label: "Telematics Handover", done: ["in_progress", "ready_for_release", "released"].includes(currentDetails.telematicsSetupStatus ?? ""), stage: "handover" as Stage },
      { label: "Device Setup", done: setupStepsPassed(currentDetails, TELEMATICS_DEVICE_STEPS), stage: "device-setup" as Stage },
      { label: "Calibration", done: setupStepsPassed(currentDetails, TELEMATICS_CALIBRATION_STEPS), stage: "calibration" as Stage },
    ] : []),
    { label: "Active Rental", done: ["ongoing", "returned", "completed"].includes(currentDetails.statusKey) },
    { label: "Vehicle Received", done: Boolean(currentDetails.lateReturn?.vehicleReceivedAt) },
    { label: "Incoming Inspection", done: Boolean(currentDetails.readiness?.incomingFinalized), stage: "incoming" as Stage },
    { label: "Return Charge Review", done: Boolean(currentDetails.readiness?.returnChargesFinalized), stage: "charges" as Stage },
    { label: "Returned", done: ["returned", "completed"].includes(currentDetails.statusKey) },
    { label: "Completed", done: currentDetails.statusKey === "completed" },
  ] : [];

  if (refundAction && currentDetails) {
    const RefundForm = refundAction === "review" ? CancellationRefundForm : RecordCancellationRefundForm;
    return <Dialog open onOpenChange={(value) => { if (!value && !followUpBusy) setRefundAction(null); }}><FormDialogContent>
      <FormDialogHeader title={refundAction === "review" ? "Review Cancellation Refund" : "Record External Refund"} icon={ReceiptText} onClose={() => { if (!followUpBusy) setRefundAction(null); }} closeLabel="Close refund" />
      <RefundForm booking={currentDetails} onCancel={() => setRefundAction(null)} onBusyChange={setFollowUpBusy} onSaved={(record) => { setDetails(record); setRefundAction(null); }} />
    </FormDialogContent></Dialog>;
  }

  if (resolveOpen && currentDetails) return <Dialog open onOpenChange={(value) => { if (!value && !followUpBusy) setResolveOpen(false); }}><FormDialogContent role="alertdialog" aria-describedby="missed-start-confirmation">
    <FormDialogHeader title="Resolve Missed Start" icon={ReceiptText} onClose={() => { if (!followUpBusy) setResolveOpen(false); }} closeLabel="Close resolution" />
    <ResolveMissedStartForm booking={currentDetails} onCancel={() => setResolveOpen(false)} onBusyChange={setFollowUpBusy} onSaved={(record) => { setDetails(record); setResolveOpen(false); }} />
  </FormDialogContent></Dialog>;

  if (followUpOpen && currentDetails) return <Dialog open onOpenChange={(value) => { if (!value && !followUpBusy) setFollowUpOpen(false); }}><FormDialogContent>
    <FormDialogHeader title="Return Follow-up" icon={ReceiptText} onClose={() => { if (!followUpBusy) setFollowUpOpen(false); }} closeLabel="Close follow-up" />
    <ReturnFollowUpForm booking={currentDetails} onCancel={() => setFollowUpOpen(false)} onBusyChange={setFollowUpBusy} onSaved={(record) => { setDetails(record); setFollowUpOpen(false); }} />
  </FormDialogContent></Dialog>;

  return <><Dialog open={open && stage === null} onOpenChange={(next) => { if (!next) close(); }}><FormDialogContent>
    <FormDialogHeader title="View Booking" icon={Car} onClose={close} closeLabel="Close booking details" />
      {!currentDetails && !error ? <p className="py-10 text-center text-sm text-muted-foreground">Loading booking details...</p> : null}
      {error ? <div className="space-y-3 p-6 text-center"><p role="alert" className="text-sm text-destructive">Booking details could not be loaded.</p><Button type="button" variant="outline" onClick={() => { setError(false); setReload((value) => value + 1); }}>Retry Loading</Button></div> : null}
      {currentDetails ? <Tabs defaultValue="overview" className="min-h-0 flex-auto gap-0 overflow-hidden">
        <div className="shrink-0 space-y-3 border-b border-border p-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><p className="font-semibold text-foreground">{currentDetails.bookingCode}</p><p className="text-muted-foreground">{currentDetails.adminStatus} · {currentDetails.paymentStatus}</p></div>
          <TabsList aria-label="Booking details" className={`grid h-10 w-full ${currentDetails.driverOption === "self_drive" ? "grid-cols-4" : "grid-cols-3"}`}>
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger><TabsTrigger value="rental" className="text-xs">Rental</TabsTrigger><TabsTrigger value="payment" className="text-xs">Payment</TabsTrigger>
            {currentDetails.driverOption === "self_drive" ? <TabsTrigger value="documents" aria-label="Documents" className="text-xs"><span className="sm:hidden">Docs</span><span className="hidden sm:inline">Documents</span></TabsTrigger> : null}
          </TabsList>
        </div>
        <TabsContent value="overview" className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-4 p-4 sm:p-6">
          <div className="grid gap-2 sm:grid-cols-2"><Detail label="Customer" value={currentDetails.customer?.name} /><Detail label="Vehicle" value={[currentDetails.brand, currentDetails.vehicleName, currentDetails.model].filter(Boolean).join(" ")} /></div>
          <LateReturnSummary booking={currentDetails} />
          {currentDetails.statusKey === "ongoing" && !currentDetails.lateReturn?.vehicleReceivedAt ? <Button type="button" variant="outline" onClick={() => setFollowUpOpen(true)}>Record Return Follow-up</Button> : null}
          {currentDetails.attention?.key === "not_started" ? <p className="rounded-xl border border-warning-border bg-warning-surface p-3 text-xs">The scheduled period ended without release. Check the customer and release records, then resolve the booking with a reason. <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setResolveOpen(true)}>Resolve Missed Start</Button></p> : null}
          {nextAction ? <p className="rounded-xl bg-muted p-3 text-xs text-foreground"><strong>Next step:</strong> {bookingActionLabels[nextAction]}</p> : null}
        <Section title="Rental progress"><div className="grid gap-2">{steps.map((step) =>
          <div key={step.label} className="flex items-center gap-3 rounded-xl bg-background px-3 py-2.5">
            {step.done ? <CheckCircle2 size={17} className="shrink-0 text-success" /> : <Circle size={17} className="shrink-0 text-muted-foreground" />}
            <span className="flex-1 text-xs font-semibold text-foreground">{step.label}{step.stage === "handover" && currentDetails.telematicsSetupStatus ? <span className="ml-2 font-normal text-muted-foreground">({currentDetails.telematicsSetupStatus.replaceAll("_", " ")})</span> : null}</span>
            {step.stage && (step.done || ["handover", "device-setup", "calibration"].includes(step.stage) && Boolean(currentDetails.telematicsHandover?.setup)) ?
              <Button type="button" size="sm" variant="outline" onClick={() => setStage(step.stage)}>View</Button> : null}
          </div>
        )}</div>
        {["cancelled", "rejected"].includes(currentDetails.statusKey) ? <p className="text-xs text-muted-foreground">Booking {currentDetails.statusKey}.</p> : null}</Section>
        </div></TabsContent>
        <TabsContent value="rental" className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-4 p-4 sm:p-6">
        <Section title="Booking"><div className="grid gap-2 sm:grid-cols-2">
          <Detail label="Status" value={currentDetails.adminStatus} /><Detail label="Payment status" value={currentDetails.paymentStatus} />
          <Detail label="Booking type" value={currentDetails.bookingType} /><Detail label="Pickup type" value={currentDetails.pickupLocationType === "delivery" ? "Delivery" : "Shop pickup"} />
          <Detail label="Pickup location" value={currentDetails.pickupLocation} /><Detail label="Return location" value={currentDetails.returnLocation} />
          <Detail label="Rental start" value={formatDate(currentDetails.rentalStartAt)} /><Detail label="Rental end" value={formatDate(currentDetails.rentalEndAt)} />
          <Detail label="Duration" value={currentDetails.durationDays + " day(s)"} /><Detail label="Booking notes" value={currentDetails.notes || "None"} />
        </div>
        {currentDetails.deliveryLocation && <div className="mt-3 space-y-2"><Button asChild variant="outline"><a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: currentDetails.deliveryLocation.point ? `${currentDetails.deliveryLocation.point.latitude},${currentDetails.deliveryLocation.point.longitude}` : currentDetails.deliveryLocation.address, ...(!currentDetails.deliveryLocation.point && currentDetails.deliveryLocation.placeId ? { query_place_id: currentDetails.deliveryLocation.placeId } : {}) })}`}>View Delivery Point</a></Button>{!currentDetails.deliveryLocation.point && <p className="text-xs text-muted-foreground">The saved map point expired. Reconfirm it using the customer address before delivery.</p>}</div>}
        </Section>
        <Section title="Customer and vehicle"><div className="grid gap-2 sm:grid-cols-2">
          <Detail label="Customer" value={currentDetails.customer?.name} /><Detail label="Email" value={currentDetails.customer?.email} />
          <Detail label="Phone" value={currentDetails.customer?.phoneNumber} /><Detail label="Member since" value={currentDetails.customer?.createdAt} />
          <Detail label="Vehicle" value={[currentDetails.brand, currentDetails.vehicleName, currentDetails.model].filter(Boolean).join(" ")} />
          <Detail label="Transmission" value={currentDetails.transmission} /><Detail label="Fuel" value={currentDetails.fuelType} /><Detail label="Seats" value={currentDetails.seats} />
          {currentDetails.driverOption === "owners_driver" ? <Detail label="Assigned Driver" value={currentDetails.assignedDriver?.name ?? "Not assigned"} /> : null}
          {currentDetails.driverOption === "owners_driver" && currentDetails.assignedDriver ? <Detail label="Driver phone" value={currentDetails.assignedDriver.phoneNumber} /> : null}
        </div></Section>
        {currentDetails.adminNotes ? <Section title="Staff notes"><p className="whitespace-pre-wrap text-xs text-foreground">{currentDetails.adminNotes}</p></Section> : null}
        </div></TabsContent>
        <TabsContent value="payment" className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-4 p-4 sm:p-6">
        <Section title="Payment">
          <dl>
            {[
              { label: "Subtotal", amount: currentDetails.subtotal },
              { label: "Delivery fee", amount: currentDetails.deliveryFee },
              { label: "Delivery toll", amount: currentDetails.deliveryTollFee },
              { label: "Owner driver fee", amount: currentDetails.ownerDriverFee },
              { label: "Outside Manila fee", amount: currentDetails.outsideManilaFee },
              { label: "Toll fee", amount: currentDetails.tollFee },
              { label: "Late fee", amount: currentDetails.lateFee },
              { label: "Add-ons", amount: currentDetails.addOns },
              { label: "Discount", amount: currentDetails.discount },
              { label: "Total", amount: currentDetails.totalAmount, emphasized: true },
              { label: "Down payment", amount: currentDetails.downPayment },
              { label: "Remaining balance", amount: currentDetails.remainingBalance, emphasized: true },
            ].map(({ label, amount, emphasized }) => (
              <div key={label} className={`flex items-baseline justify-between gap-4 py-2.5 ${emphasized ? "border-t border-border" : ""}`}>
                <dt className={`min-w-0 text-xs ${emphasized ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</dt>
                <dd className="shrink-0 whitespace-nowrap text-right text-[12.5px] font-semibold tabular-nums text-foreground">{money(amount)}</dd>
              </div>
            ))}
          </dl>
        </Section>
        {currentDetails.cancellation ? <Section title="Cancellation and refund"><div className="grid gap-2 sm:grid-cols-2">
          <Detail label="Cancellation type" value={currentDetails.cancellation.kind.replaceAll("_", " ")} />
          <Detail label="Reason" value={currentDetails.cancellation.reason} />
          <Detail label="Refund status" value={currentDetails.cancellation.refundStatus.replaceAll("_", " ")} />
          <Detail label="Approved refund" value={currentDetails.cancellation.refundAmount === null ? "Pending review" : money(currentDetails.cancellation.refundAmount)} />
          <Detail label="Decision reason" value={currentDetails.cancellation.refundReason} />
          <Detail label="Money returned" value={formatDate(currentDetails.cancellation.refundedAt)} />
        </div>
        {currentDetails.canReviewCancellationRefund && currentDetails.cancellation.refundStatus === "pending_review" ? <Button type="button" onClick={() => setRefundAction("review")}>Review Refund</Button> : null}
        {currentDetails.canReviewCancellationRefund && currentDetails.cancellation.refundStatus === "approved" ? <Button type="button" onClick={() => setRefundAction("record")}>Record Money Returned</Button> : null}
        </Section> : null}
        <BookingStageContent stage="charges" booking={currentDetails} />
        </div></TabsContent>
        {currentDetails.driverOption === "self_drive" ? <TabsContent value="documents" className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-4 p-4 sm:p-6">
          <Section title="Required documents"><div className="grid gap-2 sm:grid-cols-2">
            {(currentDetails.documents ?? []).map((document) => <Detail key={document.name} label={document.name} value={document.status} />)}
            {!currentDetails.documents?.length ? <p className="text-xs text-muted-foreground">No document status is available.</p> : null}
          </div></Section>
          <BookingMonitoringZones booking={currentDetails} onUpdated={setDetails} />
        </div></TabsContent> : null}
      </Tabs> : null}
    <BookingDialogFooter>
      <Button type="button" variant="outline" onClick={close}>Close</Button>
      {nextAction && currentDetails && !error ? <Button type="button" disabled={isContinuing} onClick={() => onContinue(currentDetails)}>{isContinuing ? "Loading..." : bookingWorkflowTitles[bookingWorkflowPhase(nextAction)]}</Button> : null}
    </BookingDialogFooter>
  </FormDialogContent></Dialog>
  {stage && currentDetails ? <BookingStageDialog stage={stage} booking={currentDetails} onClose={() => setStage(null)} /> : null}</>;
}
