import type { ComponentProps } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function TableCard({ className, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn("min-w-0 overflow-hidden rounded-2xl border-0 bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.05)]", className)}
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
