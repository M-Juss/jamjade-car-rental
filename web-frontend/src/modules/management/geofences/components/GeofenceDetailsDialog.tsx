"use client";

import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { GeofenceRecord } from "@/services/geofence";
import { GeofenceMapEditor } from "./GeofenceMapEditor";

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-subtle-foreground">{label}</p>
      <div className="mt-1 text-xs font-semibold leading-5 text-foreground">{value}</div>
    </div>
  );
}

export function GeofenceDetailsDialog({
  record,
  onClose,
}: {
  record: GeofenceRecord | null;
  onClose: () => void;
}) {
  if (!record) return null;

  const circle = record.geometryType === "circle";
  const center = record.centerLatitude != null && record.centerLongitude != null
    ? { latitude: record.centerLatitude, longitude: record.centerLongitude }
    : null;
  const points = record.polygonCoordinates ?? [];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <FormDialogContent width="wide" className="h-[92dvh] max-h-[900px]">
        <FormDialogHeader title={`${record.name}`} icon={Eye} onClose={onClose} closeLabel="Close geofence details" />
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <GeofenceMapEditor
            geometryType={record.geometryType}
            center={center}
            radiusMeters={record.radiusMeters ?? undefined}
            points={points}
            polygonClosed
            readOnly
          />

          <section className="grid gap-4 rounded-2xl border border-border bg-background p-4 sm:grid-cols-3">
            <Detail label="Status" value={
              <Badge variant={record.isDeleted ? "outline" : record.isActive ? "default" : "secondary"}>
                {record.isDeleted ? "Deleted" : record.isActive ? "Active" : "Inactive"}
              </Badge>
            } />
            <Detail label="Shape" value={circle ? "Circle" : "Polygon"} />
            {circle ? (
              <>
                <Detail label="Center Latitude" value={record.centerLatitude?.toFixed(7) ?? "—"} />
                <Detail label="Center Longitude" value={record.centerLongitude?.toFixed(7) ?? "—"} />
                <Detail label="Radius" value={record.radiusMeters != null ? `${record.radiusMeters.toLocaleString()} m` : "—"} />
              </>
            ) : (
              <>
                <Detail label="Boundary Points" value={String(points.length)} />
                <Detail label="First Point" value={points.length ? `${points[0].latitude.toFixed(7)}, ${points[0].longitude.toFixed(7)}` : "—"} />
              </>
            )}
            <Detail label="Rental Snapshots" value={String(record.rentalSnapshotCount)} />
            <Detail label="Entry Alerts" value={record.notifyOnEnter ? "Enabled" : "Recorded only"} />
            <Detail label="Exit Alerts" value={record.notifyOnExit ? "Enabled" : "Recorded only"} />
            <Detail label="Created By" value={record.createdBy?.name ?? "—"} />
          </section>
        </div>
        <FormDialogFooter><Button type="button" onClick={onClose}>Close</Button></FormDialogFooter>
      </FormDialogContent>
    </Dialog>
  );
}
