import {
  VEHICLE_CHECKLIST,
  VEHICLE_CHECKLIST_CATEGORY_LABELS,
  type VehicleChecklistCategory,
} from "./definitions";
import { Checkbox } from "@/components/ui/checkbox";
import type { VehicleConditionFormValues } from "@/validations/vehicle/schemas";

type ChecklistSectionProps = {
  category: VehicleChecklistCategory;
  value: VehicleConditionFormValues["checklist"][VehicleChecklistCategory];
  onChange: (key: string, value: boolean) => void;
  disabled?: boolean;
};

export function ChecklistSection({
  category,
  value,
  onChange,
  disabled,
}: ChecklistSectionProps) {
  const items = VEHICLE_CHECKLIST[category];

  return (
    <section>
      <h3 className="text-sm font-bold text-foreground">
        {VEHICLE_CHECKLIST_CATEGORY_LABELS[category]}
      </h3>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {Object.entries(items).map(([key, label]) => (
          <label
            key={key}
            htmlFor={`condition-checklist-${category}-${key}`}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <Checkbox
              id={`condition-checklist-${category}-${key}`}
              checked={value[key]}
              disabled={disabled}
              onCheckedChange={(checked) => onChange(key, checked === true)}
            />
            <span className="leading-5">{label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
