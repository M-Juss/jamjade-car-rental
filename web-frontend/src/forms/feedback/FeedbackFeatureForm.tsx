"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Star } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormFieldError } from "@/components/common/forms/FormFieldError";
import { appToast } from "@/lib/toast";
import { featureFeedback, type CustomerFeedback } from "@/services/feedback/feedback.service";
import { ApiError } from "@/services/http";
import { featureFeedbackSchema, type FeatureFeedbackInput } from "@/validations/feedback/schemas";

export function FeedbackFeatureForm({ review, onSaved }: { review: CustomerFeedback; onSaved: (review: CustomerFeedback) => void }) {
  const { handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FeatureFeedbackInput>({
    resolver: zodResolver(featureFeedbackSchema), defaultValues: { is_featured: !review.isFeatured },
  });
  const submit = async (values: FeatureFeedbackInput) => {
    try {
      onSaved(await featureFeedback(review.id, values));
      appToast.success(review.isFeatured ? "Review unstarred." : "Review starred.");
    } catch (error) {
      const message = error instanceof ApiError ? error.errors?.is_featured?.[0] ?? error.message : "Feedback could not be updated.";
      setError("is_featured", { type: "server", message });
      appToast.error(message);
    }
  };
  return <form onSubmit={handleSubmit(submit)} className="space-y-2">
    <Button type="submit" variant="outline" size="sm" disabled={isSubmitting || (!review.isFeatured && !review.comment?.trim())}
      aria-label={`${review.isFeatured ? "Unstar" : "Star"} review for ${review.bookingCode}`} aria-pressed={review.isFeatured}>
      <Star aria-hidden="true" className={review.isFeatured ? "fill-current text-warning" : ""} />
      {isSubmitting ? "Saving…" : review.isFeatured ? "Starred" : "Star"}
    </Button>
    <FormFieldError message={errors.is_featured?.message} />
  </form>;
}
