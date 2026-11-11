"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ManagementTable, ManagementTableCell } from "@/components/common/tables/ManagementTable";
import { TablePagination } from "@/components/common/tables/TablePagination";
import type { MonitoringSessionDetail } from "@/services/research/drive-monitoring.service";
import { humanize, seconds } from "../recording-analysis";

export function MonitoringPredictions({ batches }: { batches: MonitoringSessionDetail["recent_predictions"] }) {
  const [page, setPage] = useState(1);
  const windows = batches.flatMap(batch => batch.predictions.slice().reverse().map(prediction => ({ ...prediction, key: `${batch.batch_id}-${prediction.id}` })));
  const lastPage = Math.max(1, Math.ceil(windows.length / 10));
  const currentPage = Math.min(page, lastPage);
  return <Card><details>
    <summary className="cursor-pointer px-4 font-medium focus-visible:outline-primary">Recent predictions</summary>
    <CardContent className="mt-4 space-y-3">
      <p className="text-xs text-muted-foreground">Latest {batches.length} received batches</p>
      {!windows.length ? <p className="text-sm text-muted-foreground">No predictions received.</p> : <ManagementTable>
        <TableHeader><TableRow>{["Interval", "Prediction", "Vote"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{windows.slice((currentPage - 1) * 10, currentPage * 10).map(prediction => {
          const interval = /^w-(\d+)-(\d+)$/.exec(prediction.id);
          return <TableRow key={prediction.key}>
            <ManagementTableCell data-label="Interval" className="tabular-nums">{interval ? `${seconds(Number(interval[1]))}–${seconds(Number(interval[2]))}` : "—"}</ManagementTableCell>
            <ManagementTableCell data-label="Prediction">{humanize(prediction.class)}</ManagementTableCell>
            <ManagementTableCell data-label="Vote" className="tabular-nums">{Math.round(prediction.vote * 100)}%</ManagementTableCell>
          </TableRow>;
        })}</TableBody>
      </ManagementTable>}
      {lastPage > 1 && <TablePagination page={currentPage} lastPage={lastPage} total={windows.length} onPageChange={setPage} label="Recent predictions pagination" />}
    </CardContent>
  </details></Card>;
}
