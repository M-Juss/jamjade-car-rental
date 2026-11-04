"use client";

import { useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/services/http";
import { appToast } from "@/lib/toast";
import { saveProcessingRun } from "@/services/research/processing-runs.service";
import type { ProcessingDetail } from "@/services/research/processing-types";
import { processingRunSchema, type ProcessingRunValues } from "@/validations/research/processing-run";

export function ProcessingRunForm({ recordingId, defaults, onSaved }: {
  recordingId: string; defaults: ProcessingRunValues; onSaved: (detail: ProcessingDetail) => void;
}) {
  const id = useId();
  const form = useForm<ProcessingRunValues>({ resolver: zodResolver(processingRunSchema), defaultValues: defaults });
  const cutoff = useWatch({ control: form.control, name: "cutoff_hz" });
  const submit = async (values: ProcessingRunValues) => {
    form.clearErrors();
    try {
      const detail = await saveProcessingRun(recordingId, values);
      onSaved(detail);
      appToast.success("Processing run saved.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        for (const [key, messages] of Object.entries(error.errors ?? {})) {
          if (key === "cutoff_hz") form.setError(key, { message: messages[0] });
          else if (key === "start_ms" || key === "end_ms" || key === "confirmed" || key === "ranges" || key.startsWith("ranges.")) {
            // Intervals and confirmation are owned by the reference selector; show their rejection here.
            form.setError("root", { message: "Review the reference intervals and confirm the setup again." });
          } else form.setError("root", { message: "The recording could not be processed. Review its timing and reference intervals." });
        }
        if (!Object.keys(error.errors ?? {}).length) form.setError("root", { message: "Review the recording window and reference intervals." });
        appToast.error("Processing run was not saved. Review the highlighted details.");
      } else {
        const message = error instanceof ApiError && error.status === 403 ? "Research access is unavailable."
          : error instanceof ApiError && error.status === 409 ? "Processing is unavailable. Check upload completion and the run limit."
          : "Processing run could not be saved. Try again.";
        form.setError("root", { message }); appToast.error(message);
      }
    }
  };
  const invalid = () => {
    if (!form.formState.errors.cutoff_hz) form.setError("root", { message: "Review the window and reference intervals." });
    appToast.error("Check the processing settings and reference intervals.");
  };
  return <form className="space-y-3" onSubmit={form.handleSubmit(submit, invalid)}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <SelectWithLabel id={`${id}-cutoff`} label="Experimental cutoff" wrapperClassName="sm:w-56" value={String(cutoff)}
        onValueChange={value => form.setValue("cutoff_hz", Number(value), { shouldValidate: true })} disabled={form.formState.isSubmitting}
        options={[3, 5, 8].map(value => ({ value: String(value), label: `${value} Hz` }))} error={form.formState.errors.cutoff_hz?.message} />
      <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Processing..." : "Process & save run"}</Button>
    </div>
    {form.formState.errors.root && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>}
  </form>;
}
