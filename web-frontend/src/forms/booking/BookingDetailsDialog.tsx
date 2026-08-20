"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Car, ClipboardList, Info, Mail, Phone, UserRound } from "lucide-react";
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
import { assignDriver } from "@/services/booking";
import type { BookingRecord, BookingStatus, DriverCandidate, PaymentStatus } from "@/services/booking";
import {
  assignDriverSchema,
  type AssignDriverFormValues,
} from "@/validations/booking/schemas";

const bookingStatusStyle: Record<BookingStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-muted text-primary border-blue-200",
  rejected: "bg-rose-50 text-rose-600 border-rose-200",
  ongoing: "bg-emerald-50 text-emerald-700 border-emerald-200",
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
};

export function BookingDetailsDialog({
  open,
  onOpenChange,
  booking,
  drivers,
  onAssigned,
}: BookingDetailsDialogProps) {
  const [editingDriver, setEditingDriver] = useState(false);
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

  const pricingRows = [
    ["Subtotal", booking.subtotal],
    ["Delivery fee", booking.deliveryFee],
    ["Owner driver fee", booking.ownerDriverFee],
    ["Outside Manila fee", booking.outsideManilaFee],
    ["Toll fee", booking.tollFee],
    ["Late fee", booking.lateFee],
    ["Add-ons", booking.addOns],
    ["Discount", -booking.discount],
    ["Down payment", -booking.downPayment],
  ] as const;

  return (
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
                  <p className="truncate text-[11.5px] text-muted-foreground">Customer ID {booking.customer?.id ?? "—"}</p>
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
                  <p className="text-[11.5px] text-muted-foreground">Vehicle ID {booking.vehicleId}</p>
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
                        label: driver.name,
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
                <span className="text-[14px] font-bold text-primary">{peso(booking.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-[11.5px] text-muted-foreground">Payment status</span>
                <span className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold ${paymentStatusStyle[booking.paymentStatusKey]}`}>
                  {booking.paymentStatus}
                </span>
              </div>
            </section>
          </div>
        </ScrollArea>

        <FormDialogFooter
          className={booking.driverOption === "owners_driver" && booking.assignedDriver && !editingDriver ? "sm:grid-cols-3" : undefined}
        >
          {booking.driverOption === "owners_driver" &&
          booking.assignedDriver &&
          !editingDriver ? (
            <Button
              type="button"
              onClick={handleReassign}
              className="bg-primary text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(52,110,246,0.28)] hover:bg-primary-hover"
            >
              <UserRound size={14} className="mr-2" />
              Reassign Driver
            </Button>
          ) : null}
          <Button
            type="button"
            disabled
            title="Vehicle inspection is not available yet."
            className="cursor-not-allowed border-border text-[13px] font-medium text-muted-foreground hover:bg-background"
            variant="outline"
          >
            <ClipboardList size={14} className="mr-2" />
            Start Vehicle Inspection
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={close}
            className="border-border text-[13px] font-medium text-muted-foreground hover:bg-background"
          >
            Cancel
          </Button>
        </FormDialogFooter>
      </FormDialogContent>
    </Dialog>
  );
}