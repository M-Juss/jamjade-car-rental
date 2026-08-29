"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Car, CheckCircle2, Circle, ClipboardList, Info, Mail, Phone, UserRound } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import {
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
} from "@/components/common/forms/FormDialogLayout";
import { appToast } from "@/lib/toast";
import { ApiError } from "@/services/http";
import { assignDriver, cancelBooking, completeBooking, finalizeReturnCharges, getBooking, markBookingReturned, startRental } from "@/services/booking";
import type { BookingRecord, BookingStatus, DriverCandidate, PaymentStatus } from "@/services/booking";
import {
  assignDriverSchema,
  type AssignDriverFormValues,
} from "@/validations/booking/schemas";
import { BookingInspectionDialog } from "@/forms/booking/BookingInspectionDialog";
import { AdditionalChargesDialog } from "@/forms/booking/AdditionalChargesDialog";

const bookingStatusStyle: Record<BookingStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-muted text-primary border-blue-200",
  rejected: "bg-rose-50 text-rose-600 border-rose-200",
  ongoing: "bg-emerald-50 text-emerald-700 border-emerald-200",
  returned: "bg-cyan-50 text-cyan-700 border-cyan-200",
  completed: "bg-background text-muted-foreground border-border",
  cancelled: "bg-rose-50 text-rose-600 border-rose-200",
};

const paymentStatusStyle: Record<PaymentStatus, string> = {
  unpaid: "bg-background text-muted-foreground border-border",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-600 border-rose-200",
  refunded: "bg-violet-50 text-violet-700 border-violet-200",
};

function peso(value: number) {
  return `PHP ${Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function customerInitials(booking: BookingRecord) {
  return (booking.customer?.name || "Customer")
    .split(" ")
    .map((name) => name[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatISODate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatISOTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getAssignDriverErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return "The driver could not be assigned. Check your connection and try again.";
    }
  }

  return "The driver could not be assigned. Please try again.";
}

type BookingDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingRecord;
  drivers: DriverCandidate[];
  onAssigned: (updated: BookingRecord) => void;
  onUpdated: (updated: BookingRecord) => void;
};

export function BookingDetailsDialog({
  open,
  onOpenChange,
  booking,
  drivers,
  onAssigned,
  onUpdated,
}: BookingDetailsDialogProps) {
  const [editingDriver, setEditingDriver] = useState(false);
  const [details, setDetails] = useState<BookingRecord | null>(null);
  const [inspectionType, setInspectionType] = useState<"outgoing" | "incoming" | null>(null);
  const [chargesOpen, setChargesOpen] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const activeBooking = details ?? booking;
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    void getBooking(booking).then((record) => { if (!ignore) setDetails(record); }).catch(() => appToast.error("The latest booking readiness could not be loaded."));
    return () => { ignore = true; };
  }, [booking, open]);
  const {
    control,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssignDriverFormValues>({
    resolver: zodResolver(assignDriverSchema),
    defaultValues: { driver_id: booking.assignedDriver ? String(booking.assignedDriver.id) : "" },
  });

  const selectedDriverId = useWatch({ control, name: "driver_id" });

  const assignedDriverCandidate = booking.assignedDriver
    ? drivers.find((driver) => driver.id === booking.assignedDriver?.id)
    : undefined;

  const needsDriverEditor =
    booking.driverOption === "owners_driver" &&
    (!booking.assignedDriver || editingDriver);

  const close = () => {
    setEditingDriver(false);
    reset({
      driver_id: booking.assignedDriver ? String(booking.assignedDriver.id) : "",
    });
    onOpenChange(false);
  };

  const saveUpdated = (updated: BookingRecord) => {
    setDetails(updated);
    onUpdated(updated);
  };

  const runAction = async (action: () => Promise<BookingRecord>, success: string) => {
    try { setIsActing(true); const updated = await action(); saveUpdated(await getBooking(updated)); appToast.success(success); }
    catch (error) {
      const serverMessage = error instanceof ApiError && error.errors ? Object.values(error.errors).flat()[0] : undefined;
      appToast.error(serverMessage ?? "The booking action could not be completed.");
    } finally { setIsActing(false); }
  };

  const handleReassign = () => {
    setValue("driver_id", booking.assignedDriver ? String(booking.assignedDriver.id) : "", {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    });
    setEditingDriver(true);
  };

  const handleAssign = async (values: AssignDriverFormValues) => {
    try {
      const updated = await assignDriver(booking, Number(values.driver_id));
      appToast.success("Driver assigned successfully.");
      setEditingDriver(false);
      onAssigned(updated);
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        Object.entries(error.errors).forEach(([serverField, messages]) => {
          if (serverField === "driver_id" && messages[0]) {
            setError("driver_id", {
              type: "server",
              message: messages[0],
            });
          }
        });
      }

      appToast.error(getAssignDriverErrorMessage(error));
    }
  };

  const additionalChargesTotal = (activeBooking.additionalCharges ?? [])
    .filter((charge) => charge.responsibility === "customer")
    .reduce((total, charge) => total + charge.amount, 0);
  const pricingRows = [
    ["Subtotal", activeBooking.subtotal],
    ["Delivery fee", activeBooking.deliveryFee],
    ["Owner driver fee", activeBooking.ownerDriverFee],
    ["Outside Manila fee", activeBooking.outsideManilaFee],
    ["Toll fee", activeBooking.tollFee],
    ["Late fee", activeBooking.lateFee],
    ["Add-ons", activeBooking.addOns],
    ...(additionalChargesTotal > 0 ? [["Additional charges", additionalChargesTotal] as const] : []),
    ["Discount", -activeBooking.discount],
    ["Down payment", -activeBooking.downPayment],
  ] as const;

  return (
    <>
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) close(); }}>
      <FormDialogContent>
        <FormDialogHeader
          title="Booking Details"
          icon={Car}
          onClose={close}
          closeLabel="Close booking details"
        />

        <ScrollArea className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
            <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-mono text-xs font-semibold text-primary">{activeBooking.bookingCode}</p><h2 className="mt-1 text-lg font-bold text-foreground">Rental Progress</h2></div>
                <div className="flex gap-2"><span className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold ${bookingStatusStyle[activeBooking.statusKey]}`}>{activeBooking.adminStatus}</span><span className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold ${paymentStatusStyle[activeBooking.paymentStatusKey]}`}>{activeBooking.paymentStatus}</span></div>
              </div>
              <div className="space-y-2">
                {[
                  ["Confirmed", ["confirmed", "ongoing", "returned", "completed"].includes(activeBooking.statusKey)],
                  ["Handover", Boolean(activeBooking.readiness?.outgoingFinalized)],
                  ["Active Rental", ["ongoing", "returned", "completed"].includes(activeBooking.statusKey)],
                  ["Return", ["returned", "completed"].includes(activeBooking.statusKey)],
                  ["Completed", activeBooking.statusKey === "completed"],
                ].map(([label, done], index, steps) => (
                  <div key={String(label)} className="relative flex items-center gap-3">
                    {index < steps.length - 1 ? (
                      <div
                        aria-hidden="true"
                        className={`absolute left-[11px] top-6 h-[calc(100%+0.5rem)] w-px ${done ? "bg-success-border" : "bg-border"}`}
                      />
                    ) : null}
                    <div className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full ${done ? "bg-success-surface" : "border border-border bg-background"}`}>
                      {done ? <CheckCircle2 size={15} className="text-success" /> : <Circle size={15} className="text-subtle-foreground" />}
                    </div>
                    <div className={`min-w-0 flex-1 rounded-xl px-3 py-2 text-xs font-semibold ${done ? "bg-success-surface text-foreground" : "bg-background text-muted-foreground"}`}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="space-y-3 rounded-2xl border border-border bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">Customer</p>
              <div className="flex items-center gap-3 rounded-xl bg-background px-3 py-3">
                <Avatar className="h-11 w-11">
                  <AvatarFallback className="bg-muted text-[13px] font-bold text-primary">
                    {customerInitials(booking)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-foreground">{booking.customer?.name || "Customer"}</p>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-2.5 rounded-xl bg-background px-3 py-2.5">
                  <Mail size={14} className="shrink-0 text-subtle-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">Email</span>
                  <span className="truncate text-[12px] font-semibold text-foreground">{booking.customer?.email || "Not provided"}</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl bg-background px-3 py-2.5">
                  <Phone size={14} className="shrink-0 text-subtle-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">Phone</span>
                  <span className="truncate text-[12px] font-semibold text-foreground">{booking.customer?.phoneNumber || "Not provided"}</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl bg-background px-3 py-2.5">
                  <CalendarDays size={14} className="shrink-0 text-subtle-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">Member since</span>
                  <span className="truncate text-[12px] font-semibold text-foreground">
                    {booking.customer?.createdAt ? formatISODate(booking.customer.createdAt) : "—"}
                  </span>
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-border bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">Vehicle</p>
              <div className="flex items-center gap-3 rounded-xl bg-background px-3 py-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Car size={19} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-foreground">
                    {[booking.brand, booking.vehicleName, booking.model].filter(Boolean).join(" ") || "Vehicle unavailable"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Transmission", booking.transmission || "Not specified"],
                  ["Fuel type", booking.fuelType || "Not specified"],
                  ["Seats", booking.seats ? `${booking.seats} seats` : "Not specified"],
                  ["Daily rate", peso(booking.pricePerDay)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-background px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-subtle-foreground">{label}</p>
                    <p className="mt-0.5 text-[12.5px] font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            {booking.driverOption === "owners_driver" ? (
              <section className="space-y-3 rounded-2xl border border-border bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">Driver</p>

                {needsDriverEditor ? (
                  <form
                    onSubmit={handleSubmit(handleAssign, () => {
                      appToast.error("Select a driver to assign.");
                    })}
                    noValidate
                    className="space-y-3"
                  >
                    <SelectWithLabel
                      id="driver-select"
                      label="Driver"
                      required
                      placeholder="Select a driver"
                      options={drivers.map((driver) => ({
                        value: String(driver.id),
                        label: driver.hasOutstandingBalance ? `${driver.name} · Outstanding balance` : driver.name,
                        disabled: driver.hasOutstandingBalance,
                      }))}
                      value={selectedDriverId}
                      onValueChange={(value) =>
                        setValue("driver_id", value, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: false,
                        })
                      }
                      disabled={isSubmitting || drivers.length === 0}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      triggerClassName="text-[12.5px] rounded-xl border-border bg-background"
                    />
                    {errors.driver_id ? (
                      <p className="text-[10.5px] font-medium leading-tight text-destructive">
                        {errors.driver_id.message}
                      </p>
                    ) : null}

                    {drivers.length === 0 ? (
                      <p className="text-[11.5px] font-medium leading-5 text-muted-foreground">
                        No drivers are available. Add a driver account from staff management first.
                      </p>
                    ) : null}

                    <div className="rounded-xl bg-muted px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-subtle-foreground">
                        Active assignments
                      </p>
                      <p className="mt-0.5 text-[12.5px] font-semibold text-foreground">
                        {selectedDriverId
                          ? `${drivers.find((driver) => String(driver.id) === selectedDriverId)?.activeAssignments ?? 0} booking(s)`
                          : "Select a driver to view their load."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-primary text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(52,110,246,0.28)] hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <UserRound size={14} className="mr-2" />
                        {isSubmitting
                          ? "Saving..."
                          : booking.assignedDriver
                            ? "Save Driver"
                            : "Assign Driver"}
                      </Button>
                      {editingDriver ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isSubmitting}
                          onClick={() => setEditingDriver(false)}
                          className="border-border text-[13px] font-medium text-muted-foreground hover:bg-background"
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </form>
                ) : booking.assignedDriver ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 rounded-xl bg-background px-3 py-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <UserRound size={19} className="text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-bold text-foreground">{booking.assignedDriver.name}</p>
                        <p className="truncate text-[11.5px] text-muted-foreground">
                          {booking.assignedDriver.phoneNumber || "No phone number"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-background px-3 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-subtle-foreground">
                          Active assignments
                        </p>
                        <p className="mt-0.5 text-[12.5px] font-semibold text-foreground">
                          {assignedDriverCandidate
                            ? `${assignedDriverCandidate.activeAssignments} booking(s)`
                            : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-background px-3 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-subtle-foreground">
                          Assigned since
                        </p>
                        <p className="mt-0.5 text-[12.5px] font-semibold text-foreground">
                          {booking.driverAssignedAt ? formatISODate(booking.driverAssignedAt) : "—"}
                        </p>
                      </div>
                    </div>
                    {booking.statusKey === "pending" || booking.statusKey === "confirmed" ? (
                      <Button type="button" variant="outline" onClick={handleReassign} className="w-full">
                        <UserRound size={14} className="mr-2" />Reassign Driver
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : null}
            <section className="space-y-3 rounded-2xl border border-border bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">
                  Booking Overview
                </p>
                <span className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold ${bookingStatusStyle[booking.statusKey]}`}>
                  {booking.adminStatus}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Booking type", booking.bookingType],
                  ["Pickup type", booking.pickupLocationType === "delivery" ? "Delivery" : "Shop pickup"],
                  ["Pickup location", booking.pickupLocation],
                  [
                    "Rental date",
                    booking.rentalStartAt
                      ? formatISODate(booking.rentalStartAt)
                      : booking.rentalDate || "Not provided",
                  ],
                  [
                    "Rental time",
                    booking.rentalStartAt ? formatISOTime(booking.rentalStartAt) : "Not provided",
                  ],
                  [
                    "Return date",
                    booking.rentalEndAt
                      ? formatISODate(booking.rentalEndAt)
                      : booking.returnDate || "Not provided",
                  ],
                  [
                    "Return time",
                    booking.rentalEndAt ? formatISOTime(booking.rentalEndAt) : "Not provided",
                  ],
                  ["Rental period", `${booking.durationDays} day${booking.durationDays === 1 ? "" : "s"}`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-background px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-subtle-foreground">{label}</p>
                    <p className="mt-0.5 text-[12.5px] font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5">
                <Info size={13} className="mt-0.5 shrink-0 text-subtle-foreground" />
                <p className="text-[11.5px] font-medium leading-5 text-muted-foreground">
                  Vehicle returns to the same location it was picked up from.
                </p>
              </div>
            </section>

            <section className="space-y-2 rounded-2xl border border-border bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">Pricing</p>
              {pricingRows.map(([label, value]) => (
                <div key={label} className="flex justify-between text-[12.5px]">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-semibold ${value < 0 ? "text-emerald-600" : "text-foreground"}`}>
                    {value < 0 ? `-${peso(Math.abs(value))}` : peso(value)}
                  </span>
                </div>
              ))}
              <div className="h-px bg-border" />
              <div className="flex justify-between">
                <span className="text-[13px] font-bold text-foreground">Total</span>
                <span className="text-[14px] font-bold text-primary">{peso(activeBooking.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-[11.5px] text-muted-foreground">Payment status</span>
                <span className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold ${paymentStatusStyle[activeBooking.paymentStatusKey]}`}>
                  {activeBooking.paymentStatus}
                </span>
              </div>
            </section>
          </div>
        </ScrollArea>

        <FormDialogFooter className="sm:flex sm:flex-nowrap sm:items-center sm:gap-2 [&>*]:min-w-0 sm:[&>*]:w-auto sm:[&>*]:flex-1">
          {activeBooking.statusKey === "confirmed" && !activeBooking.readiness?.outgoingFinalized ? <Button type="button" disabled={isActing || !activeBooking.readiness || !activeBooking.readiness.paymentAcceptedForInspection || !activeBooking.readiness.driverAssigned || !activeBooking.readiness.driverEligible || !activeBooking.readiness.documentsApproved || !activeBooking.readiness.vehicleOperational} onClick={() => setInspectionType("outgoing")}><ClipboardList size={14} className="mr-2" />Start Outgoing Inspection</Button> : null}
          {activeBooking.statusKey === "confirmed" && activeBooking.readiness?.outgoingFinalized && activeBooking.readiness.calibrationPassed ? <Button type="button" disabled={isActing} onClick={() => void runAction(() => startRental(activeBooking), "Rental started successfully.")}>{isActing ? "Starting..." : "Start Rental"}</Button> : null}
          {activeBooking.statusKey === "ongoing" && !activeBooking.readiness?.incomingFinalized ? <Button type="button" disabled={isActing} onClick={() => setInspectionType("incoming")}><ClipboardList size={14} className="mr-2" />Start Incoming Inspection</Button> : null}
          {activeBooking.statusKey === "ongoing" && activeBooking.readiness?.incomingFinalized && !activeBooking.readiness.returnChargesFinalized ? <><Button type="button" variant="outline" onClick={() => setChargesOpen(true)}>Add Charges</Button><Button type="button" disabled={isActing} onClick={() => void runAction(() => finalizeReturnCharges(activeBooking), "Return charges reviewed and finalized.")}>Finalize Charges</Button></> : null}
          {activeBooking.statusKey === "ongoing" && activeBooking.readiness?.returnChargesFinalized ? <Button type="button" disabled={isActing} onClick={() => void runAction(() => markBookingReturned(activeBooking), "Booking marked Returned.")}>Mark Returned</Button> : null}
          {activeBooking.statusKey === "returned" && (activeBooking.readiness?.customerBalance ?? activeBooking.remainingBalance) <= 0 && activeBooking.readiness?.customerChargesSettled ? <Button type="button" disabled={isActing} onClick={() => void runAction(() => completeBooking(activeBooking), "Booking completed successfully.")}>Complete Booking</Button> : null}
          {["pending", "confirmed"].includes(activeBooking.statusKey) ? <Button type="button" variant="destructive" disabled={isActing} onClick={() => void runAction(() => cancelBooking(activeBooking), "Booking cancelled.")}>Cancel Booking</Button> : null}
          <Button type="button" variant="outline" onClick={close}>Close</Button>
        </FormDialogFooter>
      </FormDialogContent>
    </Dialog>
    {inspectionType ? <BookingInspectionDialog open type={inspectionType} booking={activeBooking} personnelName={undefined} onOpenChange={(next) => { if (!next) setInspectionType(null); }} onSaved={(updated) => { saveUpdated(updated); setInspectionType(null); }} /> : null}
    <AdditionalChargesDialog open={chargesOpen} onOpenChange={setChargesOpen} booking={activeBooking} onSaved={saveUpdated} />
    </>
  );
}
