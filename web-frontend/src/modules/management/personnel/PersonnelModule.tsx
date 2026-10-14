"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Loader2, Pencil, Plus, UserCheck, Users, X } from "lucide-react";
import { PersonnelAccountForm } from "@/forms/personnel/PersonnelAccountForm";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { TableActionMenu } from "@/components/common/tables/TableActionMenu";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, GENERIC_ERROR_MESSAGE } from "@/services/http";
import { createPersonnel, getPersonnel, updatePersonnel, type PersonnelFilter, type PersonnelResponse, type PersonnelUser } from "@/services/personnel";
import type { PersonnelAccountFormValues } from "@/validations/personnel/schemas";

function messageFromError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 419) return "Your login session expired. Please log in again.";
    if (error.status === 403) return "Personnel is available only to the admin account.";
  }
  return GENERIC_ERROR_MESSAGE;
}

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function PersonnelPage() {
  const [data, setData] = useState<PersonnelResponse | null>(null);
  const [category, setCategory] = useState<PersonnelFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountDialog, setAccountDialog] = useState<{ mode: "add" | "edit" | "view"; personnel?: PersonnelUser } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim() !== search) {
        setIsLoading(true);
        setError(null);
        setPage(1);
        setSearch(searchInput.trim());
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    let live = true;
    getPersonnel({ role: category, search, status, page })
      .then((payload) => { if (live) setData(payload); })
      .catch((loadError) => { if (live) setError(messageFromError(loadError)); })
      .finally(() => { if (live) setIsLoading(false); });
    return () => { live = false; };
  }, [category, search, status, page, reloadKey]);

  const refresh = () => {
    setIsLoading(true);
    setError(null);
    setReloadKey((value) => value + 1);
  };

  const saveAccount = async (values: PersonnelAccountFormValues) => {
    if (accountDialog?.mode === "edit" && accountDialog.personnel) {
      await updatePersonnel(accountDialog.personnel.id, values);
    } else {
      await createPersonnel(values);
    }
    setCategory((current) => current === "all" ? current : values.role);
    setPage(1);
    refresh();
  };

  const summary = data?.summary ?? { total: 0, active: 0, staff: 0, drivers: 0 };
  const categoryLabel = category === "all" ? "Personnel" : category === "driver" ? "Driver" : "Staff";

  return (
    <div className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Personnel</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Manage staff and driver accounts, credentials, and account status.</p>
        </div>
        <Button onClick={() => setAccountDialog({ mode: "add" })} disabled={isLoading || Boolean(error) || !data} className="h-10 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
          <Plus size={15} className="mr-2" />Add {categoryLabel}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Total Personnel", value: summary.total, icon: Users, tone: "bg-muted text-primary" },
          { label: "Active", value: summary.active, icon: UserCheck, tone: "bg-success-surface text-success" },
          { label: "Staff", value: summary.staff, icon: Users, tone: "bg-muted text-primary" },
          { label: "Drivers", value: summary.drivers, icon: Users, tone: "bg-warning-surface text-warning" },
        ].map(({ label, value, icon, tone }) => <KpiCard key={label} label={label} value={value} icon={icon} iconClassName={tone} />)}
      </div>

      {error && (
        <Card className="rounded-2xl border border-destructive-border bg-destructive-surface shadow-none">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={refresh}>Try Again</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <Card className="rounded-lg border-0 bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <SearchInput value={searchInput} onValueChange={setSearchInput} placeholder={`Search ${categoryLabel.toLowerCase()} accounts...`} wrapperClassName="min-w-0 basis-full sm:basis-auto sm:flex-1" className="h-10 rounded-lg pl-9 text-sm" />
              <FilterSelect value={category} onValueChange={(value) => { setIsLoading(true); setError(null); setCategory(value); setPage(1); }} ariaLabel="Filter personnel by role" placeholder="Personnel" height="large" className="w-[170px] shrink-0 rounded-lg text-sm" options={[{ value: "all", label: "All Personnel" }, { value: "staff", label: "Staff" }, { value: "driver", label: "Driver" }]} />
              <FilterSelect value={status} onValueChange={(value) => { setIsLoading(true); setError(null); setStatus(value); setPage(1); }} ariaLabel="Filter personnel by status" placeholder="Status" height="large" className="w-[140px] rounded-lg text-sm" options={[{ value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
              {(searchInput || status !== "all" || category !== "all") && <Button variant="outline" onClick={() => { setSearchInput(""); setSearch(""); setStatus("all"); setCategory("all"); setPage(1); refresh(); }} className="h-10 rounded-lg border-border text-sm text-muted-foreground"><X size={14} className="mr-2" />Clear</Button>}
              <span className="ml-auto text-xs font-medium text-muted-foreground">{isLoading ? "Loading..." : error ? "Unavailable" : `${data?.pagination.total ?? 0} results`}</span>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">Deactivate accounts through Edit to preserve rental history. {category === "driver" ? "Drivers use the mobile app and see only assigned services." : category === "staff" ? "Staff use the web portal with fixed operational access." : "Staff use the web portal; Drivers use the mobile app for assigned services."}</p>
        <Card className="overflow-hidden rounded-lg border-0 bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-background hover:bg-background">
                  {["Personnel ID", "Name", "Role", "Email", "Contact Number", "Status", "Last Login", "Actions"].map((heading) => <TableHead key={heading} className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{heading}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={8} className="py-14 text-center"><div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground"><Loader2 size={16} className="animate-spin" />Loading personnel</div></TableCell></TableRow>
                  : error ? <TableRow><TableCell colSpan={8} className="py-14 text-center text-sm text-muted-foreground">Personnel accounts could not be loaded.</TableCell></TableRow>
                  : !data?.users.length ? <TableRow><TableCell colSpan={8} className="py-14 text-center text-sm font-medium text-muted-foreground">No {categoryLabel.toLowerCase()} accounts found.</TableCell></TableRow>
                  : data.users.map((personnel) => (
                    <TableRow key={personnel.id} className="border-b border-background hover:bg-background">
                      <TableCell className="px-4 py-3 font-mono text-xs font-semibold text-primary">{personnel.personnelId}</TableCell>
                      <TableCell className="px-4 py-3"><p className="min-w-[150px] text-sm font-semibold text-foreground">{personnel.name}</p></TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{personnel.role.label}</TableCell>
                      <TableCell className="px-4 py-3"><span className="block max-w-[240px] truncate text-sm text-muted-foreground">{personnel.email}</span></TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{personnel.phoneNumber || "Not provided"}</TableCell>
                      <TableCell className="px-4 py-3"><Badge variant="outline" className={`rounded-md px-2 py-1 text-xs font-semibold ${personnel.isActive ? "border-success-border bg-success-surface text-success" : "border-border bg-muted text-muted-foreground"}`}>{personnel.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDate(personnel.lastLoginAt)}</TableCell>
                      <TableCell className="px-4 py-3"><TableActionMenu label={`Open actions for ${personnel.name}`} items={[
                        { label: "View", icon: <Eye size={13} className="mr-2 text-subtle-foreground" />, onClick: () => setAccountDialog({ mode: "view", personnel }) },
                        { label: "Edit", icon: <Pencil size={13} className="mr-2 text-subtle-foreground" />, onClick: () => setAccountDialog({ mode: "edit", personnel }) },
                      ]} /></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          {data && !error && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">Page {data.pagination.currentPage} of {data.pagination.lastPage}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" aria-label="Previous page" disabled={page <= 1 || isLoading} onClick={() => { setIsLoading(true); setPage((value) => value - 1); }}><ChevronLeft size={15} /></Button>
                <Button variant="outline" size="icon" aria-label="Next page" disabled={page >= data.pagination.lastPage || isLoading} onClick={() => { setIsLoading(true); setPage((value) => value + 1); }}><ChevronRight size={15} /></Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {accountDialog && data && <PersonnelAccountForm key={`${accountDialog.mode}-${accountDialog.personnel?.id ?? category}`} open mode={accountDialog.mode} personnel={accountDialog.personnel} roles={data.roles} category={category === "all" ? undefined : category} onOpenChange={(open) => { if (!open) setAccountDialog(null); }} onSave={saveAccount} />}
    </div>
  );
}
