"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Circle, Fence, Loader2, MapPin, Pencil, Plus, RotateCcw, Trash2, XCircle } from "lucide-react";
import { TableActionMenu, type TableActionMenuItem } from "@/components/common/tables/TableActionMenu";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { appToast } from "@/lib/toast";
import { deleteGeofence, getGeofences, setGeofenceActive, type GeofenceRecord } from "@/services/geofence";
import { GeofenceTemplateDialog } from "@/forms/geofence/GeofenceTemplateDialog";

type Filter = "all" | "active" | "inactive";

function GeofenceShape({ record }: { record: GeofenceRecord }) {
  return record.geometryType === "circle"
    ? <span className="inline-flex items-center gap-1.5"><Circle className="size-3.5" />Circle · {record.radiusMeters?.toLocaleString()} m</span>
    : <span className="inline-flex items-center gap-1.5"><Fence className="size-3.5" />Polygon · {record.polygonCoordinates?.length ?? 0} points</span>;
}

function primaryCoordinates(record: GeofenceRecord) {
  if (record.geometryType === "circle") {
    return { latitude: record.centerLatitude, longitude: record.centerLongitude };
  }

  return record.polygonCoordinates?.[0] ?? null;
}

export function GeofenceLibraryModule() {
  const [records, setRecords] = useState<GeofenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GeofenceRecord | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<GeofenceRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRecords(await getGeofences(true));
    } catch {
      setError("Geofence templates could not be loaded. Check your access and try again.");
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
      const statusMatches = filter === "all"
        || (filter === "active" && record.isActive && !record.isDeleted)
        || (filter === "inactive" && !record.isActive && !record.isDeleted);
      return statusMatches && `${record.name} ${record.geometryType} ${record.createdBy?.name ?? ""}`.toLowerCase().includes(query);
    });
  }, [filter, records, search]);

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
    if (!deleteTarget || deleteTarget.isDeleted || deleteTarget.assignedBookingCount > 0) return;
    try {
      setIsDeleting(true);
      await deleteGeofence(deleteTarget.id);
      appToast.success("Geofence moved to deleted templates.");
      setDeleteTarget(null);
      await load();
    } catch {
      appToast.error(deleteTarget.assignedBookingCount > 0
        ? "This template has booking history and cannot be deleted. Deactivate it instead."
        : "The geofence could not be deleted. Please try again.");
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Geofence Library</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Create reusable circles and mapped rental boundaries for self-drive bookings.</p>
        </div>
        <Button type="button" onClick={openCreate}><Plus />Create Geofence</Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Active Templates" value={activeCount} icon={MapPin} iconClassName="bg-muted text-primary" />
        <KpiCard label="Circle Templates" value={circleCount} icon={Circle} iconClassName="bg-muted text-primary" />
        <KpiCard label="Polygon Templates" value={polygonCount} icon={Fence} iconClassName="bg-success-surface text-success" />
      </div>

      {error ? <Card className="rounded-2xl border border-destructive-border bg-destructive-surface shadow-none"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-destructive">{error}</p><Button type="button" size="sm" variant="outline" onClick={() => void load()}>Try Again</Button></CardContent></Card> : null}

      <Card className="rounded-2xl border-0 bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
        <CardContent className="p-4"><div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <SearchInput value={search} onValueChange={setSearch} placeholder="Search geofences..." wrapperClassName="min-w-[180px] flex-1" />
          <FilterSelect value={filter} onValueChange={(value) => setFilter(value as Filter)} ariaLabel="Filter geofence templates" className="sm:w-[180px]" options={[
            { value: "all", label: "All Templates" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]} />
        </div></CardContent>
      </Card>

      {loading ? <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />Loading geofences</div> : (
        <Card className="overflow-hidden rounded-2xl border-0 bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="border-b border-border bg-background hover:bg-background">
                {["Name", "Shape", "Latitude", "Longitude", "Created By", "Status", "Action"].map((label) => <TableHead key={label} className="whitespace-nowrap px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-subtle-foreground">{label}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="py-12 text-center text-[12px] text-muted-foreground">{records.length ? "No geofence templates match this view." : "No geofence templates yet. Create one to reuse a rental boundary."}</TableCell></TableRow> : filtered.map((record) => {
                  const deleted = record.isDeleted;
                  const coordinates = primaryCoordinates(record);
                  const actions: TableActionMenuItem[] = deleted ? [
                    { label: "Delete", icon: <Trash2 size={13} className="mr-2" />, disabled: true, variant: "danger" },
                  ] : [
                    { label: "Edit Geofence", icon: <Pencil size={13} className="mr-2" />, onClick: () => openEdit(record) },
                    { label: record.isActive ? "Deactivate" : "Activate", icon: record.isActive ? <XCircle size={13} className="mr-2" /> : <RotateCcw size={13} className="mr-2" />, onClick: () => void toggleActive(record), disabled: isUpdating === record.id },
                    { label: "Delete", icon: <Trash2 size={13} className="mr-2" />, onClick: () => setDeleteTarget(record), disabled: record.assignedBookingCount > 0, separatorBefore: true, variant: "danger" },
                  ];
                  return <TableRow key={record.id} className="border-b border-background hover:bg-background">
                    <TableCell className="px-4 py-3"><p className="text-[12.5px] font-semibold text-foreground">{record.name}</p></TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-[12px] text-muted-foreground"><GeofenceShape record={record} /></TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-[12px] text-muted-foreground">
                      {coordinates?.latitude?.toFixed(5) ?? "—"}
                      {record.geometryType === "polygon" && coordinates ? <p className="mt-0.5 text-[10.5px] text-muted-foreground">First point</p> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-[12px] text-muted-foreground">
                      {coordinates?.longitude?.toFixed(5) ?? "—"}
                      {record.geometryType === "polygon" && coordinates ? <p className="mt-0.5 text-[10.5px] text-muted-foreground">First point</p> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-[12px] text-muted-foreground">{record.createdBy?.name ?? "—"}</TableCell>
                    <TableCell className="px-4 py-3"><Badge variant={deleted ? "outline" : record.isActive ? "default" : "secondary"}>{deleted ? "Deleted" : record.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell className="px-4 py-3"><TableActionMenu label={`Open actions for ${record.name}`} items={actions} /></TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <GeofenceTemplateDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} record={editing} onSaved={() => void load()} />
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-[430px] rounded-2xl border-0 shadow-[0_24px_64px_rgba(0,0,0,0.13)]">
          <AlertDialogHeader><AlertDialogTitle>Move Geofence to Deleted?</AlertDialogTitle><AlertDialogDescription>“{deleteTarget?.name}” will be soft-deleted and removed from the active library. Its stored record remains available for system history. A geofence used by a booking cannot be deleted.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Keep Template</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={isDeleting || Boolean(deleteTarget?.isDeleted) || Boolean(deleteTarget?.assignedBookingCount)} onClick={(event) => { event.preventDefault(); void confirmDelete(); }}>{isDeleting ? "Deleting..." : "Delete"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
