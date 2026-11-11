"use client";

import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";

import { ManagementTable as Table, ManagementTableCell as TableCell, TableCard } from "@/components/common/tables/ManagementTable";
import { TablePagination } from "@/components/common/tables/TablePagination";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, Car, Eye, Loader2, Pencil, Plus, Trash2, UserCheck, Users, X } from "lucide-react";
import { PersonnelAccountForm } from "@/forms/personnel/PersonnelAccountForm";
import { DeletePersonnelDialog } from "@/forms/personnel/DeletePersonnelDialog";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { TableActionMenu } from "@/components/common/tables/TableActionMenu";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, GENERIC_ERROR_MESSAGE } from "@/services/http";
import { createPersonnel, getPersonnel, updatePersonnel, type PersonnelFilter, type PersonnelResponse, type PersonnelUser } from "@/services/personnel";
import type { PersonnelAccountFormValues } from "@/validations/personnel/schemas";
import { useManagementSession } from "@/modules/management/shell/context/ManagementSessionProvider";
import { getUserRoleNames } from "@/services/auth";
import styles from "./PersonnelModule.module.css";

function messageFromError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 419) return "Your login session expired. Please log in again.";
    if (error.status === 403) return "You do not have access to Personnel.";
  }
  return GENERIC_ERROR_MESSAGE;
}

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(value));
}

export function PersonnelPage() {
  const { user } = useManagementSession();
  const roleNames = user ? getUserRoleNames(user) : [];
  const isOwner = roleNames.includes("owner");
  const isStaff = !roleNames.includes("admin");
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
  const [deleteTarget, setDeleteTarget] = useState<PersonnelUser | null>(null);

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
    setCategory((current) => current === "all" || values.role === "admin" ? current : values.role);
    setPage(1);
    refresh();
  };

  const summary = data?.summary;
  const categoryLabel = category === "all" ? "Personnel" : category === "driver" ? "Driver" : category === "admin" ? "Admin" : "Staff";
  const hasFilters = Boolean(searchInput || status !== "all" || category !== "all");
  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("all");
    setCategory("all");
    setPage(1);
    refresh();
  };

  return (
    <div className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ManagementPageHeading title="Personnel" description="Manage staff and driver accounts and access." />
        <Button onClick={() => setAccountDialog({ mode: "add" })} disabled={isLoading || Boolean(error) || !data}>
          <Plus size={15} className="mr-2" />Add {categoryLabel}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Personnel", value: error ? "—" : summary?.total ?? "—", icon: Users },
          { label: "Active", value: error ? "—" : summary?.active ?? "—", icon: UserCheck },
          { label: "Staff", value: error ? "—" : summary?.staff ?? "—", icon: BriefcaseBusiness },
          { label: "Drivers", value: error ? "—" : summary?.drivers ?? "—", icon: Car },
        ].map((item) => <KpiCard key={item.label} {...item} />)}
      </div>

      <TableCard className="gap-0 rounded-2xl border border-border py-0 shadow-none ring-0" aria-label="Personnel accounts">
        <CardContent className="border-b border-border p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchInput
              value={searchInput}
              onValueChange={setSearchInput}
              placeholder={`Search ${categoryLabel.toLowerCase()} accounts...`}
              wrapperClassName="min-w-0 basis-full sm:basis-auto sm:flex-1"
              className="h-11 rounded-lg bg-surface pl-9 text-base placeholder:text-muted-foreground sm:text-sm"
            />
            <FilterSelect
              value={category}
              onValueChange={(value) => { setIsLoading(true); setError(null); setCategory(value); setPage(1); }}
              ariaLabel="Filter personnel by role"
              placeholder="Role"
              height="large"
              className="min-w-0 flex-1 basis-36 rounded-lg bg-surface text-base text-foreground data-[size=default]:h-11 sm:w-36 sm:flex-none sm:basis-auto sm:text-sm"
              options={[{ value: "all", label: "All roles" }, ...(isOwner ? [{ value: "admin", label: "Admins" }] : []), { value: "staff", label: "Staff" }, { value: "driver", label: "Drivers" }]}
            />
            <FilterSelect
              value={status}
              onValueChange={(value) => { setIsLoading(true); setError(null); setStatus(value); setPage(1); }}
              ariaLabel="Filter personnel by status"
              placeholder="Status"
              height="large"
              className="min-w-0 flex-1 basis-36 rounded-lg bg-surface text-base text-foreground data-[size=default]:h-11 sm:w-36 sm:flex-none sm:basis-auto sm:text-sm"
              options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
            />
            {hasFilters && <Button variant="ghost" onClick={clearFilters} className="h-11 text-sm text-muted-foreground"><X size={14} />Clear</Button>}
          </div>
        </CardContent>

        {isLoading ? (
          <div role="status" className="flex min-h-64 items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading personnel
          </div>
        ) : error ? (
          <div role="alert" className="flex flex-col gap-3 bg-destructive-surface p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <p>{error}</p>
            <Button variant="outline" onClick={refresh} className="h-11">Try Again</Button>
          </div>
        ) : !data?.users.length ? (
          <div role="status" className="flex min-h-64 flex-col items-center justify-center gap-3 px-4 py-12 text-center text-sm text-muted-foreground">
            <p>No {categoryLabel.toLowerCase()} accounts found.</p>
            {hasFilters && <Button variant="outline" onClick={clearFilters} className="h-11">Clear filters</Button>}
          </div>
        ) : (
          <>
            <Table className={styles.table}>
              <colgroup>
                <col style={{ width: "25%" }} />
                <col style={{ width: "10%" }} />
                <col />
                <col style={{ width: "14%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "3rem" }} />
              </colgroup>
              <TableHeader>
                <TableRow className="border-b border-border bg-background hover:bg-background">
                  {["Personnel", "Role", "Contact", "Status", "Last login", "Actions"].map((heading) => (
                    <TableHead key={heading}>{heading === "Actions" ? <span className="sr-only">Actions</span> : heading}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((personnel) => (
                  <TableRow key={personnel.id}>
                    <TableCell data-label="Personnel" className={styles.personCell}>
                      <p className="font-semibold text-foreground">{personnel.name}</p>
                      <p className="mt-1 text-xs tabular-nums text-muted-foreground"><span className="sr-only">Personnel ID: </span>{personnel.personnelId}</p>
                    </TableCell>
                    <TableCell data-label="Role" className={styles.roleCell}>{personnel.role.label}</TableCell>
                    <TableCell data-label="Contact" className={styles.contactCell}>
                      <p><span className="sr-only">Email: </span>{personnel.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground"><span className="sr-only">Contact number: </span>{personnel.phoneNumber || "No contact number"}</p>
                    </TableCell>
                    <TableCell data-label="Status" className={styles.statusCell}>
                      <Badge variant="outline" className={personnel.isActive ? "border-success-border bg-success-surface text-success" : "border-border bg-background text-muted-foreground"}>
                        {personnel.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell data-label="Last login" className={styles.loginCell}><span className="text-xs text-muted-foreground">{formatDate(personnel.lastLoginAt)}</span></TableCell>
                    <TableCell data-label="Actions" className={styles.actionsCell}>
                      <TableActionMenu label={`Open actions for ${personnel.name}`} items={[
                        { label: "View", icon: <Eye size={13} className="mr-2" />, onClick: () => setAccountDialog({ mode: "view", personnel }) },
                        ...(!isStaff || personnel.role.name === "driver" ? [{ label: "Edit", icon: <Pencil size={13} className="mr-2" />, onClick: () => setAccountDialog({ mode: "edit", personnel }) },
                        { label: "Delete", icon: <Trash2 size={13} className="mr-2" />, variant: "danger" as const, separatorBefore: true, onClick: () => setDeleteTarget(personnel) }] : []),
                      ]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-border px-4 py-3 [&>div]:mt-0">
              <TablePagination
                total={data.pagination.total}
                page={data.pagination.currentPage}
                lastPage={data.pagination.lastPage}
                onPageChange={(nextPage) => { setIsLoading(true); setError(null); setPage(nextPage); }}
                label="Personnel pagination"
              />
            </div>
          </>
        )}
      </TableCard>

      {accountDialog && data && <PersonnelAccountForm key={`${accountDialog.mode}-${accountDialog.personnel?.id ?? category}`} open mode={accountDialog.mode} personnel={accountDialog.personnel} roles={accountDialog.personnel?.role.name === "admin" ? data.roles.filter((role) => role.name === "admin") : accountDialog.mode === "edit" ? data.roles.filter((role) => role.name !== "admin") : data.roles} category={accountDialog.mode === "add" && data.roles.some((role) => role.name === category) ? category as "admin" | "staff" | "driver" : undefined} onOpenChange={(open) => { if (!open) setAccountDialog(null); }} onSave={saveAccount} />}
      {deleteTarget && <DeletePersonnelDialog key={deleteTarget.id} personnel={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => {
        if (data?.users.length === 1 && page > 1) setPage((current) => current - 1);
        refresh();
      }} />}
    </div>
  );
}
