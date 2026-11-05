"use client";

import { useId, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { TABLE_PAGE_SIZE } from "@/lib/table-pagination";
import { FormFieldError } from "@/components/common/forms/FormFieldError";
import { appToast } from "@/lib/toast";
import { ApiError } from "@/services/http";
import { saveAnnotations, type AnnotationRevision } from "@/services/research/annotations.service";
import type { NativeChannel, NativeRecording, NativeWindow } from "@/services/research/native-types";
import { annotationRevisionSchema, movements, directions, severities, certainties, annotationSources, type AnnotationValues } from "@/validations/research/annotations";
import { NativeSignalWindow } from "@/modules/management/research/components/NativeSignalWindow";
import { SignalTimeline } from "@/modules/management/research/components/SignalTimeline";
import { SignalSelectionControls } from "@/modules/management/research/components/SignalSelectionControls";
import { nativeSignalPoints } from "@/modules/management/research/native-analysis";
import { humanize, seconds } from "@/modules/management/research/recording-analysis";
import type { ReferenceRange } from "@/modules/management/research/forward-reference";

const channels: NativeChannel[] = ["accelerometer"];
const label = (value: string) => ({ driving: "Straight driving", not_applicable: "Not applicable", operator_report: "Operator report", signal_review: "Signals only", observed: "Direct observation", reviewed: "Reviewed", uncertain: "Uncertain / approximate" }[value] ?? humanize(value));

export function AnnotationForm({ record, origin, saved, onSaved, onReload }: {
  record: NativeRecording; origin: string; saved: AnnotationRevision | null; onSaved: (r: AnnotationRevision) => void; onReload: () => void;
}) {
  const id = useId();
  const form = useForm<AnnotationValues>({ resolver: zodResolver(annotationRevisionSchema), defaultValues: { base_revision: saved?.revision ?? 0, intervals: saved?.intervals ?? [] } });
  const array = useFieldArray({ control: form.control, name: "intervals" });
  // Subscribe for field edits, but read current values: structural field-array
  // updates can render before useWatch receives the new array.
  useWatch({ control: form.control, name: "intervals" });
  const items = form.getValues("intervals");
  const [editing, setEditing] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [conflict, setConflict] = useState(false);
  const busy = form.formState.isSubmitting;
  const errorAt = editing === null ? null : form.formState.errors.intervals?.[editing];
  const submit = async (values: AnnotationValues) => {
    form.clearErrors();
    try {
      const revision = await saveAnnotations(record.id, values);
      form.reset({ base_revision: revision.revision, intervals: revision.intervals });
      setConflict(false); onSaved(revision); appToast.success("Interval labels saved.");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 422) {
        let unmapped = false;
        for (const [key, messages] of Object.entries(cause.errors ?? {})) {
          const match = /^intervals\.(\d+)\.(start_ms|end_ms|movement|direction|severity|certainty|source|notes)$/.exec(key);
          if (match) {
            const index = Number(match[1]);
            if (index < items.length) {
              const field = match[2] as keyof AnnotationValues["intervals"][number];
              form.setError(`intervals.${index}.${field}`, { message: messages[0] }); setEditing(index); setPage(Math.floor(index / TABLE_PAGE_SIZE) + 1);
            } else unmapped = true;
          } else unmapped = true;
        }
        if (unmapped || !Object.keys(cause.errors ?? {}).length) form.setError("root", { message: "Review interval order, bounds and assessments." });
        appToast.error("Labels were not saved. Review the highlighted intervals.");
      } else {
        const stale = cause instanceof ApiError && cause.status === 409;
        setConflict(stale);
        const message = stale ? "Labels changed or this recording is unavailable. Reload before saving."
          : cause instanceof ApiError && [401, 419].includes(cause.status) ? "Sign in again before saving labels."
          : cause instanceof ApiError && cause.status === 403 ? "Research access is unavailable." : "Interval labels could not be saved. Try again.";
        form.setError("root", { message }); appToast.error(message);
      }
    }
  };
  const invalid = (errors: FieldErrors<AnnotationValues>) => {
    const index = items.findIndex((_, i) => errors.intervals?.[i]);
    if (index >= 0) { setEditing(index); setPage(Math.floor(index / TABLE_PAGE_SIZE) + 1); }
    appToast.error("Review interval times, order and assessments.");
  };
  return <form onSubmit={form.handleSubmit(submit, invalid)} className="space-y-4">
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      <NativeSignalWindow record={record} channels={channels}>
        {(windows, bounds) => <LabelSelection window={windows[0]} origin={origin} bounds={bounds} recordingId={record.id} disabled={busy || items.length >= 100}
          onAdd={range => {
            const current = form.getValues("intervals");
            const index = current.findIndex(item => item.start_ms > range[0]); const position = index < 0 ? current.length : index;
            array.insert(position, { start_ms: range[0], end_ms: range[1], movement: "other", direction: "unknown", severity: "unknown", certainty: "uncertain", source: "signal_review", notes: "" });
            setEditing(position); setPage(Math.floor(position / TABLE_PAGE_SIZE) + 1);
          }} />}
      </NativeSignalWindow>
      <p className="text-xs text-muted-foreground">Unmarked time stays unlabeled. Saving labels does not approve training data.</p>
      {items.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => { array.replace([...items].sort((a, b) => a.start_ms - b.start_ms)); setEditing(null); setPage(1); }}>Sort by time</Button>}
      {items.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No labeled intervals yet.</p>}
      <div className="space-y-2">{array.fields.slice((page - 1) * TABLE_PAGE_SIZE, page * TABLE_PAGE_SIZE).map((field, offset) => {
        const index = (page - 1) * TABLE_PAGE_SIZE + offset; const item = items[index];
        return <div key={field.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-xs">
          <div className="min-w-0"><p className="font-medium">{seconds(item.start_ms)}–{seconds(item.end_ms)} · {label(item.movement)}</p>
            <p className="text-muted-foreground">{label(item.direction)} · {label(item.severity)} · {label(item.certainty)}</p></div>
          <div className="flex gap-1"><Button type="button" size="sm" variant={editing === index ? "secondary" : "outline"} onClick={() => setEditing(index)}>Edit</Button>
            <Button type="button" size="sm" variant="ghost" aria-label={`Remove interval ${index + 1} from draft`} onClick={() => { array.remove(index); setEditing(null); setPage(1); }}>Remove</Button></div>
        </div>;
      })}</div>
      {items.length > TABLE_PAGE_SIZE && <TablePagination page={page} total={items.length} lastPage={Math.ceil(items.length / TABLE_PAGE_SIZE)} onPageChange={setPage} />}
      {editing !== null && items[editing] && <div className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold">Interval {editing + 1}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["start_ms", "end_ms"] as const).map(key => <InputWithLabel key={key} id={`${id}-${key}`} type="number" label={key === "start_ms" ? "Start (s)" : "End (s)"}
            min={0} max={record.duration_ms / 1000} step="any" value={Number.isFinite(items[editing][key]) ? items[editing][key] / 1000 : ""} error={errorAt?.[key]?.message}
            onChange={event => form.setValue(`intervals.${editing}.${key}`, event.target.value === "" ? NaN : Number(event.target.value) * 1000, { shouldValidate: true, shouldDirty: true })} />)}
          <SelectWithLabel id={`${id}-movement`} label="Movement" value={items[editing].movement} error={errorAt?.movement?.message}
            options={movements.map(value => ({ value, label: label(value) }))} onValueChange={value => {
              const movement = movements.find(v => v === value); if (!movement) return;
              form.setValue(`intervals.${editing}.movement`, movement, { shouldDirty: true });
              form.setValue(`intervals.${editing}.direction`, movement === "stationary" ? "not_applicable" : "unknown", { shouldDirty: true });
              form.setValue(`intervals.${editing}.severity`, movement === "stationary" ? "not_applicable" : "unknown", { shouldDirty: true });
              form.setValue(`intervals.${editing}.certainty`, "uncertain", { shouldDirty: true });
            }} />
          <SelectWithLabel id={`${id}-direction`} label="Direction" value={items[editing].direction} error={errorAt?.direction?.message}
            options={directions.map(value => ({ value, label: label(value) }))} onValueChange={value => { const v = directions.find(v => v === value); if (v) form.setValue(`intervals.${editing}.direction`, v, { shouldValidate: true, shouldDirty: true }); }} />
          <SelectWithLabel id={`${id}-severity`} label="Assessment" value={items[editing].severity} error={errorAt?.severity?.message}
            options={severities.map(value => ({ value, label: label(value) }))} onValueChange={value => { const v = severities.find(v => v === value); if (v) form.setValue(`intervals.${editing}.severity`, v, { shouldValidate: true, shouldDirty: true }); }} />
          <SelectWithLabel id={`${id}-source`} label="Label source" value={items[editing].source} error={errorAt?.source?.message}
            options={annotationSources.map(value => ({ value, label: label(value) }))} onValueChange={value => { const v = annotationSources.find(v => v === value); if (v) form.setValue(`intervals.${editing}.source`, v, { shouldValidate: true, shouldDirty: true }); }} />
          <SelectWithLabel id={`${id}-certainty`} label="Certainty" value={items[editing].certainty} error={errorAt?.certainty?.message}
            options={certainties.map(value => ({ value, label: label(value) }))} onValueChange={value => { const v = certainties.find(v => v === value); if (v) form.setValue(`intervals.${editing}.certainty`, v, { shouldValidate: true, shouldDirty: true }); }} />
        </div>
        <TextAreaWithLabel id={`${id}-notes`} label="Notes" rows={2} maxLength={1000} {...form.register(`intervals.${editing}.notes`)} error={errorAt?.notes?.message} />
      </div>}
      <FormFieldError message={form.formState.errors.intervals?.root?.message ?? form.formState.errors.intervals?.message} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || conflict || !form.formState.isDirty}>{busy ? "Saving labels..." : "Save labels"}</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => { form.reset({ base_revision: saved?.revision ?? 0, intervals: saved?.intervals ?? [] }); setEditing(null); setPage(1); }}>Discard draft</Button>
      </div>
    </fieldset>
    {form.formState.errors.root && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>}
    {conflict && <Button type="button" variant="outline" onClick={onReload}>Reload latest labels (discard draft)</Button>}
  </form>;
}

function LabelSelection({ window, origin, bounds, recordingId, onAdd, disabled }: {
  window: NativeWindow; origin: string; bounds: ReferenceRange; recordingId: string; onAdd: (range: ReferenceRange) => void; disabled: boolean;
}) {
  const [selection, setSelection] = useState<ReferenceRange>(bounds);
  const [cursor, setCursor] = useState(bounds[0]);
  const points = useMemo(() => nativeSignalPoints(window.events, origin), [window.events, origin]);
  return <div className="space-y-3">
    <SignalTimeline title="Original acceleration" points={points} unit="m/s²" domain={bounds} selection={selection} cursor={cursor} onCursor={setCursor}
      onSelection={setSelection} syncId={`${recordingId}-labels`} initialAxes={["x", "y"]} includeZero={false} />
    <SignalSelectionControls bounds={bounds} selection={selection} onSelection={setSelection} />
    <Button type="button" variant="outline" disabled={disabled || selection[1] <= selection[0]} onClick={() => onAdd([...selection])}>Label selected interval</Button>
  </div>;
}
