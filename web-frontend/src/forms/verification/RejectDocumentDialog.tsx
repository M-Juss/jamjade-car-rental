"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ShieldAlert } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { appToast } from "@/lib/toast";
import { ApiError } from "@/services/http";
import { rejectVerification, type VerificationRecord } from "@/services/verification";
import { rejectDocumentSchema, type RejectDocumentFormValues } from "@/validations/verification/schemas";

export function RejectDocumentDialog({ record, onClose, onSaved }: {
  record: VerificationRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm<RejectDocumentFormValues>({
    resolver: zodResolver(rejectDocumentSchema),
    defaultValues: { rejectionReason: "" },
  });

  useEffect(() => {
    form.reset({ rejectionReason: "" });
  }, [form, record]);

  const save = async ({ rejectionReason }: RejectDocumentFormValues) => {
    if (!record) return;
    try {
      await rejectVerification(record, rejectionReason);
      appToast.success("Document rejected successfully.");
      onClose();
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.errors?.rejection_reason?.[0]) {
        form.setError("rejectionReason", { message: error.errors.rejection_reason[0] });
      }
      appToast.error("The document could not be rejected. Please try again.");
    }
  };

  return (
    <Dialog open={Boolean(record)} onOpenChange={(open) => { if (!open && !form.formState.isSubmitting) onClose(); }}>
      <FormDialogContent width="compact">
        <FormDialogHeader title="Reject Document" icon={ShieldAlert} onClose={onClose} closeLabel="Close rejection form" iconClassName="bg-destructive-surface text-destructive" />
        <form onSubmit={form.handleSubmit(save)} noValidate>
          <div className="px-4 py-5 sm:px-6">
            <TextAreaWithLabel
              id="rejection-reason"
              label="Rejection notes"
              required
              maxLength={1000}
              placeholder="Explain what the customer needs to correct. This message is shown to the customer."
              error={form.formState.errors.rejectionReason?.message}
              {...form.register("rejectionReason")}
            />
          </div>
          <FormDialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={form.formState.isSubmitting}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Rejecting..." : "Reject Document"}
            </Button>
          </FormDialogFooter>
        </form>
      </FormDialogContent>
    </Dialog>
  );
}
