import { apiGet, apiPut } from "@/services/http";
import { TABLE_PAGE_SIZE } from "@/lib/table-pagination";
import { featureFeedbackSchema, type FeatureFeedbackInput } from "@/validations/feedback/schemas";

export type CustomerFeedback = {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  bookingCode: string;
  vehicleName: string | null;
  isFeatured: boolean;
};

export type PublicFeedback = { id: number; name: string; rating: number; comment: string };

export async function getCustomerFeedback(customerId: number, page: number) {
  const response = await apiGet<CustomerFeedback[]>(`/admin/reports/customers/${customerId}/feedback?page=${page}&per_page=${TABLE_PAGE_SIZE}`);
  return {
    reviews: response.data,
    total: Number(response.meta?.total ?? 0),
    lastPage: Number(response.meta?.last_page ?? 1),
    average: response.meta?.average_rating == null ? null : Number(response.meta.average_rating),
  };
}

export async function featureFeedback(id: number, input: FeatureFeedbackInput) {
  return (await apiPut<CustomerFeedback>(`/admin/feedback/${id}/featured`, featureFeedbackSchema.parse(input))).data;
}

export async function getPublicFeedback(page = 1) {
  const response = await apiGet<PublicFeedback[]>(`/api/testimonials?page=${page}&per_page=20`);
  return { reviews: response.data, lastPage: Number(response.meta?.last_page ?? 1) };
}
