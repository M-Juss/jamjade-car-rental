"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import {
  VEHICLE_ISSUE_TYPE_LABELS,
  VEHICLE_ISSUE_TYPES,
  type VehicleIssueType,
} from "./types";

type VehicleIssueEditorProps = {
  pointNumber: number;
  initialIssueType?: VehicleIssueType;
  initialDescription?: string;
  isNew: boolean;
  onCancel: () => void;
  onSave: (issueType: VehicleIssueType, description: string) => void;
};

export function VehicleIssueEditor({
  pointNumber,
  initialIssueType,
  initialDescription = "",
  isNew,
  onCancel,
  onSave,
}: VehicleIssueEditorProps) {
  const [issueType, setIssueType] = useState<VehicleIssueType | "">(
    initialIssueType ?? "",
  );
  const [description, setDescription] = useState(initialDescription);
  const [attempted, setAttempted] = useState(false);

  const issueTypeError = attempted && !issueType;
  const descriptionError = attempted && !description.trim();
  const normalizedDescription = description.trim();
  const isValid = Boolean(issueType && normalizedDescription);
  const hasChanges = isNew
    || issueType !== initialIssueType
    || normalizedDescription !== initialDescription.trim();

  return (
    <div className="rounded-xl border border-primary/30 bg-muted/40 p-4">
      <h4 className="text-sm font-semibold text-foreground">Point {pointNumber}</h4>
      <div className="mt-3 grid gap-3">
        <div>
          <SelectWithLabel
            id={`vehicle-issue-type-${pointNumber}`}
            label="Issue Type"
            placeholder="Select issue type"
            options={VEHICLE_ISSUE_TYPES.map((value) => ({
              value,
              label: VEHICLE_ISSUE_TYPE_LABELS[value],
            }))}
            value={issueType}
            onValueChange={(value) => setIssueType(value as VehicleIssueType)}
          />
          {issueTypeError && (
            <p className="mt-1 text-xs font-medium text-destructive">
              Select an issue type.
            </p>
          )}
        </div>
        <TextAreaWithLabel
          id={`vehicle-issue-description-${pointNumber}`}
          label="Description"
          textareaClassName="min-h-24 bg-surface"
          maxLength={1000}
          placeholder="Describe the issue and its exact location."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={descriptionError ? "Enter a description." : undefined}
        />
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!isNew && (!isValid || !hasChanges)}
          onClick={() => {
            setAttempted(true);
            if (!issueType || !normalizedDescription) return;
            onSave(issueType, normalizedDescription);
          }}
        >
          {isNew ? "Save" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
