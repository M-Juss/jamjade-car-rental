"use client";

import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";

import { ManagementTable as Table, ManagementTableCell as TableCell, TableCard } from "@/components/common/tables/ManagementTable";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { useTablePagination } from "@/components/common/tables/useTablePagination";

import { getUserRoleNames } from "@/services/auth";
import { useManagementSession } from "@/modules/management/shell/context/ManagementSessionProvider";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Circle, Eye, Fence, Loader2, Map, Pencil, Plus, RotateCcw, SquareDashed, Trash2, XCircle } from "lucide-react";
import { TableActionMenu, type TableActionMenuItem } from "@/components/common/tables/TableActionMenu";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { appToast } from "@/lib/toast";
import { deleteGeofence, getGeofences, setGeofenceActive, type GeofenceRecord } from "@/services/geofence";
import { GeofenceTemplateDialog } from "@/forms/geofence/GeofenceTemplateDialog";
import { GeofenceDetailsDialog } from "./components/GeofenceDetailsDialog";

type Filter = "all" | "active" | "inactive";

function GeofenceShape({ record }: { record: GeofenceRecord }) {
  return record.geometryType === "circle"
    ? <span className="inline-flex max-w-full items-start gap-1.5"><Circle className="mt-0.5 size-3.5 shrink-0" /><span>Circle<span className="mt-0.5 block text-xs text-muted-foreground">Radius {record.radiusMeters?.toLocaleString()} m</span></span></span>
    : <span className="inline-flex max-w-full items-start gap-1.5"><Fence className="mt-0.5 size-3.5 shrink-0" /><span>Polygon<span className="mt-0.5 block text-xs text-muted-foreground">{record.polygonCoordinates?.length ?? 0} points</span></span></span>;
}

function primaryCoordinates(record: GeofenceRecord) {
  if (record.geometryType === "circle") {
    return { latitude: record.centerLatitude, longitude: record.centerLongitude };
  }

  return record.polygonCoordinates?.[0] ?? null;
}

export function GeofenceLibraryModule() {
  const { user } = useManagementSession();
  const canManage = user ? getUserRoleNames(user).includes("admin") : false;
  const [records, setRecords] = useState<GeofenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GeofenceRecord | undefined>();
  const [viewing, setViewing] = useState<GeofenceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GeofenceRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRecords(await getGeofences());
    } catch {
      setError("Monitoring zones could not be loaded. Check your access and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadGeofences() {
      await load();
    }
    void loadGeofences();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (record.isDeleted) return false;
      const statusMatches = filter === "all"
        || (filter === "active" && record.isActive && !record.isDeleted)
        || (filter === "inactive" && !record.isActive && !record.isDeleted);
      return statusMatches && `${record.name} ${record.geometryType} ${record.createdBy?.name ?? ""}`.toLowerCase().includes(query);
    });
  }, [filter, records, search]);

  const pagination = useTablePagination(filtered, `${search}|${filter}`);

  const activeCount = records.filter((record) => record.isActive && !record.isDeleted).length;
  const circleCount = records.filter((record) => record.geometryType === "circle" && !record.isDeleted).length;
  const polygonCount = records.filter((record) => record.geometryType === "polygon" && !record.isDeleted).length;

  const toggleActive = async (record: GeofenceRecord) => {
    try {
      setIsUpdating(record.id);
      await setGeofenceActive(record.id, !record.isActive);
      appToast.success(record.isActive ? "Geofence deactivated." : "Geofence activated.");
      await load();
    } catch {
      appToast.error("The geofence status could not be changed. Please try again.");
    } finally {
      setIsUpdating(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteTarget.isDeleted) return;
    try {
      setIsDeleting(true);
      await deleteGeofence(deleteTarget.id);
      setRecords((current) => current.filter((record) => record.id !== deleteTarget.id));
      appToast.success("Geofence deleted successfully.");
      setDeleteTarget(null);
      await load();
    } catch {
      appToast.error("The geofence could not be deleted. Please try again.");
      await load();
    } finally {
      setIsDeleting(false);
    }
  };

  const openCreate = () => { setEditing(undefined); setDialogOpen(true); };
  const openEdit = (record: GeofenceRecord) => { setEditing(record); setDialogOpen(true); };

  return (
    <section className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ManagementPageHeading
          title="Geofence Library"
          description="Manage default monitoring zones for self-drive rentals."
        />
        {canManage ? <Button type="button" onClick={openCreate}><Plus />Create Default Zone</Button> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {[
          { label: "Active zones", value: loading || error ? "—" : activeCount, icon: Map },
          { label: "Circle zones", value: loading || error ? "—" : circleCount, icon: Circle },
          { label: "Polygon zones", value: loading || error ? "—" : polygonCount, icon: SquareDashed },
        ].map((item) => <KpiCard key={item.label} {...item} />)}
      </div>

      {error ? <Card className="rounded-2xl border border-destructive-border bg-destructive-surface shadow-none"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-destructive">{error}</p><Button type="button" size="sm" variant="outline" onClick={() => void load()}>Try Again</Button></CardContent></Card> : null}

      <TableCard>
        <CardContent className="border-b border-border p-4"><div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <SearchInput value={search} onValueChange={setSearch} placeholder="Search geofences..." wrapperClassName="min-w-[180px] flex-1" />
          <FilterSelect value={filter} onValueChange={(value) => setFilter(value as Filter)} ariaLabel="Filter monitoring zones" className="sm:w-[180px]" options={[
            { value: "all", label: "All Zones" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]} />
        </div></CardContent>

      {loading ? <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />Loading geofences</div> : (
          <div className="min-w-0">
            <Table>
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
                <col />
                <col style={{ width: "12%" }} />
                <col style={{ width: "3rem" }} />
              </colgroup>
              <TableHeader><TableRow className="border-b border-border bg-background hover:bg-background">
                {["Name", "Shape", "Latitude", "Longitude", "Created By", "Status", "Action"].map((label) => <TableHead key={label} className="whitespace-normal px-4 py-3 text-xs font-semibold normal-case tracking-normal text-subtle-foreground">{label === "Action" || label === "Actions" ? <span className="sr-only">Actions</span> : label}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">{records.length ? "No monitoring zones match this view." : "No default zones configured. Rentals can proceed without geofence alerts."}</TableCell></TableRow> : pagination.rows.map((record) => {
                  const coordinates = primaryCoordinates(record);
                  const actions: TableActionMenuItem[] = !canManage ? [
                    { label: "View Geofence", icon: <Eye size={13} className="mr-2" />, onClick: () => setViewing(record) },
                  ] : [
                    { label: "View Geofence", icon: <Eye size={13} className="mr-2" />, onClick: () => setViewing(record) },
                    { label: "Edit Geofence", icon: <Pencil size={13} className="mr-2" />, onClick: () => openEdit(record) },
                    { label: record.isActive ? "Deactivate" : "Activate", icon: record.isActive ? <XCircle size={13} className="mr-2" /> : <RotateCcw size={13} className="mr-2" />, onClick: () => void toggleActive(record), disabled: isUpdating === record.id },
                    { label: "Delete", icon: <Trash2 size={13} className="mr-2" />, onClick: () => setDeleteTarget(record), separatorBefore: true, variant: "danger" },
                  ];
                  return <TableRow key={record.id} className="border-b border-background hover:bg-background">
                    <TableCell data-label="Name" className="px-4 py-3"><p className="text-sm font-semibold text-foreground">{record.name}</p></TableCell>
                    <TableCell data-label="Shape" className="whitespace-normal px-4 py-3 text-sm text-muted-foreground"><GeofenceShape record={record} /></TableCell>
                    <TableCell data-label="Latitude" className="whitespace-normal px-4 py-3 text-sm text-muted-foreground">
                      {coordinates?.latitude?.toFixed(5) ?? "—"}
                      {record.geometryType === "polygon" && coordinates ? <p className="mt-0.5 text-xs text-muted-foreground">First point</p> : null}
                    </TableCell>
                    <TableCell data-label="Longitude" className="whitespace-normal px-4 py-3 text-sm text-muted-foreground">
                      {coordinates?.longitude?.toFixed(5) ?? "—"}
                      {record.geometryType === "polygon" && coordinates ? <p className="mt-0.5 text-xs text-muted-foreground">First point</p> : null}
                    </TableCell>
                    <TableCell data-label="Created By" className="whitespace-normal px-4 py-3 text-sm text-muted-foreground">{record.createdBy?.name ?? "—"}</TableCell>
                    <TableCell data-label="Status" className="px-4 py-3"><Badge variant={record.isActive ? "default" : "secondary"}>{record.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell data-label="Actions" className="px-4 py-3"><TableActionMenu label={`Open actions for ${record.name}`} items={actions} /></TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          </div>
      )}
      {!loading && !error && pagination.total > 0 && <div className="border-t border-border px-4 py-3 [&>div]:mt-0"><TablePagination {...pagination} label="Monitoring zones pagination" /></div>}
      </TableCard>

      {canManage ? <GeofenceTemplateDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} record={editing} onSaved={() => void load()} /> : null}
      <GeofenceDetailsDialog key={viewing?.id ?? "view"} record={viewing} onClose={() => setViewing(null)} />
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-[430px] rounded-2xl border border-border shadow-dialog">
          <AlertDialogHeader><AlertDialogTitle>Delete Geofence?</AlertDialogTitle><AlertDialogDescription>“{deleteTarget?.name}” will be removed from the library. Released rentals keep their saved zones and history.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Keep Template</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={isDeleting || Boolean(deleteTarget?.isDeleted)} onClick={(event) => { event.preventDefault(); void confirmDelete(); }}>{isDeleting ? "Deleting..." : "Delete"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
