"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
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
import { VehicleIssueEditor } from "./VehicleIssueEditor";
import { VehicleIssueList } from "./VehicleIssueList";
import { VehiclePanel } from "./VehiclePanel";
import {
  VEHICLE_PANEL_ORDER,
  type PendingVehicleBodyMarker,
  type VehicleBodyInspectionMode,
  type VehicleBodyMarker,
  type VehicleIssueType,
  type VehiclePanelName,
} from "./types";

type VehicleBodyInspectionProps = {
  value: VehicleBodyMarker[];
  onChange?: (markers: VehicleBodyMarker[]) => void;
  mode?: VehicleBodyInspectionMode;
  comparisonMarkers?: VehicleBodyMarker[];
};

function panelLabel(panel: VehiclePanelName) {
  return panel.charAt(0).toUpperCase() + panel.slice(1);
}

export function VehicleBodyInspection({
  value,
  onChange,
  mode = "edit",
  comparisonMarkers = [],
}: VehicleBodyInspectionProps) {
  const [pendingMarker, setPendingMarker] = useState<PendingVehicleBodyMarker | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<number | null>(null);
  const [editingSequence, setEditingSequence] = useState<number | null>(null);
  const [deleteSequence, setDeleteSequence] = useState<number | null>(null);
  const readonly = mode !== "edit";
  const orderedMarkers = [...value].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const editingMarker = orderedMarkers.find(
    (marker) => marker.sequenceNumber === editingSequence,
  );
  const deleteMarker = orderedMarkers.find(
    (marker) => marker.sequenceNumber === deleteSequence,
  );

  const emit = (markers: VehicleBodyMarker[]) => {
    onChange?.(
      [...markers]
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
        .map((marker, index) => ({ ...marker, sequenceNumber: index + 1 })),
    );
  };

  const savePending = (issueType: VehicleIssueType, description: string) => {
    if (!pendingMarker) return;
    emit([...orderedMarkers, { ...pendingMarker, issueType, description }]);
    setPendingMarker(null);
  };

  const saveExisting = (issueType: VehicleIssueType, description: string) => {
    if (!editingMarker) return;
    emit(orderedMarkers.map((marker) =>
      marker.sequenceNumber === editingMarker.sequenceNumber
        ? { ...marker, issueType, description }
        : marker,
    ));
    setSelectedSequence(editingMarker.sequenceNumber);
    setEditingSequence(null);
  };

  const deleteExisting = () => {
    if (!deleteMarker) return;
    const deletedSequence = deleteMarker.sequenceNumber;
    emit(orderedMarkers.filter(
      (marker) => marker.sequenceNumber !== deletedSequence,
    ));
    setSelectedSequence((current) => {
      if (current === deletedSequence) return null;
      return current !== null && current > deletedSequence ? current - 1 : current;
    });
    setEditingSequence((current) => {
      if (current === deletedSequence) return null;
      return current !== null && current > deletedSequence ? current - 1 : current;
    });
    setDeleteSequence(null);
  };

  return (
    <div className="grid gap-6">
      {mode === "compare" && (
        <div className="flex flex-wrap gap-4 rounded-xl border border-border bg-background px-4 py-3 text-xs text-muted-foreground">
          <span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-destructive" />Current snapshot</span>
          <span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-warning" />Comparison snapshot</span>
        </div>
      )}
      {VEHICLE_PANEL_ORDER.map((panel) => {
        const panelMarkers = orderedMarkers.filter((marker) => marker.panel === panel);
        const panelComparisonMarkers = comparisonMarkers.filter((marker) => marker.panel === panel);
        const panelPending = pendingMarker?.panel === panel ? pendingMarker : null;
        const panelEditing = editingMarker?.panel === panel ? editingMarker : null;

        return (
          <section key={panel} aria-labelledby={`vehicle-panel-${panel}`} className="grid gap-3">
            <div>
              <h3 id={`vehicle-panel-${panel}`} className="text-sm font-bold uppercase tracking-wide text-foreground">
                {panelLabel(panel)}
              </h3>
              {!readonly && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Tap the vehicle body to add an issue. Zoom and pan do not change saved locations.
                </p>
              )}
            </div>
            <VehiclePanel
              panel={panel}
              markers={panelMarkers}
              comparisonMarkers={panelComparisonMarkers}
              pendingMarker={panelPending}
              selectedSequence={selectedSequence}
              readonly={readonly}
              disableNewMarker={pendingMarker !== null}
              onAddMarker={(markerPanel, xPosition, yPosition) => {
                setSelectedSequence(null);
                setEditingSequence(null);
                setPendingMarker({
                  sequenceNumber: orderedMarkers.length + 1,
                  panel: markerPanel,
                  xPosition,
                  yPosition,
                });
              }}
              onSelectMarker={(marker) => {
                if (pendingMarker) return;
                setSelectedSequence(marker.sequenceNumber);
                setEditingSequence(null);
              }}
            />
            {panelPending && (
              <VehicleIssueEditor
                key={`pending-${panelPending.sequenceNumber}`}
                pointNumber={panelPending.sequenceNumber}
                isNew
                onCancel={() => setPendingMarker(null)}
                onSave={savePending}
              />
            )}
            <VehicleIssueList
              markers={panelMarkers}
              readonly={readonly}
              selectedSequence={selectedSequence}
              onSelect={(marker) => {
                setSelectedSequence(marker.sequenceNumber);
                setEditingSequence(null);
              }}
              onEdit={(marker) => {
                setSelectedSequence(marker.sequenceNumber);
                setEditingSequence(marker.sequenceNumber);
              }}
              onDelete={(marker) => setDeleteSequence(marker.sequenceNumber)}
            />
            {panelEditing && !panelPending && (
              <VehicleIssueEditor
                key={`existing-${panelEditing.sequenceNumber}`}
                pointNumber={panelEditing.sequenceNumber}
                initialIssueType={panelEditing.issueType}
                initialDescription={panelEditing.description}
                isNew={false}
                onCancel={() => setEditingSequence(null)}
                onSave={saveExisting}
              />
            )}
          </section>
        );
      })}
      <AlertDialog
        open={deleteMarker !== undefined}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteSequence(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-[420px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete vehicle issue?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMarker
                ? `Point ${deleteMarker.sequenceNumber} and its description will be removed. Remaining points will be renumbered in inspection order.`
                : "This vehicle issue will be removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" variant="destructive" onClick={deleteExisting}>
              Delete issue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
