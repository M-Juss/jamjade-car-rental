"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  UserX,
  X,
} from "lucide-react";
import { appToast } from "@/lib/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableActionMenu } from "@/components/common/tables/TableActionMenu";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { StaffForm } from "@/forms/staff/accounts/StaffAccountForm";
import { StaffRoleForm } from "@/forms/staff/roles/StaffRoleForm";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { SearchInput } from "@/components/common/forms/SearchInput";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, GENERIC_ERROR_MESSAGE } from "@/services/http";
import {
  createStaffRole,
  createStaffUser,
  deleteStaffRole,
  deleteStaffUser,
  getStaffManagement,
  updateStaffRole,
  updateStaffUser,
  type StaffManagementResponse,
  type StaffModule,
  type StaffRole,
  type StaffRolePayload,
  type StaffUser,
  type StaffUserPayload,
} from "@/services/staff";

type DeleteTarget =
  | { type: "user"; user: StaffUser }
  | { type: "role"; role: StaffRole };

const statusStyle = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inactive: "border-slate-200 bg-slate-50 text-slate-600",
};

function messageFromError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 419) {
      return "Your login session expired. Please log in again.";
    }

    if (error.status === 403) {
      return "Staff Management is available only to the owner account.";
    }
  }

  return GENERIC_ERROR_MESSAGE;
}

function formatDate(value?: string | null) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function moduleLabels(modules: StaffModule[], keys: string[]) {
  const labels = new Map(modules.map((module) => [module.key, module.label]));

  return keys.map((key) => labels.get(key) ?? key);
}

export function StaffManagementPage() {
  const [data, setData] = useState<StaffManagementResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [accountDialog, setAccountDialog] = useState<{ mode: "add" | "edit" | "view"; staff?: StaffUser | null } | null>(null);
  const [roleDialog, setRoleDialog] = useState<{ mode: "add" | "edit"; role?: StaffRole | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setData(await getStaffManagement());
    } catch (loadError) {
      setError(messageFromError(loadError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    getStaffManagement()
      .then((payload) => {
        if (mounted) setData(payload);
      })
      .catch((loadError) => {
        if (mounted) setError(messageFromError(loadError));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    if (!data) return [];

    return data.users.filter((user) => {
      const haystack = `${user.staffId} ${user.name} ${user.email} ${user.phoneNumber ?? ""}`.toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      const matchesRole = roleFilter === "all" || user.role?.name === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [data, roleFilter, search, statusFilter]);

  const assignableRoles = useMemo(() => data?.roles.filter((role) => role.canAssign) ?? [], [data]);

  const saveAccount = async (payload: StaffUserPayload) => {
    setIsSaving(true);
    setError(null);

    try {
      if (accountDialog?.mode === "edit" && accountDialog.staff) {
        await updateStaffUser(accountDialog.staff.id, payload);
      } else {
        await createStaffUser(payload);
      }

      await load();
    } finally {
      setIsSaving(false);
    }
  };

  const saveRole = async (payload: StaffRolePayload) => {
    setIsSaving(true);
    setError(null);

    try {
      if (roleDialog?.mode === "edit" && roleDialog.role) {
        await updateStaffRole(roleDialog.role.id, payload);
      } else {
        await createStaffRole(payload);
      }

      await load();
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setIsSaving(true);
    setError(null);

    try {
      if (deleteTarget.type === "user") {
        await deleteStaffUser(deleteTarget.user.id);
        appToast.success("Staff account deleted successfully.");
      } else {
        await deleteStaffRole(deleteTarget.role.id);
        appToast.success("Role deleted successfully.");
      }

      setDeleteTarget(null);
      await load();
    } catch (deleteError) {
      const message = messageFromError(deleteError);
      setError(message);
      appToast.error(
        message === GENERIC_ERROR_MESSAGE
          ? deleteTarget.type === "user"
            ? "The staff account could not be deleted. Please try again."
            : "The role could not be deleted. Please try again."
          : message,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const summary = data?.summary ?? { total: 0, active: 0, inactive: 0, roles: 0 };
  const modules = data?.modules ?? [];

  return (
    <div className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Staff Management</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Manage staff accounts, roles, credentials, and module access.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => setRoleDialog({ mode: "add" })}
            disabled={isLoading || !data}
            className="h-10 rounded-lg bg-foreground text-sm font-semibold text-white hover:bg-[#2A3659]"
          >
            <KeyRound size={15} className="mr-2" />
            Add Role
          </Button>
          <Button
            onClick={() => setAccountDialog({ mode: "add" })}
            disabled={isLoading || !data}
            className="h-10 rounded-lg bg-primary text-sm font-semibold text-white hover:bg-primary-hover"
          >
            <Plus size={15} className="mr-2" />
            Add Staff
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Total Staff", value: summary.total, icon: Users, tone: "bg-muted text-primary" },
          { label: "Active", value: summary.active, icon: UserCheck, tone: "bg-emerald-50 text-emerald-600" },
          { label: "Inactive", value: summary.inactive, icon: UserX, tone: "bg-slate-100 text-slate-600" },
          { label: "Roles", value: summary.roles, icon: ShieldCheck, tone: "bg-amber-50 text-amber-700" },
        ].map(({ label, value, icon, tone }) => (
          <KpiCard
            key={label}
            label={label}
            value={value}
            icon={icon}
            iconClassName={tone}
          />
        ))}
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700">
            <X size={16} />
          </button>
        </div>
      )}

      <Card className="rounded-lg border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search staff..."
              wrapperClassName="min-w-[220px] flex-1"
              className="h-10 rounded-lg pl-9 text-sm"
            />
            <FilterSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              ariaLabel="Filter staff by status"
              placeholder="Status"
              height="large"
              className="w-[140px] rounded-lg text-sm"
              options={[
                { value: "all", label: "All Status" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
            <FilterSelect
              value={roleFilter}
              onValueChange={setRoleFilter}
              ariaLabel="Filter staff by role"
              placeholder="Role"
              height="large"
              className="w-[160px] rounded-lg text-sm"
              options={[
                { value: "all", label: "All Roles" },
                ...(data?.roles.map((role) => ({ value: role.name, label: role.label })) ?? []),
              ]}
            />
            {(search || statusFilter !== "all" || roleFilter !== "all") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setRoleFilter("all");
                }}
                className="h-10 rounded-lg border-[#CBD5E1] text-sm text-muted-foreground"
              >
                <X size={14} className="mr-2" />
                Clear
              </Button>
            )}
            <span className="ml-auto text-xs font-medium text-muted-foreground">{filteredUsers.length} results</span>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-lg border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-background hover:bg-background">
                {["Staff ID", "Name", "Email", "Contact Number", "Role", "Status", "Last Login", "Actions"].map((heading) => (
                  <TableHead key={heading} className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {heading}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-14 text-center">
                    <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                      <Loader2 size={16} className="animate-spin" />
                      Loading staff management
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-14 text-center text-sm font-medium text-muted-foreground">
                    No staff accounts found.
                  </TableCell>
                </TableRow>
              ) : filteredUsers.map((staff) => (
                <TableRow key={staff.id} className="border-b border-background hover:bg-background">
                  <TableCell className="px-4 py-3 font-mono text-xs font-semibold text-primary">{staff.staffId}</TableCell>
                  <TableCell className="px-4 py-3">
                    <p className="min-w-[150px] text-sm font-semibold text-foreground">{staff.name}</p>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className="block max-w-[240px] truncate text-sm text-muted-foreground">{staff.email}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                    {staff.phoneNumber || "Not provided"}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline" className="rounded-md border-blue-100 bg-muted text-primary">
                      {staff.role?.label ?? "No role"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusStyle[staff.status]}`}>
                      {staff.isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(staff.lastLoginAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <TableActionMenu
                      label={`Open actions for ${staff.name}`}
                      items={[
                        {
                          label: "View",
                          icon: <Eye size={13} className="mr-2 text-subtle-foreground" />,
                          onClick: () => setAccountDialog({ mode: "view", staff }),
                        },
                        ...(staff.canEdit
                          ? [
                              {
                                label: "Edit",
                                icon: <Pencil size={13} className="mr-2 text-subtle-foreground" />,
                                onClick: () => setAccountDialog({ mode: "edit", staff }),
                              },
                            ]
                          : []),
                        ...(staff.canDelete
                          ? [
                              {
                                label: "Delete",
                                icon: <Trash2 size={13} className="mr-2" />,
                                onClick: () => setDeleteTarget({ type: "user", user: staff }),
                                separatorBefore: true,
                                variant: "danger" as const,
                              },
                            ]
                          : []),
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {data?.roles.map((role) => (
          <div key={role.id} className="rounded-lg border border-border bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">{role.label}</h2>
                  {role.isProtected && <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-amber-700">Protected</Badge>}
                  <Badge variant="outline" className="rounded-md border-slate-200 text-slate-600">{role.usersCount} users</Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{role.name}</p>
              </div>
              {(role.canEdit || role.canDelete) && (
                <TableActionMenu
                  label={`Open actions for ${role.label}`}
                  items={[
                    ...(role.canEdit
                      ? [
                          {
                            label: "Edit",
                            icon: <Pencil size={13} className="mr-2 text-subtle-foreground" />,
                            onClick: () => setRoleDialog({ mode: "edit", role }),
                          },
                        ]
                      : []),
                    ...(role.canDelete
                      ? [
                          {
                            label: "Delete",
                            icon: <Trash2 size={13} className="mr-2" />,
                            onClick: () => setDeleteTarget({ type: "role", role }),
                            separatorBefore: role.canEdit,
                            variant: "danger" as const,
                          },
                        ]
                      : []),
                  ]}
                />
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {moduleLabels(modules, role.modules).map((label) => (
                <Badge key={label} variant="outline" className="rounded-md border-[#D9E5FF] bg-[#F7FAFF] text-primary">
                  {label}
                </Badge>
              ))}
              {role.modules.length === 0 && <span className="text-xs text-subtle-foreground">No module access</span>}
            </div>
          </div>
        ))}
      </div>

      {accountDialog && (
        <StaffForm
          key={`${accountDialog.mode}-${accountDialog.staff?.id ?? "new"}`}
          open
          mode={accountDialog.mode}
          staff={accountDialog.staff}
          roles={assignableRoles}
          onOpenChange={(open) => !open && setAccountDialog(null)}
          onSave={saveAccount}
        />
      )}

      {roleDialog && (
        <StaffRoleForm
          key={`${roleDialog.mode}-${roleDialog.role?.id ?? "new"}`}
          open
          mode={roleDialog.mode}
          role={roleDialog.role}
          modules={modules}
          onOpenChange={(open) => !open && setRoleDialog(null)}
          onSave={saveRole}
        />
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isSaving) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-[420px] rounded-2xl border-0 shadow-[0_24px_64px_rgba(0,0,0,0.14)]">
          <AlertDialogHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-rose-50">
              <Trash2 size={19} className="text-rose-600" />
            </div>
            <AlertDialogTitle className="text-base font-bold text-foreground">
              Delete {deleteTarget?.type === "role" ? "Role" : "Staff Account"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-6 text-muted-foreground">
              {deleteTarget?.type === "role"
                ? `Delete the ${deleteTarget.role.label} role? This action cannot be undone.`
                : `Delete ${deleteTarget?.user.name}? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg border-[#CBD5E1] text-sm text-muted-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={isSaving}
              className="rounded-lg bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700"
            >
              {isSaving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
