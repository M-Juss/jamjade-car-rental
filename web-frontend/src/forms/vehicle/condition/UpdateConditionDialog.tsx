"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Path } from "react-hook-form";
import { ClipboardPenLine, RefreshCw, ShieldCheck } from "lucide-react";
import {
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
} from "@/components/common/forms/FormDialogLayout";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { VehicleConditionForm } from "@/modules/management/vehicles/inspection";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { appToast } from "@/lib/toast";
import { ApiError } from "@/services/http";
import {
  updateCurrentVehicleCondition,
  type VehicleConditionUpdateReason,
  type VehicleInspectionRecord,
} from "@/services/vehicle";
import { linkMaintenanceCondition } from "@/services/maintenance";
import {
  createVehicleConditionDefaults,
  createVehicleConditionUpdateSchema,
  VEHICLE_CONDITION_UPDATE_REASONS,
  type VehicleConditionFormValues,
  type VehicleConditionUpdateFormValues,
} from "@/validations/vehicle/schemas";

type UpdateConditionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  currentCondition: VehicleInspectionRecord;
  personnelName?: string;
  onSaved: () => void | Promise<void>;
  maintenanceRecordId?: string;
  defaultReason?: VehicleConditionUpdateReason;
  reasonLocked?: boolean;
  finalizeCondition?: (values: VehicleConditionUpdateFormValues) => Promise<void>;
  successMessage?: string;
};

function conditionFromSnapshot(inspection: VehicleInspectionRecord): VehicleConditionFormValues {
  const empty = createVehicleConditionDefaults();
  const checklist = Object.fromEntries(
    Object.entries(empty.checklist).map(([category, items]) => [
      category,
      Object.fromEntries(
        Object.keys(items).map((key) => [
          key,
          inspection.checklist?.[category as keyof typeof empty.checklist]
            ?.find((item) => item.key === key)?.value ?? false,
        ]),
      ),
    ]),
  ) as VehicleConditionFormValues["checklist"];

  return {
    odometer: String(inspection.odometer),
    fuel_level: inspection.fuelLevel,
    comments: inspection.comments ?? "",
    checklist,
    markers: (inspection.markers ?? []).map((marker) => ({
      id: marker.id,
      sequenceNumber: marker.sequenceNumber,
      panel: marker.panel,
      xPosition: marker.xPosition,
      yPosition: marker.yPosition,
      issueType: marker.issueType,
      description: marker.description,
    })),
    signature_data: "",
  };
}

function formDefaults(
  inspection: VehicleInspectionRecord,
  defaultReason: VehicleConditionUpdateReason | "" = "",
): VehicleConditionUpdateFormValues {
  return {
    reason: defaultReason,
    notes: "",
    condition: conditionFromSnapshot(inspection),
  };
}

function mapServerField(field: string) {
  return field
    .replace(/\.sequence_number/g, ".sequenceNumber")
    .replace(/\.x_position/g, ".xPosition")
    .replace(/\.y_position/g, ".yPosition")
    .replace(/\.issue_type/g, ".issueType");
}

export function UpdateConditionDialog({
  open,
  onOpenChange,
  vehicleId,
  currentCondition,
  personnelName,
  onSaved,
  maintenanceRecordId,
  defaultReason,
  reasonLocked = false,
  finalizeCondition,
  successMessage = "Current vehicle condition updated and finalized successfully.",
}: UpdateConditionDialogProps) {
  const schema = useMemo(
    () => createVehicleConditionUpdateSchema(currentCondition.odometer),
    [currentCondition.odometer],
  );
  const [pendingValues, setPendingValues] = useState<VehicleConditionUpdateFormValues | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const {
    control,
    formState: { errors },
    handleSubmit,
    reset,
    setError,
    setValue,
  } = useForm<VehicleConditionUpdateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: formDefaults(currentCondition, defaultReason ?? ""),
  });
  const values = useWatch({ control }) as VehicleConditionUpdateFormValues;

  useEffect(() => {
    if (open) reset(formDefaults(currentCondition, defaultReason ?? ""));
  }, [currentCondition, defaultReason, open, reset]);

  const close = (nextOpen: boolean) => {
    if (isFinalizing) return;
    if (!nextOpen) {
      reset(formDefaults(currentCondition, defaultReason ?? ""));
      setPendingValues(null);
      setConfirmOpen(false);
    }
    onOpenChange(nextOpen);
  };

  const review = (nextValues: VehicleConditionUpdateFormValues) => {
    setPendingValues(nextValues);
    setConfirmOpen(true);
  };

  const finalize = async () => {
    if (!pendingValues) return;
    setIsFinalizing(true);

    try {
      if (finalizeCondition) {
        await finalizeCondition(pendingValues);
      } else {
        const inspection = await updateCurrentVehicleCondition(vehicleId, pendingValues);
        if (maintenanceRecordId) {
          await linkMaintenanceCondition(maintenanceRecordId, inspection.id);
        }
      }
      appToast.success(successMessage);
      setConfirmOpen(false);
      onOpenChange(false);
      await onSaved();
    } catch (error) {
      setConfirmOpen(false);
      if (error instanceof ApiError && error.errors) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          if (messages[0]) {
            setError(mapServerField(field) as Path<VehicleConditionUpdateFormValues>, {
              type: "server",
              message: messages[0],
            });
          }
        });
      }
      const serverMessage = error instanceof ApiError && error.errors
        ? Object.values(error.errors).flat()[0]
        : undefined;
      appToast.error(
        serverMessage
          ? `The vehicle condition could not be updated. ${serverMessage}`
          : "The vehicle condition could not be updated. Please try again.",
      );
    } finally {
      setIsFinalizing(false);
    }
  };

  const selectedReason = VEHICLE_CONDITION_UPDATE_REASONS.find(
    ({ value }) => value === pendingValues?.reason,
  );

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <FormDialogContent width="wide" className="h-[92dvh] max-h-[900px]">
          <FormDialogHeader
            title="Update Current Condition"
            icon={ClipboardPenLine}
            onClose={() => close(false)}
            closeLabel="Close current condition form"
          />
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={handleSubmit(review, () => appToast.error("Complete every required update field."))}
          >
            <ScrollArea className="min-h-0 flex-1">
              <div className="grid gap-5 p-4 sm:p-6">
                <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
                  <div className="mb-4 flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                      <RefreshCw size={17} />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-foreground">Update details</h2>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        Select the operational reason for replacing the accepted current snapshot.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectWithLabel
                      id="condition-update-reason"
                      label="Reason"
                      required
                      placeholder="Select a reason"
                      options={[...VEHICLE_CONDITION_UPDATE_REASONS]}
                      value={values.reason}
                      disabled={isFinalizing || reasonLocked}
                      error={errors.reason?.message}
                      onValueChange={(reason) => setValue("reason", reason, { shouldDirty: true, shouldValidate: true })}
                    />
                    <TextAreaWithLabel
                      id="condition-update-notes"
                      label="Update Notes"
                      required={values.reason === "other" || Number(values.condition.odometer) < currentCondition.odometer}
                      rows={3}
                      maxLength={3000}
                      disabled={isFinalizing}
                      placeholder="Add context for this condition update"
                      value={values.notes}
                      error={errors.notes?.message}
                      onChange={(event) => setValue("notes", event.target.value, { shouldDirty: true, shouldValidate: true })}
                    />
                  </div>
                </section>

                <VehicleConditionForm
                  value={values.condition}
                  errors={errors.condition}
                  personnelName={personnelName}
                  disabled={isFinalizing}
                  inspectionPurpose="condition_update"
                  onChange={(condition) => setValue("condition", condition, { shouldDirty: true })}
                />
              </div>
            </ScrollArea>
            <FormDialogFooter>
              <Button type="button" variant="outline" disabled={isFinalizing} onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isFinalizing}>
                Review &amp; Finalize
              </Button>
            </FormDialogFooter>
          </form>
        </FormDialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-[460px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-primary/10 text-primary">
              <ShieldCheck />
            </AlertDialogMedia>
            <AlertDialogTitle>Finalize this current condition update?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates a new immutable snapshot and makes it the vehicle&apos;s current condition. The previous snapshot cannot be changed and will remain in history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingValues && (
            <div className="grid gap-2 rounded-xl border border-border bg-background p-3 text-xs">
              <p><span className="text-muted-foreground">Reason:</span> <span className="font-semibold text-foreground">{selectedReason?.label}</span></p>
              <p><span className="text-muted-foreground">Odometer:</span> <span className="font-semibold text-foreground">{Number(pendingValues.condition.odometer).toLocaleString()} km</span></p>
              <p><span className="text-muted-foreground">Fuel:</span> <span className="font-semibold text-foreground">{pendingValues.condition.fuel_level}/8</span></p>
              <p><span className="text-muted-foreground">Body issues:</span> <span className="font-semibold text-foreground">{pendingValues.condition.markers.length}</span></p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={isFinalizing}>Go Back</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={isFinalizing}
              onClick={(event) => {
                event.preventDefault();
                void finalize();
              }}
            >
              {isFinalizing ? "Finalizing..." : "Finalize Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
