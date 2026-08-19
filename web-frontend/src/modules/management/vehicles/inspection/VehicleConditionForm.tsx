"use client";

import type { FieldErrors } from "react-hook-form";
import { Gauge, MessageSquareText, PenLine, Wrench } from "lucide-react";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import type { VehicleConditionFormValues } from "@/validations/vehicle/schemas";
import { ChecklistSection } from "./ChecklistSection";
import { FuelLevelSelector } from "./FuelLevelSelector";
import { SignaturePad } from "./SignaturePad";
import { VehicleBodyInspection } from "./VehicleBodyInspection";
import { VEHICLE_PANEL_ORDER } from "./types";

type VehicleConditionFormProps = {
  value: VehicleConditionFormValues;
  onChange: (value: VehicleConditionFormValues) => void;
  errors?: FieldErrors<VehicleConditionFormValues>;
  personnelName?: string;
  disabled?: boolean;
  inspectionPurpose?: "initial" | "condition_update";
};

function SectionHeading({ icon: Icon, title, description }: {
  icon: typeof Gauge;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
        <Icon size={17} />
      </div>
      <div>
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

export function VehicleConditionForm({
  value,
  onChange,
  errors,
  personnelName,
  disabled,
  inspectionPurpose = "initial",
}: VehicleConditionFormProps) {
  const update = <K extends keyof VehicleConditionFormValues>(
    key: K,
    nextValue: VehicleConditionFormValues[K],
  ) => onChange({ ...value, [key]: nextValue });

  return (
    <div className="grid gap-5">
      <section id="condition-mileage-fuel" tabIndex={-1} className="scroll-mt-4 rounded-2xl border border-border bg-surface p-4 outline-none sm:p-5">
        <SectionHeading
          icon={Gauge}
          title="Mileage & Fuel"
          description="Record the accepted odometer and fuel readings for this snapshot."
        />
        <div className="grid gap-5">
          <InputWithLabel
            id="condition-odometer"
            label="Odometer"
            required
            type="number"
            min="0"
            inputMode="numeric"
            disabled={disabled}
            value={value.odometer}
            error={errors?.odometer?.message}
            onChange={(event) => update("odometer", event.target.value)}
          />
          <FuelLevelSelector
            value={value.fuel_level}
            disabled={disabled}
            error={errors?.fuel_level?.message}
            onChange={(fuelLevel) => update("fuel_level", fuelLevel)}
          />
        </div>
      </section>

      <section id="condition-checklist" tabIndex={-1} className="scroll-mt-4 rounded-2xl border border-border bg-surface p-4 outline-none sm:p-5">
        <SectionHeading
          icon={Wrench}
          title="Checklist"
          description="Check each item that is present or in acceptable condition. Unchecked items are recorded as No."
        />
        <div className="grid gap-6">
          {Object.keys(value.checklist).map((category) => (
            <ChecklistSection
              key={category}
              category={category as keyof typeof value.checklist}
              value={value.checklist[category as keyof typeof value.checklist]}
              disabled={disabled}
              onChange={(key, selected) => update("checklist", {
                ...value.checklist,
                [category]: {
                  ...value.checklist[category as keyof typeof value.checklist],
                  [key]: selected,
                },
              })}
            />
          ))}
        </div>
        {errors?.checklist?.message && (
          <p className="mt-3 text-xs font-medium text-destructive">{errors.checklist.message}</p>
        )}
      </section>

      <section id="condition-body" tabIndex={-1} className="scroll-mt-4 rounded-2xl border border-border bg-surface p-4 outline-none sm:p-5">
        <SectionHeading
          icon={Gauge}
          title="Vehicle Body Condition"
          description={`Inspect in this order: ${VEHICLE_PANEL_ORDER.map((panel) => panel[0].toUpperCase() + panel.slice(1)).join(" → ")}. Markers use one global sequence.`}
        />
        <VehicleBodyInspection
          value={value.markers}
          onChange={(markers) => update("markers", markers)}
          mode={disabled ? "readonly" : "edit"}
        />
        {errors?.markers?.message && (
          <p className="mt-3 text-xs font-medium text-destructive">{errors.markers.message}</p>
        )}
      </section>

      <section id="condition-comments-section" tabIndex={-1} className="scroll-mt-4 rounded-2xl border border-border bg-surface p-4 outline-none sm:p-5">
        <SectionHeading icon={MessageSquareText} title="Comments / Other Issues" />
        <TextAreaWithLabel
          id="condition-comments"
          label="Comments"
          rows={4}
          maxLength={3000}
          disabled={disabled}
          value={value.comments}
          error={errors?.comments?.message}
          onChange={(event) => update("comments", event.target.value)}
        />
      </section>

      <section id="condition-signature" tabIndex={-1} className="scroll-mt-4 rounded-2xl border border-border bg-surface p-4 outline-none sm:p-5">
        <SectionHeading
          icon={PenLine}
          title="Jamjade Personnel Signature"
          description={personnelName
            ? `${personnelName} will be recorded as the authenticated signer. The server records the signing time.`
            : "The authenticated personnel account and server time will be recorded automatically."}
        />
        <p className="mb-4 rounded-xl border border-border bg-background px-3 py-2.5 text-xs leading-5 text-muted-foreground">
          By signing, I acknowledge that the mileage, fuel level, checklist responses,
          vehicle-body issue markers, and comments recorded above are complete and accurate
          for this {inspectionPurpose === "condition_update" ? "current condition update" : "initial condition inspection"}.
        </p>
        <SignaturePad
          value={value.signature_data}
          disabled={disabled}
          onChange={(signature) => update("signature_data", signature)}
        />
        {errors?.signature_data?.message && (
          <p className="mt-1.5 text-xs font-medium text-destructive">{errors.signature_data.message}</p>
        )}
      </section>
    </div>
  );
}
