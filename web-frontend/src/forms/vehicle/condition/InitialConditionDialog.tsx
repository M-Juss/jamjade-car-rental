"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { ClipboardCheck } from "lucide-react";
import {
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
} from "@/components/common/forms/FormDialogLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VehicleConditionForm } from "@/modules/management/vehicles/inspection";
import { appToast } from "@/lib/toast";
import { ApiError } from "@/services/http";
import { setInitialVehicleCondition } from "@/services/vehicle";
import {
  createVehicleConditionDefaults,
  vehicleConditionSchema,
  type VehicleConditionFormValues,
} from "@/validations/vehicle/schemas";

type InitialConditionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  personnelName?: string;
  onSaved: () => void | Promise<void>;
};

export function InitialConditionDialog({
  open,
  onOpenChange,
  vehicleId,
  personnelName,
  onSaved,
}: InitialConditionDialogProps) {
  const [validationAttempted, setValidationAttempted] = useState(false);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
    setError,
    setValue,
  } = useForm<VehicleConditionFormValues>({
    resolver: zodResolver(vehicleConditionSchema),
    defaultValues: createVehicleConditionDefaults(),
  });
  const condition = useWatch({ control }) as VehicleConditionFormValues;

  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset(createVehicleConditionDefaults());
      setValidationAttempted(false);
    }
    onOpenChange(nextOpen);
  };

  const save = async (values: VehicleConditionFormValues) => {
    setValidationAttempted(true);

    try {
      await setInitialVehicleCondition(vehicleId, values);
      appToast.success("Initial vehicle condition configured successfully.");
      reset(createVehicleConditionDefaults());
      setValidationAttempted(false);
      onOpenChange(false);
      await onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          const clientField = field
            .replace(/^condition\./, "")
            .replace(/\.sequence_number/g, ".sequenceNumber")
            .replace(/\.x_position/g, ".xPosition")
            .replace(/\.y_position/g, ".yPosition")
            .replace(/\.issue_type/g, ".issueType");
          if (messages[0]) {
            setError(clientField as Path<VehicleConditionFormValues>, {
              type: "server",
              message: messages[0],
            });
          }
        });
      }
      appToast.error("The initial vehicle condition could not be saved. Please try again.");
    }
  };

  const submit = handleSubmit(save, () => {
    setValidationAttempted(true);
    appToast.error("Complete every required condition field.");
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      <FormDialogContent width="wide" className="h-[92dvh] max-h-[900px]">
        <FormDialogHeader
          title="Set Initial Vehicle Condition"
          icon={ClipboardCheck}
          onClose={() => close(false)}
          closeLabel="Close initial condition form"
        />
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4 sm:p-6">
              <VehicleConditionForm
                value={condition}
                errors={validationAttempted ? errors : undefined}
                personnelName={personnelName}
                disabled={isSubmitting}
                onChange={(nextCondition) => {
                  setValue("checklist_definition", nextCondition.checklist_definition);
                  setValue("checklist_version", nextCondition.checklist_version);
                  setValue("odometer", nextCondition.odometer, { shouldDirty: true, shouldValidate: validationAttempted });
                  setValue("fuel_level", nextCondition.fuel_level, { shouldDirty: true, shouldValidate: validationAttempted });
                  setValue("comments", nextCondition.comments, { shouldDirty: true, shouldValidate: validationAttempted });
                  setValue("checklist", nextCondition.checklist, { shouldDirty: true, shouldValidate: validationAttempted });
                  setValue("markers", nextCondition.markers, { shouldDirty: true, shouldValidate: validationAttempted });
                  setValue("signature_data", nextCondition.signature_data, { shouldDirty: true, shouldValidate: validationAttempted });
                }}
              />
            </div>
          </ScrollArea>
          <FormDialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Finalizing..." : "Finalize Initial Condition"}</Button>
          </FormDialogFooter>
        </form>
      </FormDialogContent>
    </Dialog>
  );
}
