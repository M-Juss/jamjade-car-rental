"use client";
import { DeliveryRoutePreview } from "@/modules/management/delivery/DeliveryRoutePreview";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FormDialogContent,
  FormDialogHeader,
  FormDialogFooter,
} from "@/components/common/forms/FormDialogLayout";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import {
  deliveryReviewSchema,
  type DeliveryReviewValues,
} from "@/validations/delivery/schemas";
import {
  reviewDeliveryQuote,
  type DeliveryQuote,
} from "@/services/delivery/delivery.service";
import { ApiError } from "@/services/http";
import { appToast } from "@/lib/toast";
export function DeliveryQuoteReviewForm({
  quote,
  onClose,
  onSaved,
}: {
  quote: DeliveryQuote;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm<DeliveryReviewValues>({
    resolver: zodResolver(deliveryReviewSchema),
    defaultValues: {
      decision: "approve",
      delivery_toll_fee: "",
      review_note: "",
    },
  });
  const submit = async (values: DeliveryReviewValues) => {
    try {
      await reviewDeliveryQuote(quote.id, values);
      appToast.success(
        values.decision === "approve"
          ? "Delivery toll approved. The customer has 15 minutes to accept the quote."
          : "Delivery request rejected.",
      );
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError)
        for (const [key, messages] of Object.entries(e.errors ?? {}))
          form.setError(
            key === "decision" ||
              key === "delivery_toll_fee" ||
              key === "review_note"
              ? key
              : "root",
            { message: messages[0] },
          );
      appToast.error(
        "Delivery quote could not be reviewed. Check the details and try again.",
      );
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !form.formState.isSubmitting) onClose();
      }}
    >
      <FormDialogContent width="compact">
        <FormDialogHeader
          icon={MapPin}
          title="Review Delivery Toll"
          onClose={() => {
            if (!form.formState.isSubmitting) onClose();
          }}
          closeLabel="Close delivery review"
        />
        <form
          className="flex min-h-0 flex-col"
          onSubmit={form.handleSubmit(submit, () =>
            appToast.error("Check the highlighted toll review fields."),
          )}
        >
          <div className="space-y-4 overflow-y-auto p-4 sm:p-6">
            <p className="text-sm text-foreground">
              {quote.destinationAddress} · {quote.routeLabel} · delivery PHP{" "}
              {quote.deliveryFee}
            </p>
            <p className="text-sm text-muted-foreground">
              Verify the selected delivery route and toll amount manually.
              Driver detours do not change this accepted charge.
            </p>
            <DeliveryRoutePreview quoteId={quote.id} />
            <label className="grid gap-2 text-sm" htmlFor="decision">
              Decision
              <select
                id="decision"
                className="h-9 rounded-xl border border-border bg-background px-3"
                disabled={form.formState.isSubmitting}
                {...form.register("decision")}
              >
                <option value="approve">Approve verified toll amount</option>
                <option value="reject">Reject delivery request</option>
              </select>
            </label>
            <InputWithLabel
              id="delivery_toll_fee"
              label="Verified toll amount (PHP)"
              type="number"
              step="any"
              disabled={form.formState.isSubmitting}
              error={form.formState.errors.delivery_toll_fee?.message}
              {...form.register("delivery_toll_fee")}
            />
            <TextAreaWithLabel
              id="review_note"
              label="Review note (required for rejection)"
              disabled={form.formState.isSubmitting}
              error={form.formState.errors.review_note?.message}
              {...form.register("review_note")}
            />
            {form.formState.errors.root && (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}
          </div>
          <FormDialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={form.formState.isSubmitting}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Reviewing..." : "Submit Review"}
            </Button>
          </FormDialogFooter>
        </form>
      </FormDialogContent>
    </Dialog>
  );
}
