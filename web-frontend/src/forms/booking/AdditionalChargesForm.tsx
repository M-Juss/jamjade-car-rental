"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useFieldArray, useForm, useWatch, type Path } from "react-hook-form";
import { CirclePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingDialogFooter } from "@/modules/management/bookings/components/BookingDialogFooter";
import { Card, CardContent } from "@/components/ui/card";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { additionalChargesSchema, type AdditionalChargesFormValues } from "@/validations/booking/schemas";
import { addAdditionalCharges, type BookingRecord } from "@/services/booking";
import { appToast } from "@/lib/toast";
import { ApiError } from "@/services/http";

const typeOptions = [
  ["late_return", "Late Return"], ["toll_fee", "Toll Fee"], ["vehicle_damage", "Vehicle Damage"],
  ["cleaning", "Cleaning"], ["fuel", "Fuel"], ["traffic_violation", "Traffic Violation"], ["other", "Other"],
].map(([value, label]) => ({ value, label }));

const emptyCharge = { type: "other" as const, description: "", amount: "", responsibility: "customer" as const };

export function AdditionalChargesForm({ onCancel, booking, onSaved, onBusyChange }: {
  onCancel: () => void; booking: BookingRecord; onSaved: () => Promise<void>; onBusyChange: (busy: boolean) => void;
}) {
  const { control, register, handleSubmit, setError, setValue, formState: { errors, isSubmitting } } = useForm<AdditionalChargesFormValues>({
    resolver: zodResolver(additionalChargesSchema), defaultValues: { charges: [emptyCharge] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "charges" });
  const charges = useWatch({ control, name: "charges" });
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { onBusyChange(isSubmitting); return () => onBusyChange(false); }, [isSubmitting, onBusyChange]);
  const submit = async (values: AdditionalChargesFormValues) => {
    try { await addAdditionalCharges(booking, values.charges); appToast.success("Additional charges added successfully."); await onSaved(); }
    catch (error) {
      if (error instanceof ApiError && error.errors) Object.entries(error.errors).forEach(([field, messages]) => {
        if (!messages[0]) return;
        if (/^charges\.\d+\.(type|description|amount|responsibility)$/.test(field)) setError(field as Path<AdditionalChargesFormValues>, { type: "server", message: messages[0] });
        else setError("root", { type: "server", message: "The charges could not be added. Check the booking return state and try again." });
      });
      else setError("root", { type: "server", message: "The charges could not be added. Please try again." });
      const firstField = error instanceof ApiError ? Object.keys(error.errors ?? {}).find((field) => error.errors?.[field]?.[0]) : undefined;
      const match = firstField?.match(/^charges\.(\d+)\.(type|description|amount|responsibility)$/);
      const body = formRef.current?.querySelector<HTMLElement>("[data-workflow-body]");
      const target = match ? formRef.current?.querySelector<HTMLElement>(`#charge-${match[2]}-${match[1]}`) : undefined;
      if (body && target) {
        body.scrollTop += target.getBoundingClientRect().top - body.getBoundingClientRect().top - 16;
        target.focus({ preventScroll: true });
      } else if (body) body.scrollTop = 0;
      appToast.error("The additional charges could not be added. Check the highlighted fields and return state.");
    }
  };
  return <form ref={formRef} noValidate className="flex min-h-0 flex-auto flex-col overflow-hidden" onSubmit={(event) => void handleSubmit(submit, () => appToast.error("Check every additional charge field."))(event)}>
      <div data-workflow-body className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="grid gap-4 p-4 sm:p-6">
        <h2 data-workflow-heading tabIndex={-1} className="text-sm font-bold text-foreground">Add Return Charges</h2>
        <p className="text-xs leading-5 text-muted-foreground">Describe each charge and its amount. Saving returns you to the review; it does not finalize the charges.</p>
        {errors.root?.message ? <p role="alert" className="text-xs text-destructive">{errors.root.message}</p> : null}
        <fieldset disabled={isSubmitting} className="grid min-w-0 gap-4">
        {fields.map((field, index) => <Card key={field.id} className="gap-0 rounded-2xl border border-border bg-surface py-4 ring-0"><CardContent className="grid gap-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-foreground">Charge {index + 1}</h3>
            {fields.length > 1 ? <Button type="button" variant="ghost" size="icon" aria-label={`Remove charge ${index + 1}`} onClick={() => remove(index)}><Trash2 size={16} /></Button> : null}</div>
          <div className="grid gap-3 sm:grid-cols-2">
          <SelectWithLabel id={`charge-type-${index}`} label="Type" required disabled={isSubmitting} options={typeOptions} value={charges[index]?.type}
            error={errors.charges?.[index]?.type?.message} onValueChange={(value) => setValue(`charges.${index}.type`, value as AdditionalChargesFormValues["charges"][number]["type"], { shouldDirty: true })} />
          <InputWithLabel id={`charge-amount-${index}`} label="Amount (PHP)" required type="number" min="0.01" max="9999999.99" step="0.01"
            error={errors.charges?.[index]?.amount?.message} {...register(`charges.${index}.amount`)} />
          </div>
          <TextAreaWithLabel id={`charge-description-${index}`} label="Description" required rows={3} maxLength={1000}
            placeholder="Explain what this charge covers."
            error={errors.charges?.[index]?.description?.message} {...register(`charges.${index}.description`)} />
          {booking.driverOption === "owners_driver" ? <SelectWithLabel id={`charge-responsibility-${index}`} label="Responsibility" required disabled={isSubmitting}
            options={[{ value: "customer", label: "Customer / Renter" }, { value: "driver", label: "Assigned Driver" }]}
            value={charges[index]?.responsibility ?? "customer"} error={errors.charges?.[index]?.responsibility?.message}
            onValueChange={(value) => setValue(`charges.${index}.responsibility`, value as "customer" | "driver", { shouldDirty: true })} />
            : null}
        </CardContent></Card>)}
        <Button type="button" variant="outline" onClick={() => append(emptyCharge)} disabled={fields.length >= 20}><CirclePlus size={15} className="mr-2" />Add Another Charge</Button>
        </fieldset>
      </div></div>
      <BookingDialogFooter><Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>Cancel Entry</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save & Review Charges"}</Button></BookingDialogFooter>
    </form>;
}
