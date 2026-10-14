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
import { BookingMonitoringZones } from "@/modules/management/bookings/components/BookingMonitoringZones";
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

export function BookingStageContent({ stage, booking }: { stage: Stage; booking: BookingRecord }) {
  const inspection = stage === "outgoing" || stage === "incoming"
    ? booking.inspections?.find((item) => item.type === stage && item.status === "finalized") : undefined;

  return <div className="space-y-4">
      {inspection ? <><VehicleConditionSnapshot inspection={inspection} />
        <Section title="Operator signature"><div className="grid gap-2">{(inspection.signatures ?? []).filter((signature) => signature.signerType !== "personnel").map((signature) =>
          <Detail key={signature.id} label={signature.signerType === "renter" ? "Renter" : "Assigned Driver"} value={signature.signerName + " · " + formatDate(signature.signedAt)} />
        )}</div></Section></> : null}
      {stage === "handover" ? <>
        <Section title="Handover"><div className="grid gap-2 sm:grid-cols-2">
          <Detail label="Status" value={booking.telematicsHandover?.setup?.status?.replaceAll("_", " ") ?? "Waiting for outgoing inspection"} />
          <Detail label="Started" value={formatDate(booking.telematicsHandover?.setup?.startedAt)} />
          <Detail label="Ready for release" value={formatDate(booking.telematicsHandover?.setup?.readyAt)} />
        </div></Section>
      </> : null}
      {stage === "device-setup" || stage === "calibration" ? <Section title={stage === "calibration" ? "Calibration checks" : "Device and location checks"}>
        {stage === "calibration" ? <p className="text-xs text-muted-foreground">Calibration is currently unavailable in the mobile app. {booking.telematicsHandover?.eligibility?.testMode ? "Local handover test mode relaxes this requirement." : "These checks must pass before rental release."}</p> : null}
        <div className="grid gap-2">{(booking.telematicsHandover?.steps ?? []).filter((step) => (stage === "calibration" ? TELEMATICS_CALIBRATION_STEPS : TELEMATICS_DEVICE_STEPS).includes(step.type)).map((step) =>
          <div key={step.type} className="rounded-xl bg-background px-3 py-2.5 text-xs">
            <div className="flex justify-between gap-3"><span className="font-semibold text-foreground">{step.label}</span><span className="text-muted-foreground">{step.status.replaceAll("_", " ")}</span></div>
            {step.failureReason ? <p className="mt-1 text-destructive">{step.failureReason}</p> : null}
          </div>
        )}</div></Section> : null}
      {stage === "charges" ? <Section title="Return charge review"><div className="grid gap-2">
        <p className="text-xs text-muted-foreground">{booking.returnChargesFinalizedAt ? "Finalized · " + formatDate(booking.returnChargesFinalizedAt) : booking.statusKey === "ongoing" && booking.rentalProgress?.incomingFinalized ? "Review open · Charges can still be added." : "Return charges have not been reviewed."}</p>
        {(booking.additionalCharges ?? []).length ? booking.additionalCharges?.map((charge) =>
          <div key={charge.id} className="rounded-xl bg-background px-3 py-2.5 text-xs">
            <div className="flex justify-between gap-3 font-semibold text-foreground"><span>{charge.typeLabel}</span><span>{money(charge.amount)}</span></div>
            <p className="mt-1 break-words leading-5 text-foreground">{charge.description}</p>
            <p className="mt-1 text-muted-foreground">{charge.responsibility === "driver" ? "Assigned Driver" : "Customer / Renter"} · {charge.paymentStatus}</p>
          </div>
        ) : <p className="text-xs text-muted-foreground">No additional charges were added.</p>}
      </div></Section> : null}
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
        <Section title="Payment"><div className="grid gap-2 sm:grid-cols-2">
          <Detail label="Subtotal" value={money(currentDetails.subtotal)} /><Detail label="Delivery fee" value={money(currentDetails.deliveryFee)} /><Detail label="Delivery toll" value={money(currentDetails.deliveryTollFee)} />
          <Detail label="Owner driver fee" value={money(currentDetails.ownerDriverFee)} /><Detail label="Outside Manila fee" value={money(currentDetails.outsideManilaFee)} />
          <Detail label="Toll fee" value={money(currentDetails.tollFee)} /><Detail label="Late fee" value={money(currentDetails.lateFee)} />
          <Detail label="Add-ons" value={money(currentDetails.addOns)} /><Detail label="Discount" value={money(currentDetails.discount)} />
          <Detail label="Down payment" value={money(currentDetails.downPayment)} /><Detail label="Total" value={money(currentDetails.totalAmount)} />
          <Detail label="Remaining balance" value={money(currentDetails.remainingBalance)} />
        </div></Section>
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
