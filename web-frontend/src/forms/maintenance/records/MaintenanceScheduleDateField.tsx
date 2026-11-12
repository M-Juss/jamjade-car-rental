"use client";

import { forwardRef, useState, type ComponentPropsWithoutRef } from "react";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";

type MaintenanceScheduleDateFieldProps = Omit<
  ComponentPropsWithoutRef<typeof InputWithLabel>,
  "type" | "value" | "defaultValue"
> & { value: string };

export const MaintenanceScheduleDateField = forwardRef<HTMLInputElement, MaintenanceScheduleDateFieldProps>(
  ({ value = "", onFocus, onBlur, onChange, placeholder = "Select date", ...props }, ref) => {
    const [editing, setEditing] = useState(false);
    const date = new Date(`${value}T00:00:00+08:00`);
    const formattedValue = value && Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(date)
      : "";

    return (
      <InputWithLabel
        {...props}
        ref={ref}
        type={editing ? "date" : "text"}
        value={editing ? value : formattedValue}
        placeholder={placeholder}
        onChange={(event) => { if (editing) onChange?.(event); }}
        onFocus={(event) => { setEditing(true); onFocus?.(event); }}
        onBlur={(event) => { setEditing(false); onBlur?.(event); }}
      />
    );
  },
);

MaintenanceScheduleDateField.displayName = "MaintenanceScheduleDateField";
