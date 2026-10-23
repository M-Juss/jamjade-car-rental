"use client";

import { useState } from "react";
import { TABLE_PAGE_SIZE } from "@/lib/table-pagination";

export function useTablePagination<T>(items: T[], resetKey: string, pageSize = TABLE_PAGE_SIZE) {
  const [selection, setSelection] = useState({ key: resetKey, page: 1 });
  if (selection.key !== resetKey) {
    setSelection({ key: resetKey, page: 1 });
  }
  const lastPage = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(selection.key === resetKey ? selection.page : 1, lastPage);

  return {
    rows: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    lastPage,
    onPageChange: (nextPage: number) => setSelection({ key: resetKey, page: Math.max(1, Math.min(nextPage, lastPage)) }),
  };
}
