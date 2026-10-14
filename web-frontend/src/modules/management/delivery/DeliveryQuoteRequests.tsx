"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getDeliveryRequests,
  type DeliveryQuote,
} from "@/services/delivery/delivery.service";
import { DeliveryQuoteReviewForm } from "@/forms/delivery/DeliveryQuoteReviewForm";
export function DeliveryQuoteRequests() {
  const [rows, setRows] = useState<DeliveryQuote[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<DeliveryQuote | null>(null);
  useEffect(() => {
    let active = true;
    getDeliveryRequests(page)
      .then((response) => {
        if (active) {
          setRows(response.data);
          setLastPage(Number(response.meta?.last_page ?? 1));
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, reload]);
  const refresh = () => {
    setLoading(true);
    setReload((v) => v + 1);
  };
  return (
    <Card className="rounded-2xl border-border bg-surface">
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-foreground">
            Delivery Toll Requests
          </h2>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Quotes awaiting toll approval. These requests do not reserve a vehicle
          or accept payment.
        </p>
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading requests...
          </p>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">
            Delivery requests could not be loaded. Use Refresh to retry.
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No delivery quotes are awaiting review.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer / Vehicle</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell>
                      {quote.customerName} · {quote.vehicleName}
                    </TableCell>
                    <TableCell>{quote.destinationAddress}</TableCell>
                    <TableCell>
                      {/* Preserve the booking's entered wall time, as the booking table does. */}
                      {new Date(quote.rentalStartAt).toLocaleString(undefined, {
                        timeZone: "UTC",
                      })}
                    </TableCell>
                    <TableCell>
                      {quote.routeLabel} ·{" "}
                      {quote.tollStatus === "unknown"
                        ? "Toll status uncertain"
                        : "Toll route"}
                    </TableCell>
                    <TableCell>PHP {quote.deliveryFee}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelected(quote)}
                      >
                        Review Toll
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {lastPage > 1 && (
          <div className="mt-3 flex items-center gap-3">
            <Button
              variant="outline"
              disabled={loading || page === 1}
              onClick={() => {
                setLoading(true);
                setPage((v) => v - 1);
              }}
            >
              Previous
            </Button>
            <span className="text-sm">
              {page} / {lastPage}
            </span>
            <Button
              variant="outline"
              disabled={loading || page >= lastPage}
              onClick={() => {
                setLoading(true);
                setPage((v) => v + 1);
              }}
            >
              Next
            </Button>
          </div>
        )}
        {selected && (
          <DeliveryQuoteReviewForm
            quote={selected}
            onClose={() => setSelected(null)}
            onSaved={refresh}
          />
        )}
      </CardContent>
    </Card>
  );
}
