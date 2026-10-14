"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { Circle, Fence, Minus, Trash2 } from "lucide-react";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { appToast } from "@/lib/toast";
import type { GeofenceRecord } from "@/services/geofence";
import { createGeofence, updateGeofence, saveBookingMonitoringZone } from "@/services/geofence";
import { geofenceTemplateSchema, type GeofenceTemplateFormValues } from "@/validations/geofence/schemas";
import { GeofenceMapEditor } from "@/modules/management/geofences/components/GeofenceMapEditor";

type ZoneEditorRecord = Pick<GeofenceRecord, "id" | "name" | "geometryType" | "centerLatitude" | "centerLongitude" | "radiusMeters" | "polygonCoordinates" | "notifyOnEnter" | "notifyOnExit">;

const defaults: GeofenceTemplateFormValues = {
  name: "",
  notifyOnEnter: true,
  notifyOnExit: true,
  geometryType: "circle",
  centerLatitude: "14.5995",
  centerLongitude: "120.9842",
  radiusMeters: "1000",
  polygonCoordinates: [],
};

function formValues(record?: ZoneEditorRecord): GeofenceTemplateFormValues {
  return record ? {
    name: record.name,
    notifyOnEnter: record.notifyOnEnter,
    notifyOnExit: record.notifyOnExit,
    geometryType: record.geometryType,
    centerLatitude: record.centerLatitude?.toString() ?? "",
    centerLongitude: record.centerLongitude?.toString() ?? "",
    radiusMeters: record.radiusMeters?.toString() ?? "",
    polygonCoordinates: (record.polygonCoordinates ?? []).map((point) => ({ latitude: String(point.latitude), longitude: String(point.longitude) })),
  } : defaults;
}

export function GeofenceTemplateDialog({
  open,
  onOpenChange,
  record,
  onSaved,
  bookingId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: ZoneEditorRecord;
  onSaved: () => void;
  bookingId?: number;
}) {
  const form = useForm<GeofenceTemplateFormValues>({ resolver: zodResolver(geofenceTemplateSchema), defaultValues: defaults });
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "polygonCoordinates" });
  const [polygonClosed, setPolygonClosed] = useState(() => record?.geometryType === "polygon");
  const geometryType = useWatch({ control: form.control, name: "geometryType" });
  const polygonCoordinates = useWatch({ control: form.control, name: "polygonCoordinates" }) ?? [];
  const centerLatitude = useWatch({ control: form.control, name: "centerLatitude" });
  const centerLongitude = useWatch({ control: form.control, name: "centerLongitude" });
  const radiusMeters = useWatch({ control: form.control, name: "radiusMeters" });

  useEffect(() => {
    if (open) {
      form.reset(formValues(record));
    }
  }, [form, open, record]);

  const close = () => {
    setPolygonClosed(record?.geometryType === "polygon");
    onOpenChange(false);
  };
  const submit = form.handleSubmit(async (values) => {
    // Intentional editor requirement: explicitly close a drawn polygon before saving.
    if (values.geometryType === "polygon" && !polygonClosed) {
      const message = "Click the first boundary point to close the polygon before saving.";
      form.setError("root", { message, type: "manual" });
      appToast.error(message);
      return;
    }

    try {
      if (bookingId) await saveBookingMonitoringZone(bookingId, values, record?.id);
      else if (record) await updateGeofence(record.id, values);
      else await createGeofence(values);
      appToast.success(record ? "Monitoring zone updated successfully." : "Monitoring zone created successfully.");
      close();
      onSaved();
    } catch (error) {
      const fieldMap: Record<string, keyof GeofenceTemplateFormValues> = {
        name: "name",
        notify_on_enter: "notifyOnEnter",
        notify_on_exit: "notifyOnExit",
        geometry_type: "geometryType",
        center_latitude: "centerLatitude",
        center_longitude: "centerLongitude",
        radius_meters: "radiusMeters",
        polygon_coordinates: "polygonCoordinates",
      };
      const apiError = error as { errors?: Record<string, string[]> };
      const entries = Object.entries(apiError.errors ?? {});
      entries.forEach(([key, messages]) => {
        const point = key.match(/^polygon_coordinates\.(\d+)\.(latitude|longitude)$/);
        if (point && messages[0]) {
          form.setError(`polygonCoordinates.${Number(point[1])}.${point[2] as "latitude" | "longitude"}`, { message: messages[0], type: "server" });
          return;
        }
        const field = fieldMap[key];
        if (field && messages[0]) form.setError(field, { message: messages[0], type: "server" });
      });
      const message = entries.some(([key]) => fieldMap[key] || key.startsWith("polygon_coordinates.")) ? "Check the highlighted zone details." : "The monitoring zone could not be saved. Refresh the booking or library and try again.";
      form.setError("root", { message, type: "server" });
      appToast.error(message);
    }
  }, () => appToast.error("Check the highlighted geofence details."));

  const addMapPoint = (point: { latitude: number; longitude: number }) => {
    setPolygonClosed(false);
    form.clearErrors("root");
    append({ latitude: point.latitude.toFixed(7), longitude: point.longitude.toFixed(7) });
  };
  const closePolygon = () => {
    setPolygonClosed(true);
    form.clearErrors("root");
  };
  const openPolygon = () => {
    setPolygonClosed(false);
    form.clearErrors("root");
  };
  const center = Number.isFinite(Number(centerLatitude)) && Number.isFinite(Number(centerLongitude))
    ? { latitude: Number(centerLatitude), longitude: Number(centerLongitude) }
    : null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <FormDialogContent width="wide">
        <FormDialogHeader title={record ? "Edit Monitoring Zone" : bookingId ? "Create Booking Zone" : "Create Default Zone"} icon={Fence} onClose={close} closeLabel="Close geofence form" />
        <form onSubmit={(event) => void submit(event)} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <InputWithLabel id="geofence-name" label="Geofence Name" required placeholder="Monitoring zone name" error={form.formState.errors.name?.message} {...form.register("name")} />
              <fieldset className="space-y-2">
                <legend className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Boundary Shape</legend>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={geometryType === "circle" ? "default" : "outline"} onClick={() => form.setValue("geometryType", "circle", { shouldDirty: true })}><Circle className="size-4" />Circle</Button>
                  <Button type="button" variant={geometryType === "polygon" ? "default" : "outline"} onClick={() => form.setValue("geometryType", "polygon", { shouldDirty: true })}><Fence className="size-4" />Polygon</Button>
                </div>
              </fieldset>
            </div>
            <fieldset className="shrink-0 space-y-2">
              <legend className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Website alerts</legend>
              <div className="flex flex-wrap gap-4">{(["notifyOnEnter", "notifyOnExit"] as const).map((name) => <Controller key={name} control={form.control} name={name} render={({ field }) => <label className="flex items-center gap-2 text-xs text-foreground"><Checkbox ref={field.ref} checked={field.value} onBlur={field.onBlur} onCheckedChange={(checked) => field.onChange(checked === true)} />{name === "notifyOnEnter" ? "Alert on entry" : "Alert on exit"}</label>} />)}</div>
              <p className="text-xs text-muted-foreground">Confirmed crossings are always recorded. Selected crossings also appear as website alerts.</p>
            </fieldset>
            <GeofenceMapEditor
              geometryType={geometryType}
              center={center}
              radiusMeters={Number(radiusMeters)}
              points={polygonCoordinates.map((point) => ({ latitude: Number(point.latitude), longitude: Number(point.longitude) })).filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))}
              polygonClosed={polygonClosed}
              onCircleCenter={(point) => {
                form.setValue("centerLatitude", point.latitude.toFixed(7), { shouldDirty: true, shouldValidate: true });
                form.setValue("centerLongitude", point.longitude.toFixed(7), { shouldDirty: true, shouldValidate: true });
              }}
              onPolygonPoint={addMapPoint}
              onClosePolygon={closePolygon}
              onOpenPolygon={openPolygon}
            />
            <p className="shrink-0 text-[11px] leading-5 text-muted-foreground">
              {geometryType === "circle"
                ? "Click the map to set the center, or enter coordinates below. Set a radius to preview the circle."
                : polygonClosed
                  ? "Boundary closed. Click the map to add another point, or click the first point to reopen the shape."
                  : "Click the map to add boundary points. Once you have at least three, click the first point to connect and close the shape."}
            </p>
            {geometryType === "circle" ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <InputWithLabel id="geofence-latitude" label="Center Latitude" required inputMode="decimal" error={form.formState.errors.centerLatitude?.message} {...form.register("centerLatitude")} />
                <InputWithLabel id="geofence-longitude" label="Center Longitude" required inputMode="decimal" error={form.formState.errors.centerLongitude?.message} {...form.register("centerLongitude")} />
                <InputWithLabel id="geofence-radius" label="Radius (meters)" required type="number" min="0" max="100000" step="any" error={form.formState.errors.radiusMeters?.message} {...form.register("radiusMeters")} />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex shrink-0 items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Boundary Points ({fields.length})</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={!fields.length} onClick={() => fields.length && remove(fields.length - 1)}><Minus className="size-3.5" />Undo</Button>
                    <Button type="button" size="sm" variant="outline" disabled={!fields.length} onClick={() => replace([])}><Trash2 className="size-3.5" />Clear</Button>
                  </div>
                </div>
                <div className="max-h-[240px] min-h-16 space-y-2 overflow-y-auto overscroll-contain pr-1">
                  {fields.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">Click the map to add the first boundary point.</p>
                  ) : null}
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2">
                      <span className="pb-3 text-xs font-semibold text-foreground">{index + 1}.</span>
                      <InputWithLabel id={`geofence-point-${index}-latitude`} label="Latitude" required inputMode="decimal" error={form.formState.errors.polygonCoordinates?.[index]?.latitude?.message} {...form.register(`polygonCoordinates.${index}.latitude`)} />
                      <InputWithLabel id={`geofence-point-${index}-longitude`} label="Longitude" required inputMode="decimal" error={form.formState.errors.polygonCoordinates?.[index]?.longitude?.message} {...form.register(`polygonCoordinates.${index}.longitude`)} />
                      <Button type="button" variant="ghost" size="icon" className="mb-1" aria-label={`Remove point ${index + 1}`} onClick={() => remove(index)}><Trash2 /></Button>
                    </div>
                  ))}
                  {form.formState.errors.polygonCoordinates?.message ? <p className="text-xs text-destructive">{form.formState.errors.polygonCoordinates.message}</p> : null}
                </div>
              </div>
            )}
            {form.formState.errors.root?.message ? <p className="text-xs text-destructive">{form.formState.errors.root.message}</p> : null}
          </div>
          <FormDialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving..." : record ? "Save Changes" : "Create Zone"}</Button>
          </FormDialogFooter>
        </form>
      </FormDialogContent>
    </Dialog>
  );
}
