import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VEHICLE_ISSUE_TYPE_LABELS, type VehicleBodyMarker } from "./types";

type VehicleIssueListProps = {
  markers: VehicleBodyMarker[];
  readonly?: boolean;
  selectedSequence?: number | null;
  onSelect?: (marker: VehicleBodyMarker) => void;
  onEdit?: (marker: VehicleBodyMarker) => void;
  onDelete?: (marker: VehicleBodyMarker) => void;
};

export function VehicleIssueList({
  markers,
  readonly,
  selectedSequence,
  onSelect,
  onEdit,
  onDelete,
}: VehicleIssueListProps) {
  if (markers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
        No body issues recorded for this view.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {markers.map((marker) => {
        const content = (
          <>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive text-xs font-semibold text-primary-foreground">
              {marker.sequenceNumber}
            </span>
            <span className="min-w-0 text-left">
              <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-foreground">
                <span className="font-normal text-muted-foreground">Point {marker.sequenceNumber}</span><span>{VEHICLE_ISSUE_TYPE_LABELS[marker.issueType]}</span>
              </span>
              <span className="mt-0.5 block break-words text-xs leading-5 text-muted-foreground">
                {marker.description}
              </span>
            </span>
          </>
        );

        if (readonly) {
          return (
            <div key={marker.sequenceNumber} className="flex gap-3 rounded-xl bg-background p-3">
              {content}
            </div>
          );
        }

        return (
          <div
            key={marker.sequenceNumber}
            className={`flex flex-col gap-2 rounded-xl border p-2 transition-colors sm:flex-row sm:items-start ${
              selectedSequence === marker.sequenceNumber
                ? "border-primary bg-muted"
                : "border-border bg-background hover:border-primary/50"
            }`}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 gap-3 rounded-lg p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-pressed={selectedSequence === marker.sequenceNumber}
              aria-label={`Select point ${marker.sequenceNumber}: ${VEHICLE_ISSUE_TYPE_LABELS[marker.issueType]}`}
              onClick={() => onSelect?.(marker)}
            >
              {content}
            </button>
            <div className="flex shrink-0 justify-end gap-1 sm:pt-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-10 sm:size-8"
                title={`Edit point ${marker.sequenceNumber}`}
                aria-label={`Edit point ${marker.sequenceNumber}`}
                onClick={() => onEdit?.(marker)}
              >
                <Pencil />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-10 text-destructive hover:bg-destructive/10 hover:text-destructive sm:size-8"
                title={`Delete point ${marker.sequenceNumber}`}
                aria-label={`Delete point ${marker.sequenceNumber}`}
                onClick={() => onDelete?.(marker)}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
