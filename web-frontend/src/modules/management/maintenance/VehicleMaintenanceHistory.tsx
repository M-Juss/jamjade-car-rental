"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getVehicleMaintenanceHistory, type MaintenanceRecord } from "@/services/maintenance";
import { MaintenanceDetailsDialog } from "./components/MaintenanceDetailsDialog";
import { MaintenanceHistoryTable } from "./components/MaintenanceTables";

export function VehicleMaintenanceHistory({ vehicleId }: { vehicleId: string }) {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [detailsRecord, setDetailsRecord] = useState<MaintenanceRecord | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const history = await getVehicleMaintenanceHistory(vehicleId);
        if (!cancelled) setRecords(history);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadHistory();
    return () => { cancelled = true; };
  }, [vehicleId, retry]);

  return (
    <section className="space-y-4" aria-labelledby="vehicle-maintenance-history-heading">
      <h2 id="vehicle-maintenance-history-heading" className="text-lg font-bold text-foreground">Maintenance History</h2>
      {loading ? (
        <div role="status" className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />Loading maintenance history
        </div>
      ) : error ? (
        <Card className="rounded-2xl border border-destructive-border bg-destructive-surface shadow-none">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle size={16} />Maintenance history could not be loaded. Please try again.
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => { setError(false); setLoading(true); setRetry((value) => value + 1); }}>Try Again</Button>
          </CardContent>
        </Card>
      ) : (
        <MaintenanceHistoryTable
          paginationKey={vehicleId}
          records={records}
          onView={setDetailsRecord}
          emptyMessage="No maintenance history for this vehicle."
        />
      )}
      <MaintenanceDetailsDialog record={detailsRecord} onOpenChange={() => setDetailsRecord(null)} />
    </section>
  );
}
