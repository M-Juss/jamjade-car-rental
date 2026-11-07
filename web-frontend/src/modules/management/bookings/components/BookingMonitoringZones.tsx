"use client";

import { useState } from "react";
import { Fence, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetadataList } from "@/components/common/data-display/MetadataList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { GeofenceTemplateDialog } from "@/forms/geofence/GeofenceTemplateDialog";
import { appToast } from "@/lib/toast";
import { getBooking, type BookingRecord, type BookingMonitoringZone } from "@/services/booking";
import { deleteBookingMonitoringZone } from "@/services/geofence";

export function BookingMonitoringZones({ booking, onUpdated }: { booking: BookingRecord; onUpdated: (booking: BookingRecord) => void }) {
  const [editing, setEditing] = useState<BookingMonitoringZone | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleting, setDeleting] = useState<BookingMonitoringZone | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    try { onUpdated(await getBooking(booking.backendId)); }
    catch { appToast.error("Monitoring zones could not be refreshed. Close and reopen the booking."); }
  };
  const remove = async () => {
    if (!deleting?.id) return;
    setBusy(true);
    try {
      await deleteBookingMonitoringZone(booking.backendId, deleting.id);
      appToast.success("Booking monitoring zone removed.");
      setDeleting(null);
      await refresh();
    } catch { appToast.error("The booking monitoring zone could not be removed. Refresh the booking and try again."); }
    finally { setBusy(false); }
  };

  return <>
    <Card className="rounded-2xl border-border bg-surface shadow-none">
      <CardHeader className="gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-sm"><Fence size={17} />Monitoring zones</CardTitle>
          {booking.canManageMonitoringZones ? <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus size={14} />Add Booking Zone</Button> : null}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">Zones record entry and exit without restricting movement. Settings are fixed when the rental starts.</p>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        {(booking.monitoringZones ?? []).length === 0 ? <p className="text-xs text-muted-foreground">No monitoring zones.</p> : null}
        {(booking.monitoringZones ?? []).map((zone, index) => <div key={zone.id ?? `default-${index}`} className="space-y-2 rounded-xl bg-background p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-foreground">{zone.name}</p><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{zone.scope === "default" ? "Default" : "Booking only"}</Badge>{zone.frozenAt ? <span className="text-xs text-muted-foreground">Saved</span> : null}</div></div>
          <MetadataList items={[
            { label: 'Shape', value: zone.geometryType === 'circle' ? 'Circle' : 'Polygon' },
            zone.geometryType === 'circle' ? { label: 'Radius', value: `${zone.radiusMeters?.toLocaleString()} m` } : { label: 'Points', value: zone.polygonCoordinates?.length ?? 0 },
            { label: 'Alerts', value: [zone.notifyOnEnter && 'entry', zone.notifyOnExit && 'exit'].filter(Boolean).join(' and ') || 'recorded only' },
          ]} />
          {booking.canManageMonitoringZones && zone.scope === "custom" && zone.id ? <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { setEditing(zone); setEditorOpen(true); }}><Pencil size={13} />Edit</Button><Button type="button" size="sm" variant="outline" onClick={() => setDeleting(zone)}><Trash2 size={13} />Remove</Button></div> : null}
        </div>)}
        <div className="space-y-2 border-t border-border pt-3"><p className="text-xs font-semibold text-foreground">Recent zone activity</p>
          {(booking.geofenceActivity ?? []).length === 0 ? <p className="text-xs text-muted-foreground">No crossings recorded.</p> : null}
          {(booking.geofenceActivity ?? []).map((event) => <div key={event.id} className="rounded-xl bg-background p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-foreground">{event.type === "geofence_enter" ? "Entered" : "Exited"} {event.zoneName}</p>{event.notificationRequested ? <Badge variant="outline">Alert</Badge> : null}</div>
            <p className="mt-1 text-muted-foreground">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(event.occurredAt))}</p>
          </div>)}
        </div>
      </CardContent>
    </Card>
    <GeofenceTemplateDialog key={editing?.id ?? "new-booking-zone"} bookingId={booking.backendId} open={editorOpen} onOpenChange={setEditorOpen} record={editing?.id ? { ...editing, id: editing.id } : undefined} onSaved={() => void refresh()} />
    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Remove Booking Zone?</AlertDialogTitle><AlertDialogDescription>Remove “{deleting?.name}” from this booking. Default zones remain enabled.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>Keep Zone</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy} onClick={(event) => { event.preventDefault(); void remove(); }}>{busy ? "Removing..." : "Remove"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </>;
}
