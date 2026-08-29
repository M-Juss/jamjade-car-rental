"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { CirclePlus, ReceiptText, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { additionalChargesSchema, type AdditionalChargesFormValues } from "@/validations/booking/schemas";
import { addAdditionalCharges, type BookingRecord } from "@/services/booking";
import { appToast } from "@/lib/toast";

const typeOptions = [
  ["late_return", "Late Return"], ["toll_fee", "Toll Fee"], ["vehicle_damage", "Vehicle Damage"],
  ["cleaning", "Cleaning"], ["fuel", "Fuel"], ["traffic_violation", "Traffic Violation"], ["other", "Other"],
].map(([value, label]) => ({ value, label }));

const emptyCharge = { type: "other" as const, description: "", amount: "", responsibility: "customer" as const };

export function AdditionalChargesDialog({ open, onOpenChange, booking, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; booking: BookingRecord; onSaved: (booking: BookingRecord) => void;
}) {
  const { control, register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<AdditionalChargesFormValues>({
    resolver: zodResolver(additionalChargesSchema), defaultValues: { charges: [emptyCharge] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "charges" });
  const charges = useWatch({ control, name: "charges" });
  const submit = async (values: AdditionalChargesFormValues) => {
    try { const updated = await addAdditionalCharges(booking, values.charges); onSaved(updated); reset({ charges: [emptyCharge] }); onOpenChange(false); appToast.success("Additional charges added successfully."); }
    catch { appToast.error("The additional charges could not be added. Check the highlighted fields and return state."); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><FormDialogContent className="h-[92dvh] max-h-[900px]">
    <FormDialogHeader title="Additional Charges" icon={ReceiptText} onClose={() => onOpenChange(false)} closeLabel="Close additional charges" />
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit(submit, () => appToast.error("Check every additional charge field."))}>
      <ScrollArea className="min-h-0 flex-1"><div className="grid gap-4 p-4 sm:p-6">
        {fields.map((field, index) => <section key={field.id} className="grid gap-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-foreground">Charge {index + 1}</h3>
            {fields.length > 1 ? <Button type="button" variant="ghost" size="icon" aria-label={`Remove charge ${index + 1}`} onClick={() => remove(index)}><Trash2 size={16} /></Button> : null}</div>
          <SelectWithLabel id={`charge-type-${index}`} label="Type" required options={typeOptions} value={charges[index]?.type}
            error={errors.charges?.[index]?.type?.message} onValueChange={(value) => setValue(`charges.${index}.type`, value as AdditionalChargesFormValues["charges"][number]["type"], { shouldDirty: true })} />
          <TextAreaWithLabel id={`charge-description-${index}`} label="Description" required rows={3} maxLength={1000}
            error={errors.charges?.[index]?.description?.message} {...register(`charges.${index}.description`)} />
          <InputWithLabel id={`charge-amount-${index}`} label="Amount (PHP)" required type="number" min="0.01" step="0.01"
            error={errors.charges?.[index]?.amount?.message} {...register(`charges.${index}.amount`)} />
          {booking.driverOption === "owners_driver" ? <SelectWithLabel id={`charge-responsibility-${index}`} label="Responsibility" required
            options={[{ value: "customer", label: "Customer / Renter" }, { value: "driver", label: "Assigned Driver" }]}
            value={charges[index]?.responsibility ?? "customer"} error={errors.charges?.[index]?.responsibility?.message}
            onValueChange={(value) => setValue(`charges.${index}.responsibility`, value as "customer" | "driver", { shouldDirty: true })} />
            : <p className="rounded-xl bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">Self Drive charges are automatically assigned to the customer.</p>}
        </section>)}
        <Button type="button" variant="outline" onClick={() => append(emptyCharge)} disabled={fields.length >= 20}><CirclePlus size={15} className="mr-2" />Add Another Charge</Button>
      </div></ScrollArea>
      <FormDialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Adding..." : "Add Charges"}</Button></FormDialogFooter>
    </form>
  </FormDialogContent></Dialog>;
}
