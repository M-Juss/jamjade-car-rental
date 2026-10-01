"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Car, CheckCircle2, Circle, ClipboardCheck, Radio, ReceiptText } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { VehicleConditionSnapshot } from "@/modules/management/vehicles/inspection";
import { getBooking, type BookingRecord } from "@/services/booking";
import { bookingActionLabels, nextBookingAction, setupStepsPassed, TELEMATICS_CALIBRATION_STEPS, TELEMATICS_DEVICE_STEPS } from "@/modules/management/bookings/booking-next-action";

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
  return <section className="space-y-3 rounded-2xl border border-border bg-surface p-4"><h2 className="text-sm font-bold text-foreground">{title}</h2>{children}</section>;
}

export function BookingStageDialog({ stage, booking, onClose }: { stage: Stage; booking: BookingRecord; onClose: () => void }) {
  const titles: Record<Stage, string> = { outgoing: "Outgoing Inspection", handover: "Telematics Handover", "device-setup": "Device Setup", calibration: "Calibration", incoming: "Incoming Inspection", charges: "Return Charges" };
  const icon = ["handover", "device-setup", "calibration"].includes(stage) ? Radio : stage === "charges" ? ReceiptText : ClipboardCheck;
  const inspection = stage === "outgoing" || stage === "incoming"
    ? booking.inspections?.find((item) => item.type === stage && item.status === "finalized") : undefined;

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><FormDialogContent width="wide">
    <FormDialogHeader title={titles[stage]} icon={icon} onClose={onClose} closeLabel={"Close " + titles[stage]} />
    <ScrollArea className="min-h-0 flex-1"><div className="space-y-4 p-4 sm:p-6">
      {inspection ? <><VehicleConditionSnapshot inspection={inspection} />
        <Section title="Operator signature"><div className="grid gap-2">{(inspection.signatures ?? []).filter((signature) => signature.signerType !== "personnel").map((signature) =>
          <Detail key={signature.id} label={signature.signerType === "renter" ? "Renter" : "Assigned Driver"} value={signature.signerName + " · " + formatDate(signature.signedAt)} />
        )}</div></Section></> : null}
      {stage === "handover" ? <>
        <Section title="Handover"><div className="grid gap-2 sm:grid-cols-2">
          <Detail label="Status" value={booking.telematicsHandover?.setup?.status?.replaceAll("_", " ") ?? "Waiting for outgoing inspection"} />
          <Detail label="Started" value={formatDate(booking.telematicsHandover?.setup?.startedAt)} />
          <Detail label="Rental boundary" value={booking.telematicsHandover?.geofence?.name ?? "Not assigned"} />
          <Detail label="Ready for release" value={formatDate(booking.telematicsHandover?.setup?.readyAt)} />
        </div></Section>
      </> : null}
      {stage === "device-setup" || stage === "calibration" ? <Section title={stage === "calibration" ? "Calibration checks" : "Device and location checks"}>
        {stage === "calibration" ? <p className="text-xs text-muted-foreground">Calibration is not implemented in the current mobile phase. These checks must pass before rental release.</p> : null}
        <div className="grid gap-2">{(booking.telematicsHandover?.steps ?? []).filter((step) => (stage === "calibration" ? TELEMATICS_CALIBRATION_STEPS : TELEMATICS_DEVICE_STEPS).includes(step.type)).map((step) =>
          <div key={step.type} className="rounded-xl bg-background px-3 py-2.5 text-xs">
            <div className="flex justify-between gap-3"><span className="font-semibold text-foreground">{step.label}</span><span className="text-muted-foreground">{step.status.replaceAll("_", " ")}</span></div>
            {step.failureReason ? <p className="mt-1 text-destructive">{step.failureReason}</p> : null}
          </div>
        )}</div></Section> : null}
      {stage === "charges" ? <Section title="Return charge review"><div className="grid gap-2">
        <Detail label="Review finalized" value={formatDate(booking.returnChargesFinalizedAt)} />
        {(booking.additionalCharges ?? []).length ? booking.additionalCharges?.map((charge) =>
          <div key={charge.id} className="rounded-xl bg-background px-3 py-2.5 text-xs">
            <div className="flex justify-between gap-3 font-semibold text-foreground"><span>{charge.typeLabel}</span><span>{money(charge.amount)}</span></div>
            <p className="mt-1 text-muted-foreground">{charge.description} · {charge.responsibility === "driver" ? "Driver" : "Customer"} · {charge.paymentStatus}</p>
          </div>
        ) : <p className="text-xs text-muted-foreground">No additional charges were added.</p>}
      </div></Section> : null}
    </div></ScrollArea><FormDialogFooter><Button type="button" variant="outline" onClick={onClose}>Close</Button></FormDialogFooter>
  </FormDialogContent></Dialog>;
}

export function BookingDetailsDialog({ open, onOpenChange, booking }: { open: boolean; onOpenChange: (open: boolean) => void; booking: BookingRecord }) {
  const [details, setDetails] = useState<BookingRecord | null>(null);
  const [error, setError] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const bookingId = booking.backendId;

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    void getBooking(bookingId).then((record) => { if (!ignore) { setDetails(record); setError(false); } })
      .catch(() => { if (!ignore) setError(true); })
    return () => { ignore = true; };
  }, [bookingId, open]);

  useEffect(() => {
    if (!open || !["handover", "device-setup", "calibration"].includes(stage ?? "") || details?.telematicsSetupStatus !== "in_progress") return;
    let ignore = false;
    const interval = window.setInterval(() => {
      void getBooking(bookingId).then((record) => { if (!ignore) setDetails(record); }).catch(() => undefined);
    }, 5000);
    return () => { ignore = true; window.clearInterval(interval); };
  }, [bookingId, details?.telematicsSetupStatus, open, stage]);

  const close = () => { setStage(null); setDetails(null); setError(false); onOpenChange(false); };
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
    { label: "Incoming Inspection", done: Boolean(currentDetails.readiness?.incomingFinalized), stage: "incoming" as Stage },
    { label: "Return Charge Review", done: Boolean(currentDetails.readiness?.returnChargesFinalized), stage: "charges" as Stage },
    { label: "Returned", done: ["returned", "completed"].includes(currentDetails.statusKey) },
    { label: "Completed", done: currentDetails.statusKey === "completed" },
  ] : [];

  return <><Dialog open={open && stage === null} onOpenChange={(next) => { if (!next) close(); }}><FormDialogContent>
    <FormDialogHeader title="View Booking" icon={Car} onClose={close} closeLabel="Close booking details" />
    <ScrollArea className="min-h-0 flex-1"><div className="space-y-4 p-4 sm:p-6">
      {!currentDetails && !error ? <p className="py-10 text-center text-sm text-muted-foreground">Loading booking details...</p> : null}
      {error ? <p className="py-10 text-center text-sm text-destructive">Booking details could not be loaded. Close and try again.</p> : null}
      {currentDetails ? <>
        <Section title={"Progress · " + currentDetails.bookingCode}><div className="grid gap-2">{steps.map((step) =>
          <div key={step.label} className="flex items-center gap-3 rounded-xl bg-background px-3 py-2.5">
            {step.done ? <CheckCircle2 size={17} className="shrink-0 text-success" /> : <Circle size={17} className="shrink-0 text-muted-foreground" />}
            <span className="flex-1 text-xs font-semibold text-foreground">{step.label}{step.stage === "handover" && currentDetails.telematicsSetupStatus ? <span className="ml-2 font-normal text-muted-foreground">({currentDetails.telematicsSetupStatus.replaceAll("_", " ")})</span> : null}</span>
            {step.stage && (step.done || ["handover", "device-setup", "calibration"].includes(step.stage) && Boolean(currentDetails.telematicsHandover?.setup)) ?
              <Button type="button" size="sm" variant="outline" onClick={() => setStage(step.stage)}>View</Button> : null}
          </div>
        )}</div>{nextAction ? <p className="text-xs text-muted-foreground">Next: {bookingActionLabels[nextAction]}</p> : null}
        {["cancelled", "rejected"].includes(currentDetails.statusKey) ? <p className="text-xs text-muted-foreground">Booking {currentDetails.statusKey}.</p> : null}</Section>
        <Section title="Booking"><div className="grid gap-2 sm:grid-cols-2">
          <Detail label="Status" value={currentDetails.adminStatus} /><Detail label="Payment status" value={currentDetails.paymentStatus} />
          <Detail label="Booking type" value={currentDetails.bookingType} /><Detail label="Pickup type" value={currentDetails.pickupLocationType === "delivery" ? "Delivery" : "Shop pickup"} />
          <Detail label="Pickup location" value={currentDetails.pickupLocation} /><Detail label="Return location" value={currentDetails.returnLocation} />
          <Detail label="Rental start" value={formatDate(currentDetails.rentalStartAt)} /><Detail label="Rental end" value={formatDate(currentDetails.rentalEndAt)} />
          <Detail label="Duration" value={currentDetails.durationDays + " day(s)"} /><Detail label="Booking notes" value={currentDetails.notes || "None"} />
        </div></Section>
        <Section title="Customer and vehicle"><div className="grid gap-2 sm:grid-cols-2">
          <Detail label="Customer" value={currentDetails.customer?.name} /><Detail label="Email" value={currentDetails.customer?.email} />
          <Detail label="Phone" value={currentDetails.customer?.phoneNumber} /><Detail label="Member since" value={currentDetails.customer?.createdAt} />
          <Detail label="Vehicle" value={[currentDetails.brand, currentDetails.vehicleName, currentDetails.model].filter(Boolean).join(" ")} />
          <Detail label="Transmission" value={currentDetails.transmission} /><Detail label="Fuel" value={currentDetails.fuelType} /><Detail label="Seats" value={currentDetails.seats} />
          {currentDetails.driverOption === "owners_driver" ? <Detail label="Assigned Driver" value={currentDetails.assignedDriver?.name ?? "Not assigned"} /> : null}
          {currentDetails.driverOption === "owners_driver" && currentDetails.assignedDriver ? <Detail label="Driver phone" value={currentDetails.assignedDriver.phoneNumber} /> : null}
        </div></Section>
        {currentDetails.driverOption === "self_drive" ? <Section title="Required documents"><div className="grid gap-2 sm:grid-cols-2">
          {(currentDetails.documents ?? []).map((document) => <Detail key={document.name} label={document.name} value={document.status} />)}
        </div></Section> : null}
        <Section title="Payment"><div className="grid gap-2 sm:grid-cols-2">
          <Detail label="Subtotal" value={money(currentDetails.subtotal)} /><Detail label="Delivery fee" value={money(currentDetails.deliveryFee)} />
          <Detail label="Owner driver fee" value={money(currentDetails.ownerDriverFee)} /><Detail label="Outside Manila fee" value={money(currentDetails.outsideManilaFee)} />
          <Detail label="Toll fee" value={money(currentDetails.tollFee)} /><Detail label="Late fee" value={money(currentDetails.lateFee)} />
          <Detail label="Add-ons" value={money(currentDetails.addOns)} /><Detail label="Discount" value={money(currentDetails.discount)} />
          <Detail label="Down payment" value={money(currentDetails.downPayment)} /><Detail label="Total" value={money(currentDetails.totalAmount)} />
          <Detail label="Remaining balance" value={money(currentDetails.remainingBalance)} />
        </div></Section>
        {currentDetails.adminNotes ? <Section title="Staff notes"><p className="whitespace-pre-wrap text-xs text-foreground">{currentDetails.adminNotes}</p></Section> : null}
      </> : null}
    </div></ScrollArea><FormDialogFooter><Button type="button" variant="outline" onClick={close}>Close</Button></FormDialogFooter>
  </FormDialogContent></Dialog>
  {stage && currentDetails ? <BookingStageDialog stage={stage} booking={currentDetails} onClose={() => setStage(null)} /> : null}</>;
}
