import type { FieldErrors } from "react-hook-form";
import {
  VEHICLE_CHECKLIST_CATEGORY_LABELS,
  type VehicleChecklistCategory,
} from "./definitions";
import { Checkbox } from "@/components/ui/checkbox";
import type { VehicleConditionFormValues } from "@/validations/vehicle/schemas";

type ChecklistSectionProps = {
  category: VehicleChecklistCategory;
  items: Record<string, string>;
  value: VehicleConditionFormValues["checklist"][VehicleChecklistCategory];
  onChange: (key: string, value: boolean) => void;
  disabled?: boolean;
  errors?: FieldErrors<VehicleConditionFormValues["checklist"][VehicleChecklistCategory]>;
};

export function ChecklistSection({
  category,
  value,
  items,
  onChange,
  disabled,
  errors,
}: ChecklistSectionProps) {

  return (
    <section className="min-w-0">
      <h3 className="text-sm font-semibold text-foreground">
        {VEHICLE_CHECKLIST_CATEGORY_LABELS[category]}
      </h3>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {Object.entries(items).map(([key, label]) => (
          <div
            key={key}
            data-item={`condition-checklist-${category}-${key}`}
            className="flex min-h-11 min-w-0 flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50 has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <Checkbox
              id={`condition-checklist-${category}-${key}`}
              checked={value[key] === null ? "indeterminate" : Boolean(value[key])}
              disabled={disabled}
              aria-invalid={Boolean(errors?.[key])}
              aria-describedby={errors?.[key] ? "checklist-error-" + category + "-" + key : undefined}
              onCheckedChange={(checked) => onChange(key, checked === true)}
            />
            <label htmlFor={"condition-checklist-" + category + "-" + key} className="min-w-0 flex-1 cursor-pointer leading-5 [overflow-wrap:anywhere]">{label}</label>
            {value[key] === null ? <span className="flex gap-1">
              <button type="button" disabled={disabled} className="min-h-11 min-w-11 rounded-md border border-border bg-surface px-2 text-primary" aria-label={"Mark " + label + " as Yes"} onClick={(event) => { event.preventDefault(); onChange(key, true); }}>Yes</button>
              <button type="button" disabled={disabled} className="min-h-11 min-w-11 rounded-md border border-border bg-surface px-2" aria-label={"Mark " + label + " as No"} onClick={(event) => { event.preventDefault(); onChange(key, false); }}>No</button>
            </span> : null}
            {errors?.[key]?.message ? <p id={"checklist-error-" + category + "-" + key} role="alert" className="w-full text-xs font-medium text-destructive">{errors[key].message}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
