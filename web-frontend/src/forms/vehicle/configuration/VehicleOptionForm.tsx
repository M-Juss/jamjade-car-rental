"use client";

import { useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { FormDialogFooter } from "@/components/common/forms/FormDialogLayout";
import { vehicleOptionSchema, type VehicleOptionValues } from "@/validations/vehicle/configuration";
import { saveVehicleOption, type VehicleConfigurationOption, type VehicleOptionSection } from "@/services/vehicle/configuration.service";
import { ApiError } from "@/services/http";
import { appToast } from "@/lib/toast";

export function VehicleOptionForm({ section, option, onBack, onSaved, onBusyChange }: {
  section: VehicleOptionSection; option?: VehicleConfigurationOption;
  onBack: () => void; onSaved: (option: VehicleConfigurationOption) => Promise<void>; onBusyChange: (busy: boolean) => void;
}) {
  const id = useId();
  const { register, handleSubmit, setError, control, setValue, formState: { errors, isSubmitting } } = useForm<VehicleOptionValues>({
    resolver: zodResolver(vehicleOptionSchema(section)),
    defaultValues: { name: option?.name ?? "", is_active: option?.is_active ?? true },
  });
  const active = useWatch({ control, name: "is_active" });
  const save = async (values: VehicleOptionValues) => {
    onBusyChange(true);
    try {
      const saved = await saveVehicleOption(section, values, option?.id);
      await onSaved(saved);
      appToast.success("Option saved.");
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        for (const field of ["name", "is_active"] as const) {
          const message = error.errors[field]?.[0];
          if (message) setError(field, { type: "server", message });
        }
      }
      appToast.error(error instanceof ApiError ? error.message : "Unable to save the option.");
    } finally { onBusyChange(false); }
  };
  return <form noValidate onSubmit={handleSubmit(save)} className="flex min-h-0 flex-1 flex-col">
    <div className="grid gap-4 overflow-y-auto p-4 sm:p-6">
      <InputWithLabel id={id} label="Name" required autoFocus disabled={isSubmitting} error={errors.name?.message} {...register("name")} />
      <label htmlFor={id + "-active"} className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <Checkbox id={id + "-active"} checked={active} disabled={isSubmitting} onCheckedChange={(checked) => setValue("is_active", checked === true, { shouldDirty: true })} />
        Active
      </label>
      {errors.is_active?.message ? <p role="alert" className="text-sm text-destructive">{errors.is_active.message}</p> : null}
    </div>
    <FormDialogFooter>
      <Button type="button" variant="outline" disabled={isSubmitting} onClick={onBack}>Back</Button>
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save"}</Button>
    </FormDialogFooter>
  </form>;
}
