"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { ClipboardCheck, MapPinned, ReceiptText, UserRound } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { appToast } from "@/lib/toast";
import { ApiError } from "@/services/http";
import { assignBookingGeofence, assignDriver, completeBooking, finalizeReturnCharges, getBooking, getDrivers, getGeofenceTemplates, markBookingReturned, startRental, startTelematicsHandover, type BookingRecord, type DriverCandidate, type GeofenceTemplate } from "@/services/booking";
import { assignBookingGeofenceSchema, assignDriverSchema, type AssignBookingGeofenceFormValues, type AssignDriverFormValues } from "@/validations/booking/schemas";
import { bookingActionLabels, type BookingNextAction } from "@/modules/management/bookings/booking-next-action";
import { BookingInspectionDialog } from "./BookingInspectionDialog";
import { AdditionalChargesDialog } from "./AdditionalChargesDialog";
import { BookingStageDialog } from "./BookingDetailsDialog";

type Action = BookingNextAction | "reassign-driver";

function errorMessage(error: unknown) {
  return error instanceof ApiError && error.errors
    ? Object.values(error.errors).flat()[0] ?? "The booking action could not be completed."
    : "The booking action could not be completed. Please try again.";
}

function outgoingBlockers(booking: BookingRecord) {
  const ready = booking.readiness;
  if (!ready) return ["Booking readiness is loading."];
  return [
    !ready.bookingConfirmed && "Booking must be confirmed.",
    !ready.paymentAcceptedForInspection && "An accepted partial or full payment is required.",
    !ready.ageEligible && "The renter must meet the age requirement.",
    !ready.documentsApproved && "Self-drive documents must be approved.",
    !ready.driverAssigned && "Assign a driver before inspection.",
    !ready.driverEligible && "The assigned driver is not eligible.",
    !ready.vehicleOperational && "The vehicle must be operational and available.",
    !booking.inspectionBaseline && "Set a finalized current vehicle condition first.",
  ].filter((message): message is string => Boolean(message));
}

function releaseBlockers(booking: BookingRecord) {
  const ready = booking.readiness;
  if (!ready) return ["Booking readiness is loading."];
  return [
    !ready.fullyPaid && "Full customer payment is required.",
    !ready.outgoingFinalized && "Finalize the Outgoing Inspection.",
    !ready.ageEligible && "The renter must meet the age requirement.",
    !ready.documentsApproved && "Self-drive documents must be approved.",
    !ready.driverAssigned && "Assign a driver.",
    !ready.driverEligible && "The assigned driver is not eligible.",
    !ready.vehicleOperational && "The vehicle must be operational and available.",
    !ready.telematicsSetupReady && "Complete all telematics checks, including calibration, before release.",
  ].filter((message): message is string => Boolean(message));
}

function Requirements({ items }: { items: string[] }) {
  return items.length ? <div className="rounded-xl border border-warning-border bg-warning-surface p-3 text-xs text-foreground">
    <p className="font-semibold">Before this action:</p><ul className="mt-2 list-disc space-y-1 pl-5">{items.map((item) => <li key={item}>{item}</li>)}</ul>
  </div> : null;
}

export function BookingWorkflowDialog({ action, booking, onClose, onUpdated }: {
  action: Action; booking: BookingRecord; onClose: () => void; onUpdated: (booking: BookingRecord) => void;
}) {
  const [isActing, setIsActing] = useState(false);
  const [chargesOpen, setChargesOpen] = useState(false);
  const [drivers, setDrivers] = useState<DriverCandidate[]>([]);
  const [templates, setTemplates] = useState<GeofenceTemplate[]>([]);
  const driverForm = useForm<AssignDriverFormValues>({ resolver: zodResolver(assignDriverSchema), defaultValues: { driver_id: booking.assignedDriver ? String(booking.assignedDriver.id) : "" } });
  const geofenceForm = useForm<AssignBookingGeofenceFormValues>({ resolver: zodResolver(assignBookingGeofenceSchema), defaultValues: { source_geofence_id: "custom", name: "", geometry_type: "circle", center_latitude: "", center_longitude: "", radius_meters: "" } });
  const selectedDriver = useWatch({ control: driverForm.control, name: "driver_id" });
  const selectedGeofence = useWatch({ control: geofenceForm.control, name: "source_geofence_id" });

  useEffect(() => {
    if (action === "assign-driver" || action === "reassign-driver") void getDrivers().then(setDrivers).catch(() => appToast.error("Available drivers could not be loaded."));
    if (action === "prepare-handover") void getGeofenceTemplates().then(setTemplates).catch(() => appToast.error("Rental boundaries could not be loaded."));
  }, [action]);

  useEffect(() => {
    if (!["view-setup", "calibration-pending"].includes(action) || booking.telematicsSetupStatus !== "in_progress") return;
    let ignore = false;
    const interval = window.setInterval(() => {
      void getBooking(booking.backendId).then((record) => { if (!ignore) onUpdated(record); }).catch(() => undefined);
    }, 5000);
    return () => { ignore = true; window.clearInterval(interval); };
  }, [action, booking.backendId, booking.telematicsSetupStatus, onUpdated]);

  const update = async (record: BookingRecord) => onUpdated(await getBooking(record));
  const run = async (operation: () => Promise<BookingRecord>, success: string, closeAfter = true) => {
    try {
      setIsActing(true);
      await update(await operation());
      appToast.success(success);
      if (closeAfter) onClose();
    } catch (error) { appToast.error(errorMessage(error)); }
    finally { setIsActing(false); }
  };

  const assign = driverForm.handleSubmit(async (values) => {
    try {
      setIsActing(true);
      await update(await assignDriver(booking, Number(values.driver_id)));
      appToast.success("Driver assigned successfully.");
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.errors?.driver_id?.[0]) driverForm.setError("driver_id", { type: "server", message: error.errors.driver_id[0] });
      appToast.error(errorMessage(error));
    } finally { setIsActing(false); }
  }, () => appToast.error("Select a driver to assign."));

  const assignGeofence = geofenceForm.handleSubmit(async (values) => {
    const payload = values.source_geofence_id !== "custom"
      ? { source_geofence_id: Number(values.source_geofence_id) }
      : { name: values.name, geometry_type: "circle" as const, center_latitude: Number(values.center_latitude), center_longitude: Number(values.center_longitude), radius_meters: Number(values.radius_meters) };
    try {
      setIsActing(true);
      await update(await assignBookingGeofence(booking, payload));
      appToast.success("Rental boundary assigned.");
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const fields = ["source_geofence_id", "name", "geometry_type", "center_latitude", "center_longitude", "radius_meters"] as const;
        fields.forEach((field) => {
          const message = error.errors?.[field]?.[0];
          if (message) geofenceForm.setError(field, { type: "server", message });
        });
      }
      appToast.error(errorMessage(error));
    } finally { setIsActing(false); }
  }, () => appToast.error("Check the rental boundary fields."));

  if (action === "view-setup" || action === "calibration-pending") return <BookingStageDialog stage={action === "calibration-pending" ? "calibration" : "device-setup"} booking={booking} onClose={onClose} />;

  if (action === "outgoing" || action === "incoming") {
    const blockers = action === "outgoing" ? outgoingBlockers(booking)
      : ["started", "paused"].includes(booking.rentalProgress?.latestTripStatus ?? "")
        ? ["End the active telematics trip before Incoming Inspection."] : [];
    if (blockers.length === 0) return <BookingInspectionDialog open type={action} booking={booking} personnelName={undefined} onOpenChange={(open) => { if (!open) onClose(); }} onSaved={(updated) => { onUpdated(updated); onClose(); }} />;
    return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><FormDialogContent width="compact">
      <FormDialogHeader title={action === "outgoing" ? "Outgoing Inspection" : "Incoming Inspection"} icon={ClipboardCheck} onClose={onClose} closeLabel={action === "outgoing" ? "Close outgoing inspection" : "Close incoming inspection"} />
      <div className="p-4 sm:p-6"><Requirements items={blockers} /></div>
      <FormDialogFooter><Button type="button" variant="outline" onClick={onClose}>Close</Button></FormDialogFooter>
    </FormDialogContent></Dialog>;
  }

  if (action === "assign-driver" || action === "reassign-driver") return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><FormDialogContent width="compact">
    <FormDialogHeader title={action === "reassign-driver" ? "Reassign Driver" : "Assign Driver"} icon={UserRound} onClose={onClose} closeLabel="Close driver assignment" />
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={assign} noValidate>
      <div className="space-y-3 p-4 sm:p-6">
        <p className="text-xs text-muted-foreground">A valid assigned driver is required before Outgoing Inspection.</p>
        <SelectWithLabel id="booking-driver" label="Driver" required placeholder="Select a driver" options={drivers.map((driver) => ({ value: String(driver.id), label: driver.hasOutstandingBalance ? driver.name + " · Outstanding balance" : driver.name, disabled: driver.hasOutstandingBalance }))} value={selectedDriver} onValueChange={(value) => driverForm.setValue("driver_id", value, { shouldDirty: true })} error={driverForm.formState.errors.driver_id?.message} />
        {drivers.length === 0 ? <p className="text-xs text-muted-foreground">No drivers are available.</p> : null}
      </div>
      <FormDialogFooter><Button type="button" variant="outline" onClick={onClose}>Back</Button><Button type="submit" disabled={isActing || drivers.length === 0}>{isActing ? "Saving..." : "Save Driver"}</Button></FormDialogFooter>
    </form>
  </FormDialogContent></Dialog>;

  if (action === "prepare-handover") {
    const handover = booking.telematicsHandover;
    const geofence = handover?.geofence;
    const eligibility = handover?.eligibility;
    const blockers = [
      !eligibility?.documentsVerified && "Self-drive documents must be approved.",
      !eligibility?.rentalPeriodEligible && "Handover can start only on the scheduled Manila calendar date.",
      !eligibility?.outgoingInspectionComplete && "Finalize Outgoing Inspection with both signatures.",
      !geofence && "Assign a booking rental boundary.",
    ].filter((item): item is string => Boolean(item));
    return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><FormDialogContent>
      <FormDialogHeader title="Prepare Telematics Handover" icon={MapPinned} onClose={onClose} closeLabel="Close telematics handover" />
      <ScrollArea className="min-h-0 flex-1"><div className="space-y-4 p-4 sm:p-6">
        <p className="text-xs text-muted-foreground">Staff assigns this booking’s immutable rental boundary, then starts handover. The renter completes setup on their phone.</p>
        {geofence ? <div className="rounded-xl bg-background p-3 text-xs"><p className="font-semibold text-foreground">Assigned boundary: {geofence.name}</p><p className="mt-1 text-muted-foreground">{geofence.geometryType === "polygon" ? "Polygon" : String(geofence.radiusMeters ?? "—") + " m circle"}</p></div> :
          <form id="booking-geofence-form" className="space-y-3" onSubmit={assignGeofence} noValidate>
            <SelectWithLabel id="booking-geofence-source" label="Boundary source" options={[{ value: "custom", label: "Custom circle" }, ...templates.map((item) => ({ value: String(item.id), label: item.name }))]} value={selectedGeofence} onValueChange={(value) => geofenceForm.setValue("source_geofence_id", value, { shouldDirty: true })} error={geofenceForm.formState.errors.source_geofence_id?.message} />
            {selectedGeofence === "custom" ? <div className="grid gap-3 sm:grid-cols-2">
              <InputWithLabel id="booking-geofence-name" label="Boundary name" required error={geofenceForm.formState.errors.name?.message} {...geofenceForm.register("name")} />
              <InputWithLabel id="booking-geofence-radius" label="Radius (meters)" type="number" required error={geofenceForm.formState.errors.radius_meters?.message} {...geofenceForm.register("radius_meters")} />
              <InputWithLabel id="booking-geofence-latitude" label="Center latitude" type="number" required error={geofenceForm.formState.errors.center_latitude?.message} {...geofenceForm.register("center_latitude")} />
              <InputWithLabel id="booking-geofence-longitude" label="Center longitude" type="number" required error={geofenceForm.formState.errors.center_longitude?.message} {...geofenceForm.register("center_longitude")} />
            </div> : <p className="text-xs text-muted-foreground">The selected template is copied into this booking.</p>}
            <Button type="submit" disabled={isActing}>{isActing ? "Assigning..." : "Assign Rental Boundary"}</Button>
          </form>}
        <Requirements items={blockers} />
      </div></ScrollArea>
      <FormDialogFooter><Button type="button" variant="outline" onClick={onClose}>Back</Button><Button type="button" disabled={isActing || !eligibility?.canStartHandover} onClick={() => void run(() => startTelematicsHandover(booking), "Telematics handover started.")}>{isActing ? "Starting..." : "Start Handover"}</Button></FormDialogFooter>
    </FormDialogContent></Dialog>;
  }

  if (action === "review-charges") return <><Dialog open={!chargesOpen} onOpenChange={(open) => { if (!open) onClose(); }}><FormDialogContent>
    <FormDialogHeader title="Review Return Charges" icon={ReceiptText} onClose={onClose} closeLabel="Close return charge review" />
    <ScrollArea className="min-h-0 flex-1"><div className="space-y-3 p-4 sm:p-6">
      <p className="text-xs text-muted-foreground">Review the incoming condition and add any customer- or driver-responsible charges. Finalizing closes charge entry for this return.</p>
      {(booking.additionalCharges ?? []).map((charge) => <div key={charge.id} className="rounded-xl bg-background p-3 text-xs"><p className="font-semibold text-foreground">{charge.typeLabel} · PHP {charge.amount.toFixed(2)}</p><p className="mt-1 text-muted-foreground">{charge.description} · {charge.responsibility}</p></div>)}
      {(booking.additionalCharges ?? []).length === 0 ? <p className="text-xs text-muted-foreground">No additional charges recorded.</p> : null}
      <Button type="button" variant="outline" onClick={() => setChargesOpen(true)}>Add Charges</Button>
    </div></ScrollArea>
    <FormDialogFooter><Button type="button" variant="outline" onClick={onClose}>Back</Button><Button type="button" disabled={isActing} onClick={() => void run(() => finalizeReturnCharges(booking), "Return charges finalized.")}>{isActing ? "Finalizing..." : "Finalize Review"}</Button></FormDialogFooter>
  </FormDialogContent></Dialog>
    <AdditionalChargesDialog open={chargesOpen} onOpenChange={setChargesOpen} booking={booking} onSaved={onUpdated} />
  </>;

  const blockers = action === "start-rental" ? releaseBlockers(booking) : action === "complete" && (booking.remainingBalance > 0 || !booking.readiness?.customerChargesSettled) ? ["Customer balance and customer charges must be settled first."] : [];
  const title = bookingActionLabels[action];
  const operation = action === "start-rental" ? startRental : action === "mark-returned" ? markBookingReturned : completeBooking;
  const description = action === "start-rental" ? "Release the vehicle and change this booking to Ongoing?"
    : action === "mark-returned" ? "Confirm the vehicle return and change this booking to Returned?"
      : "Close this settled booking as Completed?";
  return <AlertDialog open onOpenChange={(open) => { if (!open) onClose(); }}><AlertDialogContent>
    <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{booking.bookingCode}: {description}</AlertDialogDescription></AlertDialogHeader>
    <Requirements items={blockers} />
    <AlertDialogFooter><AlertDialogCancel onClick={onClose}>Back</AlertDialogCancel><AlertDialogAction disabled={isActing || blockers.length > 0} onClick={(event) => { event.preventDefault(); void run(() => operation(booking), title + " completed."); }}>{isActing ? "Saving..." : title}</AlertDialogAction></AlertDialogFooter>
  </AlertDialogContent></AlertDialog>;
}
