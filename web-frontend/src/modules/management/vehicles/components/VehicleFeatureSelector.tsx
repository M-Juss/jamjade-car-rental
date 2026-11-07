"use client";

import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";

type VehicleFeatureSelectorProps = {
  value: string[];
  options: string[];
  onChange: (features: string[]) => void;
  disabled?: boolean;
  error?: string;
};

export function VehicleFeatureSelector({ value, options, onChange, disabled = false, error }: VehicleFeatureSelectorProps) {
  const id = useId();
  const names = [...new Set([...options, ...value])];
  return (
    <fieldset disabled={disabled} aria-describedby={error ? id + "-error" : undefined}>
      <legend className="text-sm font-semibold text-foreground">Features <span className="text-destructive">*</span></legend>
      <div className="mt-3 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
        {names.map((feature, index) => (
          <label key={feature} htmlFor={id + "-" + index} className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-xs font-medium text-foreground has-disabled:cursor-not-allowed has-disabled:opacity-60">
            <Checkbox id={id + "-" + index} checked={value.includes(feature)} disabled={disabled} aria-invalid={Boolean(error)}
              onCheckedChange={(checked) => onChange(checked === true ? [...value, feature] : value.filter((item) => item !== feature))} />
            <span className="min-w-0 flex-1 break-words leading-5">{feature}</span>
          </label>
        ))}
      </div>
      {error ? <p id={id + "-error"} role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
    </fieldset>
  );
}
