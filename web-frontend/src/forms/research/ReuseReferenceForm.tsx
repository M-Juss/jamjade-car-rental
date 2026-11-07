"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { FormFieldError } from "@/components/common/forms/FormFieldError";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { appToast } from "@/lib/toast";
import { ApiError } from "@/services/http";
import { getReferenceRuns, saveProcessingRun } from "@/services/research/processing-runs.service";
import type { ProcessingDetail } from "@/services/research/processing-types";
import { reuseProcessingRunSchema, type ReuseProcessingRunValues } from "@/validations/research/processing-run";
import { formatReturnDateTime } from "@/services/booking/return-time";

export function ReuseReferenceForm({ recordingId, bounds, onSaved }: {
  recordingId: string; bounds: [number, number]; onSaved: (detail: ProcessingDetail) => void;
}) {
  const id = useId();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [listing, setListing] = useState<Awaited<ReturnType<typeof getReferenceRuns>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const form = useForm<ReuseProcessingRunValues>({ resolver: zodResolver(reuseProcessingRunSchema), defaultValues: {
    start_ms: bounds[0], end_ms: bounds[1], cutoff_hz: 5, confirmed: true, reference_run_id: "", same_mount_confirmed: false,
  } });
  const [referenceId, cutoff, sameMount] = useWatch({ control: form.control, name: ["reference_run_id", "cutoff_hz", "same_mount_confirmed"] });
  const { setValue, clearErrors } = form;
  useEffect(() => {
    const controller = new AbortController();
    getReferenceRuns(recordingId, page, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setListing(data); setError(null);
      setValue("reference_run_id", data.references.find(option => option.compatible)?.id ?? "");
      setValue("same_mount_confirmed", false); clearErrors();
    }).catch(cause => { if (!controller.signal.aborted) setError(cause); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [recordingId, page, revision, setValue, clearErrors]);
  const selected = listing?.references.find(option => option.id === referenceId);
  const submit = async (values: ReuseProcessingRunValues) => {
    form.clearErrors();
    try {
      const result = await saveProcessingRun(recordingId, values);
      onSaved(result); appToast.success("Trial processed and saved.");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 422) {
        for (const [field, messages] of Object.entries(cause.errors ?? {})) {
          if (field === "reference_run_id" || field === "same_mount_confirmed" || field === "cutoff_hz") form.setError(field, { message: messages[0] });
          else form.setError("root", { message: "Review the recording window, data quality and selected reference." });
        }
        if (!Object.keys(cause.errors ?? {}).length) form.setError("root", { message: "Review the trial and reference setup." });
        appToast.error("Trial was not processed. Check the highlighted details.");
      } else {
        const message = cause instanceof ApiError && cause.status === 403 ? "Research access is unavailable."
          : cause instanceof ApiError && (cause.status === 404 || cause.status === 409) ? "The selected reference is unavailable or has changed. Refresh the reference choices."
          : "Trial could not be processed. Try again.";
        form.setError("root", { message }); appToast.error(message);
      }
    }
  };
  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading reference choices...</p>;
  if (error) return <div role="alert" className="space-y-3">
    <p className="text-sm text-destructive">{error instanceof ApiError && error.status === 403 ? "Research access is unavailable." : "Reference choices could not be loaded."}</p>
    <Button variant="outline" onClick={() => { setLoading(true); setRevision(v => v + 1); }}>Try again</Button>
  </div>;
  const canChoose = listing?.references.some(option => option.compatible);
  return <form className="space-y-4" onSubmit={form.handleSubmit(submit, () => appToast.error("Choose a reference and confirm the phone and mount."))}>
    <h3 className="text-sm font-semibold">Use a forward reference</h3>
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
      <SelectWithLabel id={`${id}-reference`} label="Reference recording" placeholder="Select a compatible reference" value={referenceId}
        onValueChange={value => { form.setValue("reference_run_id", value, { shouldValidate: true }); form.setValue("same_mount_confirmed", false); }}
        disabled={form.formState.isSubmitting || !canChoose} error={form.formState.errors.reference_run_id?.message}
        options={listing?.references.map(option => ({ value: option.id, disabled: !option.compatible,
          label: option.recording_name, description: `${option.cutoff_hz} Hz${option.unavailable_reason ? `. ${option.unavailable_reason}` : ""}` })) ?? []} />
      <SelectWithLabel id={`${id}-cutoff`} label="Experimental cutoff" value={String(cutoff)}
        onValueChange={value => form.setValue("cutoff_hz", Number(value), { shouldValidate: true })} disabled={form.formState.isSubmitting}
        error={form.formState.errors.cutoff_hz?.message} options={[3, 5, 8].map(value => ({ value: String(value), label: `${value} Hz` }))} />
    </div>
    {!canChoose && <p className="text-xs text-muted-foreground">No compatible reference on this page. A reference needs the same group/setup and at least five seconds of resting data.</p>}
    {selected && <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/admin/research/native/${selected.recording_id}`} target="_blank" rel="noopener noreferrer">Review reference recording</Link>
      <span className="text-muted-foreground">{formatReturnDateTime(selected.created_at)}</span>
    </div>}
    {listing && listing.lastPage > 1 && <TablePagination page={listing.page} lastPage={listing.lastPage} total={listing.total} disabled={form.formState.isSubmitting}
      onPageChange={value => { setLoading(true); setPage(value); }} label="Reference choices pagination" />}
    <div>
      <label htmlFor={`${id}-mount`} className="flex min-h-11 cursor-pointer items-center gap-3 text-xs font-medium has-disabled:opacity-60">
        <Checkbox id={`${id}-mount`} checked={sameMount} disabled={!selected?.compatible || form.formState.isSubmitting}
          aria-invalid={Boolean(form.formState.errors.same_mount_confirmed)}
          onCheckedChange={value => form.setValue("same_mount_confirmed", value === true, { shouldValidate: true })} />
        <span>I reviewed the reference. The same phone, RC and mount were used, without moving or remounting the phone.</span>
      </label>
      <FormFieldError message={form.formState.errors.same_mount_confirmed?.message} />
    </div>
    <Button type="submit" disabled={!canChoose || form.formState.isSubmitting}>{form.formState.isSubmitting ? "Processing..." : "Process & save run"}</Button>
    {form.formState.errors.root && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>}
  </form>;
}
