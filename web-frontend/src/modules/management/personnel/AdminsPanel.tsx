"use client";

import { useEffect, useState } from "react";
import { Eye, Plus, ShieldOff } from "lucide-react";
import { PersonnelAccountForm } from "@/forms/personnel/PersonnelAccountForm";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { TableActionMenu } from "@/components/common/tables/TableActionMenu";
import { ManagementTable as Table, ManagementTableCell as TableCell, TableCard } from "@/components/common/tables/ManagementTable";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TABLE_PAGE_SIZE } from "@/lib/table-pagination";
import { appToast } from "@/lib/toast";
import { createAdmin, getAdmins, revokeAdmin, type PersonnelUser } from "@/services/personnel";
import styles from "./PersonnelModule.module.css";

export function AdminsPanel() {
  const [accounts, setAccounts] = useState<PersonnelUser[] | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ mode: "add" | "view"; account?: PersonnelUser } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PersonnelUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    getAdmins().then((result) => { if (active) { setAccounts(result); setError(""); } })
      .catch(() => { if (active) setError("Admin accounts could not be loaded."); });
    return () => { active = false; };
  }, [reload]);

  const filtered = accounts?.filter((account) => [account.name, account.email, account.phoneNumber ?? ""]
    .some((value) => value.toLowerCase().includes(search.trim().toLowerCase()))) ?? [];
  const lastPage = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  const visible = filtered.slice((page - 1) * TABLE_PAGE_SIZE, page * TABLE_PAGE_SIZE);

  const revoke = async () => {
    if (!revokeTarget) return;
    setBusy(true);
    try {
      await revokeAdmin(revokeTarget.id);
      appToast.success("Admin access revoked.");
      setRevokeTarget(null);
      setReload((value) => value + 1);
    } catch { appToast.error("Admin access could not be revoked."); }
    finally { setBusy(false); }
  };

  return <>
    <div className="flex justify-end"><Button onClick={() => setDialog({ mode: "add" })} disabled={!accounts || Boolean(error)}><Plus size={15} className="mr-2" />Add Admin</Button></div>
    <TableCard className="gap-0 rounded-2xl border border-border py-0 shadow-none ring-0" aria-label="Admin accounts">
      <CardContent className="border-b border-border p-4"><SearchInput value={search} onValueChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search admin accounts..." /></CardContent>
      {error ? <div role="alert" className="p-4 text-sm text-destructive"><p>{error}</p><Button variant="outline" onClick={() => setReload((value) => value + 1)}>Try Again</Button></div>
        : !accounts ? <p role="status" className="p-4">Loading admins</p>
        : !visible.length ? <p role="status" className="p-4">No admin accounts found.</p>
        : <>
          <Table className={styles.table}>
            <TableHeader><TableRow>{["Personnel", "Role", "Contact", "Status", "Last login", "Actions"].map((heading) => <TableHead key={heading}>{heading === "Actions" ? <span className="sr-only">Actions</span> : heading}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{visible.map((account) => <TableRow key={account.id}>
              <TableCell data-label="Personnel"><p className="font-semibold">{account.name}</p><p className="mt-1 text-xs text-muted-foreground">{account.personnelId}</p></TableCell>
              <TableCell data-label="Role">Admin</TableCell>
              <TableCell data-label="Contact"><p>{account.email}</p><p className="mt-1 text-xs text-muted-foreground">{account.phoneNumber || "No contact number"}</p></TableCell>
              <TableCell data-label="Status"><Badge variant="outline" className={account.isActive ? "border-success-border bg-success-surface text-success" : "border-border bg-background text-muted-foreground"}>{account.isActive ? "Active" : "Inactive"}</Badge></TableCell>
              <TableCell data-label="Last login">{account.lastLoginAt ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(account.lastLoginAt)) : "Never"}</TableCell>
              <TableCell data-label="Actions"><TableActionMenu label={`Open actions for ${account.name}`} items={[
                { label: "View", icon: <Eye size={13} className="mr-2" />, onClick: () => setDialog({ mode: "view", account }) },
                ...(account.isActive ? [{ label: "Revoke access", icon: <ShieldOff size={13} className="mr-2" />, variant: "danger" as const, onClick: () => setRevokeTarget(account) }] : []),
              ]} /></TableCell>
            </TableRow>)}</TableBody>
          </Table>
          <div className="border-t border-border px-4 py-3"><TablePagination total={filtered.length} page={page} lastPage={lastPage} onPageChange={setPage} label="Admin pagination" /></div>
        </>}
    </TableCard>
    {dialog && <PersonnelAccountForm open mode={dialog.mode} personnel={dialog.account} category="admin" roles={[{ name: "admin", label: "Admin" }]}
      onOpenChange={(open) => { if (!open) setDialog(null); }} onSave={async (values) => { await createAdmin(values); setPage(1); setReload((value) => value + 1); }} />}
    <AlertDialog open={Boolean(revokeTarget)} onOpenChange={(open) => { if (!open && !busy) setRevokeTarget(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Revoke Admin access?</AlertDialogTitle><AlertDialogDescription>This Admin will lose access to JamJade.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy} onClick={(event) => { event.preventDefault(); void revoke(); }}>{busy ? "Revoking..." : "Revoke access"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
