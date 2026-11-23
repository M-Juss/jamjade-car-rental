"use client";

import { Eye } from "lucide-react";
import { ManagementTable, ManagementTableCell, TableCard } from "@/components/common/tables/ManagementTable";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { Button } from "@/components/ui/button";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DrivingOperator } from "@/services/booking";
import type { ReportData } from "@/services/report";

export function OperatorsNeedingAttention({ data, onPageChange, onView }: {
  data: NonNullable<ReportData["operatorAttention"]>;
  onPageChange: (page: number) => void;
  onView: (operator: DrivingOperator, trigger: HTMLButtonElement) => void;
}) {
  return <section className="space-y-3" aria-labelledby="operators-attention-heading">
    <div>
      <h2 id="operators-attention-heading" className="text-base font-semibold text-foreground">Operators needing attention</h2>
      <p className="mt-1 text-sm text-muted-foreground">Average final grade below {data.threshold} / 100.</p>
    </div>
    <TableCard>
      <ManagementTable aria-label="Operators needing attention">
        <TableHeader><TableRow><TableHead>Operator</TableHead><TableHead>Operator type</TableHead><TableHead>Average grade</TableHead><TableHead>Graded rentals</TableHead><TableHead>Latest grade</TableHead><TableHead>Harsh events</TableHead><TableHead className="w-16 px-4"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
        <TableBody>{data.operators.length ? data.operators.map(operator => <TableRow key={`${operator.id}:${operator.operator_type}`}>
          <ManagementTableCell data-label="Operator" className="font-medium">{operator.name ?? "Not recorded"}</ManagementTableCell>
          <ManagementTableCell data-label="Operator type">{operator.operator_type === "driver" ? "Driver" : "Customer"}</ManagementTableCell>
          <ManagementTableCell data-label="Average grade" className="tabular-nums"><p className="font-medium text-warning">{operator.average_score?.toFixed(1)} / 100</p>{operator.incomplete_grades > 0 ? <p className="mt-1 text-xs text-muted-foreground">{operator.incomplete_grades} with incomplete sync</p> : null}</ManagementTableCell>
          <ManagementTableCell data-label="Graded rentals" className="tabular-nums">{operator.monitored_rentals}</ManagementTableCell>
          <ManagementTableCell data-label="Latest grade" className="tabular-nums">{operator.latest_score === null ? "Not graded" : `${operator.latest_score} / 100`}{operator.latest_sync_incomplete ? <p className="mt-1 text-xs text-muted-foreground">Incomplete sync</p> : null}</ManagementTableCell>
          <ManagementTableCell data-label="Harsh events" className="tabular-nums">{operator.harsh_events}</ManagementTableCell>
          <ManagementTableCell data-label="Actions" className="px-4 py-3 md:w-16"><Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`View rentals for ${operator.name ?? "operator"}`} onClick={event => onView(operator, event.currentTarget)}><Eye aria-hidden="true" /></Button></ManagementTableCell>
        </TableRow>) : <TableRow><ManagementTableCell colSpan={7} className="py-10 text-center text-muted-foreground">No graded operators below {data.threshold} / 100 in this period.</ManagementTableCell></TableRow>}</TableBody>
      </ManagementTable>
    </TableCard>
    <TablePagination page={data.page} lastPage={data.lastPage} total={data.total} onPageChange={onPageChange} label="Operators needing attention pagination" />
  </section>;
}
