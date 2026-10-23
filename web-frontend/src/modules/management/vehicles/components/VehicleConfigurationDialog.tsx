"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Car, CheckSquare, ChevronRight, Fuel, ListChecks, Pencil, Plus, RotateCcw, Settings2, Tag, Trash2, XCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { TableActionMenu } from "@/components/common/tables/TableActionMenu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { VehicleOptionForm } from "@/forms/vehicle/configuration/VehicleOptionForm";
import { getVehicleConfiguration, removeVehicleOption, saveVehicleOption, type VehicleConfigurationOption, type VehicleOptionSection } from "@/services/vehicle/configuration.service";
import { ApiError } from "@/services/http";
import { appToast } from "@/lib/toast";

const cards = [
  { key: "brand", title: "Brands", singular: "Brand", icon: Tag },
  { key: "feature", title: "Features", singular: "Feature", icon: CheckSquare },
  { key: "transmission", title: "Transmissions", singular: "Transmission", icon: Settings2 },
  { key: "fuel_type", title: "Fuel Types", singular: "Fuel Type", icon: Fuel },
  { key: "exterior", title: "Exterior Checklist", singular: "Exterior Item", icon: ListChecks },
  { key: "interior", title: "Interior Checklist", singular: "Interior Item", icon: ListChecks },
  { key: "equipment", title: "Equipment / Tools", singular: "Equipment / Tool", icon: ListChecks },
] as const;
type CardKey = (typeof cards)[number]["key"];

export function VehicleConfigurationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [options, setOptions] = useState<VehicleConfigurationOption[]>([]);
  const [selected, setSelected] = useState<CardKey | null>(null);
  const [editor, setEditor] = useState<VehicleConfigurationOption | "new" | null>(null);
  const [target, setTarget] = useState<VehicleConfigurationOption | null>(null);
  const [searches, setSearches] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const scrollPositions = useRef<Record<string, number>>({});
  const load = useCallback(async () => {
    const records = await getVehicleConfiguration();
    setOptions(records);
    setError(null);
  }, []);
  useEffect(() => {
    if (!open) return;
    let active = true;
    getVehicleConfiguration().then((records) => { if (active) { setOptions(records); setError(null); } })
      .catch(() => { if (active) setError("Unable to load configuration."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open]);
  const card = cards.find((item) => item.key === selected);
  const section: VehicleOptionSection = selected ?? "brand";
  const search = searches[section] ?? "";
  useEffect(() => {
    if (!editor && body.current) body.current.scrollTop = scrollPositions.current[section] ?? 0;
  }, [editor, section]);
  const close = () => {
    if (busy) return;
    onOpenChange(false);
    setSelected(null); setEditor(null); setTarget(null); setLoading(true); setError(null);
  };
  const edit = (value: VehicleConfigurationOption | "new") => {
    if (body.current) scrollPositions.current[section] = body.current.scrollTop;
    setEditor(value);
  };
  const toggleActive = async (option: VehicleConfigurationOption) => {
    if (busy) return;
    setBusy(true);
    try {
      const saved = await saveVehicleOption(option.section, {
        name: option.name,
        is_active: !option.is_active,
      }, option.id);
      setOptions((current) => current.map((item) => item.id === saved.id ? saved : item));
      appToast.success(saved.is_active ? "Option activated." : "Option deactivated.");
    } catch (failure) {
      const message = failure instanceof ApiError
        ? Object.values(failure.errors ?? {}).flat()[0] ?? failure.message
        : "Unable to change the option status.";
      appToast.error(message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await removeVehicleOption(target.id);
      setOptions((current) => target.in_use ? current.map((option) => option.id === target.id ? { ...option, is_active: false } : option) : current.filter((option) => option.id !== target.id));
      setTarget(null);
      await load().catch(() => setError("Unable to refresh configuration."));
      appToast.success(target.in_use ? "Option deactivated." : "Option deleted.");
    } catch (failure) {
      const message = failure instanceof ApiError ? Object.values(failure.errors ?? {}).flat()[0] ?? failure.message : "Unable to remove the option.";
      appToast.error(message);
    } finally { setBusy(false); }
  };
  const visible = options.filter((option) => option.section === section && option.name.toLowerCase().includes(search.toLowerCase()));
  return <>
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <FormDialogContent>
        <FormDialogHeader title={editor ? (editor === "new" ? "Add " : "Edit ") + card?.singular : card?.title ?? "Configure Vehicles"} icon={card?.icon ?? Car} onClose={close} closeDisabled={busy} closeLabel="Close vehicle configuration" />
        {editor ? <VehicleOptionForm section={section} option={editor === "new" ? undefined : editor} onBack={() => setEditor(null)} onBusyChange={setBusy}
          onSaved={async (saved) => { setOptions((current) => [...current.filter((option) => option.id !== saved.id), saved].sort((a, b) => a.id - b.id)); setEditor(null); await load().catch(() => setError("Unable to refresh configuration.")); }} /> : <>
          {selected ? <div className="flex shrink-0 flex-col gap-3 border-b border-border p-4 sm:px-6">
            <div className="flex items-center gap-3">
              <SearchInput ref={searchInput} value={search} onValueChange={(value) => setSearches((current) => ({ ...current, [section]: value }))} placeholder="Search options..." wrapperClassName="min-w-0 flex-1" />
              <Button type="button" onClick={() => edit("new")} disabled={loading || Boolean(error) || busy}><Plus size={15} />Add</Button>
            </div>
          </div> : null}
          <div ref={body} className="min-h-0 overflow-y-auto p-4 sm:p-6">
            {loading ? <p role="status" className="text-sm text-muted-foreground">Loading configuration...</p> : error ? <div role="alert" className="grid gap-3 text-sm text-destructive">{error}<Button variant="outline" onClick={() => { setLoading(true); void load().catch(() => setError("Unable to load configuration.")).finally(() => setLoading(false)); }}>Retry</Button></div> : !selected ? (
              <div className="grid gap-3 sm:grid-cols-2">{cards.map(({ key, title, icon: Icon }) => {
                const count = options.filter((option) => option.section === key).length;
                return <Card key={key} className={"gap-0 overflow-hidden py-0" + (key === "equipment" ? " md:col-span-2" : "")}>
                  <CardContent className="p-0"><button type="button" onClick={() => setSelected(key)} className="flex min-h-24 w-full items-center gap-3 p-4 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary"><Icon size={18} /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-foreground">{title}</span><span className="text-xs text-muted-foreground">{count} options</span></span>
                    <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                  </button></CardContent>
                </Card>;
              })}</div>
            ) : visible.length ? <div className="divide-y divide-border rounded-xl border border-border">
              {visible.map((option) => <div key={option.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 break-words text-sm font-medium text-foreground">{option.name}</span>
                <Badge variant="outline" className={"rounded-md px-2 py-1 text-xs font-semibold " + (option.is_active ? "border-success-border bg-success-surface text-success" : "border-border bg-muted text-muted-foreground")}>
                  {option.is_active ? "Active" : "Inactive"}
                </Badge>
                <TableActionMenu label={"Actions for " + option.name} items={[
                  { label: "Edit", icon: <Pencil size={14} />, disabled: busy, onClick: () => edit(option) },
                  { label: option.is_active ? "Deactivate" : "Activate", icon: option.is_active ? <XCircle size={14} /> : <RotateCcw size={14} />, disabled: busy, onClick: () => void toggleActive(option) },
                  ...(!option.in_use ? [{ label: "Delete", icon: <Trash2 size={14} />, variant: "danger" as const, separatorBefore: true, disabled: busy, onClick: () => setTarget(option) }] : []),
                ]} />
              </div>)}
            </div> : <p className="py-6 text-center text-sm text-muted-foreground">No options found.</p>}
          </div>
          <FormDialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={selected ? () => { setSelected(null); setError(null); } : close}>{selected ? "Back" : "Close"}</Button>
          </FormDialogFooter>
        </>}
      </FormDialogContent>
    </Dialog>
    <AlertDialog open={Boolean(target)} onOpenChange={(next) => { if (!next && !busy) setTarget(null); }}>
      <AlertDialogContent onCloseAutoFocus={(event) => { event.preventDefault(); searchInput.current?.focus({ preventScroll: true }); }}>
        <AlertDialogHeader><AlertDialogTitle>{target?.in_use ? "Deactivate" : "Delete"} {target?.name}?</AlertDialogTitle>
          <AlertDialogDescription>{target?.in_use ? "Existing records keep this value. It will no longer be offered for new selections." : "This unused option will be permanently deleted."}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy} onClick={(event) => { event.preventDefault(); void remove(); }}>{busy ? "Saving..." : target?.in_use ? "Deactivate" : "Delete"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
