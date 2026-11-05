"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type TablePaginationProps = {
  total: number;
  page: number;
  lastPage: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  label?: string;
};

export function TablePagination({ total, page, lastPage, onPageChange, disabled = false, label = "Table pagination" }: TablePaginationProps) {
  if (total <= 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <span role="status" aria-live="polite">{total} result{total === 1 ? "" : "s"}</span>
      <nav aria-label={label} className="flex items-center gap-2">
        <span>Page {Math.max(1, page)} of {Math.max(1, lastPage)}</span>
        <Button type="button" variant="outline" size="icon" aria-label="Previous page" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={15} />
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Next page" disabled={disabled || page >= lastPage || total === 0} onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={15} />
        </Button>
      </nav>
    </div>
  );
}
