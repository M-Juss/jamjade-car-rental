import type { ComponentProps } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function TableCard({ className, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn("min-w-0 gap-0 overflow-hidden rounded-2xl border border-border bg-surface py-0 shadow-none", className)}
      {...props}
    />
  );
}

// Labeled cells become stacked rows on phones; desktop columns keep their assigned widths.
export function ManagementTable({ className, ...props }: ComponentProps<typeof Table>) {
  return <Table role="table" className={cn("management-table", className)} {...props} />;
}

export function ManagementTableCell({
  children,
  ...props
}: ComponentProps<typeof TableCell> & { "data-label"?: string }) {
  return (
    <TableCell {...props}>
      {props["data-label"] ? <div className="min-w-0">{children}</div> : children}
    </TableCell>
  );
}
