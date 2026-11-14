"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { ManagementTable, ManagementTableCell, TableCard } from "@/components/common/tables/ManagementTable";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";
import { ApiError } from "@/services/http";
import { getAuditLog, type AuditEntry, type AuditFilters } from "@/services/errors/error.service";

const dateFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
const modules = ["bookings", "payments", "vehicles", "maintenance", "personnel", "documents", "settings"];
const actions = ["created", "updated", "deleted", "approved", "rejected"];
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function ErrorsModule() {
  const [filters, setFilters] = useState<AuditFilters>({ search: "", module: "all", action: "all", status: "all" });
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const filter = (key: keyof AuditFilters, value: string) => { setPage(1); setFilters(current => ({ ...current, [key]: value })); };

  useEffect(() => {
    const timer = setTimeout(() => { setLoading(true); setError(""); setPage(1); setFilters(current => ({ ...current, search: searchInput })); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    let active = true;
    getAuditLog(filters, page).then((result) => {
      if (!active) return;
      if (page > result.lastPage && result.lastPage > 0) { setPage(result.lastPage); return; }
      setItems(result.entries); setTotal(result.total); setLastPage(result.lastPage);
    }).catch((failure: unknown) => {
      if (!active) return;
      if (failure instanceof ApiError && failure.status === 403) setError("You do not have access to the Activity Log.");
      else if (failure instanceof ApiError && [401, 419].includes(failure.status)) setError("Your login session expired. Please log in again.");
      else setError("Unable to load the activity log. Please try again.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, page, revision]);

  const changeFilter = (key: keyof AuditFilters, value: string) => { setLoading(true); setError(""); filter(key, value); };
  return (
    <div className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
      <ManagementPageHeading title="Activity Log" description="Review business actions and their results." />
      <TableCard className="gap-0 py-0 shadow-none" aria-label="Activity log">
        <CardContent className="border-b border-border p-4">
          <div className="flex flex-wrap gap-2.5">
            <SearchInput value={searchInput} onValueChange={setSearchInput} placeholder="Search person or action" wrapperClassName="min-w-0 basis-full lg:basis-auto lg:flex-1" />
            <FilterSelect value={filters.module} onValueChange={value => changeFilter("module", value)} ariaLabel="Filter by module" className="w-full sm:w-44" options={[{ value: "all", label: "All modules" }, ...modules.map(value => ({ value, label: label(value) }))]} />
            <FilterSelect value={filters.action} onValueChange={value => changeFilter("action", value)} ariaLabel="Filter by action" className="w-full sm:w-40" options={[{ value: "all", label: "All actions" }, ...actions.map(value => ({ value, label: label(value) }))]} />
            <FilterSelect value={filters.status} onValueChange={value => changeFilter("status", value)} ariaLabel="Filter by status" className="w-full sm:w-40" options={[{ value: "all", label: "All statuses" }, { value: "success", label: "Success" }, { value: "failed", label: "Failed" }]} />
          </div>
        </CardContent>
        {error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-destructive"><span>{error}</span><Button variant="outline" onClick={() => { setError(""); setLoading(true); refresh(); }}>Try again</Button></div>
          : loading ? <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading activity log</div>
          : !items.length ? <div className="p-8 text-center text-sm text-muted-foreground">No matching activity.</div>
          : <ManagementTable><TableHeader><TableRow><TableHead>Date performed</TableHead><TableHead>Performed by</TableHead><TableHead>Action</TableHead><TableHead className="w-28">Status</TableHead></TableRow></TableHeader>
            <TableBody>{items.map(item => <TableRow key={item.id}>
              <ManagementTableCell data-label="Date performed" className="text-sm text-muted-foreground">{dateFormatter.format(new Date(item.createdAt))}</ManagementTableCell>
              <ManagementTableCell data-label="Performed by">{item.performedBy}</ManagementTableCell>
              <ManagementTableCell data-label="Action" className="whitespace-normal">{item.message}</ManagementTableCell>
              <ManagementTableCell data-label="Status"><Badge variant={item.status === "failed" ? "destructive" : "outline"} className={item.status === "success" ? "border-success-border bg-success-surface text-success" : undefined}>{item.status === "success" ? "Success" : "Failed"}</Badge></ManagementTableCell>
            </TableRow>)}</TableBody></ManagementTable>}
        {!loading && !error && total > 0 && <div className="border-t border-border px-4 py-3 [&>div]:mt-0"><TablePagination total={total} page={page} lastPage={lastPage} onPageChange={next => { setLoading(true); setPage(next); }} label="Activity log pagination" /></div>}
      </TableCard>
    </div>
  );
}
