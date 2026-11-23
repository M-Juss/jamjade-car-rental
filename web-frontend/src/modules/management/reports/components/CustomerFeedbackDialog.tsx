"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { FormDialogContent, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { ManagementTable, ManagementTableCell, TableCard } from "@/components/common/tables/ManagementTable";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FeedbackFeatureForm } from "@/forms/feedback/FeedbackFeatureForm";
import { getCustomerFeedback } from "@/services/feedback/feedback.service";

const dateTime = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

export function CustomerFeedbackDialog({ customer, canCurate, onClose, onReturnFocus }: {
  customer: { id: number; name: string }; canCurate: boolean; onClose: () => void; onReturnFocus: () => void;
}) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Awaited<ReturnType<typeof getCustomerFeedback>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    void getCustomerFeedback(customer.id, page).then(value => { if (current) setResult(value); })
      .catch(() => { if (current) setError(true); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [customer.id, page, reload]);

  const columnCount = canCurate ? 5 : 4;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <FormDialogContent width="wide" onCloseAutoFocus={event => { event.preventDefault(); onReturnFocus(); }}>
      <FormDialogHeader title={`${customer.name} — Lifetime ratings`} icon={Star} onClose={onClose} closeLabel="Close customer feedback" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
        {!loading && !error && result?.average != null ? <p className="mb-4 font-semibold tabular-nums">{result.average.toFixed(1)} / 5 <span className="font-normal text-muted-foreground">({result.total} {result.total === 1 ? "review" : "reviews"})</span></p> : null}
        <TableCard>
          <ManagementTable aria-label="Customer lifetime feedback">
            <TableHeader><TableRow><TableHead>Booking</TableHead><TableHead>Rating</TableHead><TableHead>Feedback</TableHead><TableHead>Submitted</TableHead>{canCurate ? <TableHead>Landing page</TableHead> : null}</TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><ManagementTableCell colSpan={columnCount} className="py-10 text-center text-muted-foreground">Loading feedback…</ManagementTableCell></TableRow>
                : error ? <TableRow><ManagementTableCell colSpan={columnCount} className="py-8 text-center"><p role="alert" className="text-destructive">Feedback could not be loaded.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => { setLoading(true); setError(false); setReload(value => value + 1); }}>Retry</Button></ManagementTableCell></TableRow>
                  : result?.reviews.length ? result.reviews.map(review => <TableRow key={review.id}>
                    <ManagementTableCell data-label="Booking"><p className="font-semibold">{review.bookingCode}</p><p className="text-xs text-muted-foreground">{review.vehicleName}</p></ManagementTableCell>
                    <ManagementTableCell data-label="Rating" className="tabular-nums">{review.rating} / 5</ManagementTableCell>
                    <ManagementTableCell data-label="Feedback" className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{review.comment ?? "—"}</ManagementTableCell>
                    <ManagementTableCell data-label="Submitted">{dateTime.format(new Date(review.createdAt))}</ManagementTableCell>
                    {canCurate ? <ManagementTableCell data-label="Landing page"><FeedbackFeatureForm key={`${review.id}-${review.isFeatured}`} review={review} onSaved={updated => setResult(current => current ? { ...current, reviews: current.reviews.map(item => item.id === updated.id ? updated : item) } : current)} /></ManagementTableCell> : null}
                  </TableRow>) : <TableRow><ManagementTableCell colSpan={columnCount} className="py-10 text-center text-muted-foreground">No feedback yet.</ManagementTableCell></TableRow>}
            </TableBody>
          </ManagementTable>
          {!loading && !error && result && result.total > 0 ? <div className="border-t border-border px-4 py-3 [&>div]:mt-0"><TablePagination page={page} lastPage={result.lastPage} total={result.total} onPageChange={value => { setLoading(true); setError(false); setPage(value); }} label="Customer feedback" /></div> : null}
        </TableCard>
      </div>
    </FormDialogContent>
  </Dialog>;
}
