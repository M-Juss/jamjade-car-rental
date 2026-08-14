"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MaintenanceModule } from "@/features/maintenance/MaintenanceModule";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Fuel,
  Gauge,
  History,
  Palette,
  RefreshCw,
  Settings2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VehicleImageGallery } from "@/components/common/VehicleImageGallery";
import { VehicleConditionSnapshot } from "@/components/vehicle-inspection";
import { InitialConditionDialog } from "@/forms/vehicle/InitialConditionDialog";
import { UpdateConditionDialog } from "@/forms/vehicle/UpdateConditionDialog";
import { getAuthenticatedUser } from "@/services/auth";
import {
  getCurrentVehicleCondition,
  getVehicle,
  getVehicleInspection,
  getVehicleInspectionHistory,
  type VehicleInspectionRecord,
  type VehicleRecord,
} from "@/services/vehicle";

const statusStyle: Record<string, string> = {
  Available: "bg-success-surface text-success border-success-border",
  Rented: "bg-muted text-primary border-border",
  Maintenance: "bg-warning-surface text-warning border-warning-border",
  Unavailable: "bg-background text-muted-foreground border-border",
};

function getStatusLabel(vehicle: VehicleRecord) {
  return vehicle.statusLabel ?? vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1);
}

function formatDate(value?: string | null) {
  if (!value) return "Not finalized";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function inspectionLabel(inspection: VehicleInspectionRecord) {
  const label = inspection.typeLabel ?? inspection.type.charAt(0).toUpperCase() + inspection.type.slice(1);
  return inspection.booking?.reference ? `${label} · ${inspection.booking.reference}` : `${label} Inspection`;
}

export type VehicleDetailsSection = "general" | "condition" | "maintenance";

export function VehicleDetailsPage({ section = "general" }: { section?: VehicleDetailsSection }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ vehicleId: string }>();
  const vehicleId = params?.vehicleId;
  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [currentCondition, setCurrentCondition] = useState<VehicleInspectionRecord | null>(null);
  const [history, setHistory] = useState<VehicleInspectionRecord[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<VehicleInspectionRecord | null>(null);
  const [personnelName, setPersonnelName] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isInspectionLoading, setIsInspectionLoading] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const maintenanceRecordId = searchParams.get("maintenanceRecord") ?? undefined;
  const [error, setError] = useState<string | null>(null);

  const fetchVehicleData = useCallback(async () => {
    if (!vehicleId) return null;
    return Promise.all([
        getVehicle(vehicleId),
        getCurrentVehicleCondition(vehicleId),
        getVehicleInspectionHistory(vehicleId),
        getAuthenticatedUser(),
      ]);
  }, [vehicleId]);

  const loadVehicleData = useCallback(async () => {
    try {
      const records = await fetchVehicleData();
      if (!records) return;
      const [vehicleRecord, conditionRecord, historyRecords, auth] = records;
      setVehicle(vehicleRecord);
      setError(null);
      setCurrentCondition(conditionRecord);
      setHistory(historyRecords);
      setPersonnelName(auth.user.name);
      setSelectedInspection(null);
    } catch {
      setError("Unable to load vehicle details.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchVehicleData]);

  useEffect(() => {
    let ignore = false;

    async function initialLoad() {
      try {
        const records = await fetchVehicleData();
        if (!records || ignore) return;
        const [vehicleRecord, conditionRecord, historyRecords, auth] = records;
        setVehicle(vehicleRecord);
        setCurrentCondition(conditionRecord);
        setHistory(historyRecords);
        setPersonnelName(auth.user.name);
        setSelectedInspection(null);
        setError(null);
      } catch {
        if (!ignore) setError("Unable to load vehicle details.");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    void initialLoad();
    return () => {
      ignore = true;
    };
  }, [fetchVehicleData]);

  const openInspection = async (inspectionId: string) => {
    if (!vehicleId) return;
    try {
      setIsInspectionLoading(true);
      setSelectedInspection(await getVehicleInspection(vehicleId, inspectionId));
    } finally {
      setIsInspectionLoading(false);
    }
  };

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay },
  });

  if (isLoading) {
    return <div className="min-h-screen bg-background p-8 text-center text-sm text-muted-foreground">Loading vehicle...</div>;
  }

  if (error || !vehicle || !vehicleId) {
    return <div className="min-h-screen bg-background p-8 text-center text-sm text-destructive">{error ?? "Vehicle not found."}</div>;
  }

  const heroImage = vehicle.image ?? vehicle.images[0] ?? null;
  const displayedInspection = selectedInspection ?? currentCondition;

  return (
    <div className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
      <motion.div {...fadeUp(0)} className="flex items-center gap-2">
        <button onClick={() => router.push("/owner/vehicle")} className="group flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary">
          <ChevronLeft size={15} className="transition-transform group-hover:-translate-x-0.5" /> Vehicle Management
        </button>
        <span className="text-border">/</span><span className="text-xs font-semibold text-foreground">{vehicle.name}</span>
      </motion.div>

      <motion.div {...fadeUp(0.05)}>
        <Card className="overflow-hidden rounded-2xl border-0 bg-surface shadow-sm">
          <CardContent className="relative p-5 pr-32 md:p-6 md:pr-48">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-background shadow-inner">
                {heroImage ? <div role="img" aria-label={vehicle.name} className="h-full w-full" style={{ background: `center / cover no-repeat url("${heroImage}")` }} /> : "🚗"}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-foreground">{vehicle.name}</h1>
                <div className="mt-2 grid gap-1.5">
                  <p className="flex items-center gap-2 text-xs">
                    <span className="w-11 text-[10px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">Brand</span>
                    <span className="rounded-md bg-muted px-2 py-0.5 font-semibold text-primary">{vehicle.brand}</span>
                  </p>
                  <p className="flex items-center gap-2 text-xs">
                    <span className="w-11 text-[10px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">Model</span>
                    <span className="rounded-md bg-background px-2 py-0.5 font-semibold text-foreground">{vehicle.model}</span>
                  </p>
                </div>
              </div>
            </div>
            <span className={`absolute right-5 top-5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold md:right-6 md:top-6 ${statusStyle[getStatusLabel(vehicle)] ?? statusStyle.Unavailable}`}>{getStatusLabel(vehicle)}</span>
            <p className="absolute bottom-5 right-5 text-xl font-bold text-primary md:bottom-6 md:right-6">₱{vehicle.pricePerDay.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">/ day</span></p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.nav {...fadeUp(0.08)} aria-label="Vehicle detail sections" className="grid grid-cols-1 gap-1 rounded-2xl border border-border bg-surface p-1 shadow-sm sm:grid-cols-3">
        <Link
          href={`/owner/vehicle/${vehicleId}`}
          className={`rounded-xl px-3 py-2.5 text-center text-xs font-bold transition-colors ${section === "general" ? "bg-muted text-primary" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}
          aria-current={section === "general" ? "page" : undefined}
        >
          General Information
        </Link>
        <Link
          href={`/owner/vehicle/${vehicleId}/condition`}
          className={`rounded-xl px-3 py-2.5 text-center text-xs font-bold transition-colors ${section === "condition" ? "bg-muted text-primary" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}
          aria-current={section === "condition" ? "page" : undefined}
        >
          Vehicle Condition
        </Link>
        <Link
          href={`/owner/vehicle/${vehicleId}/maintenance`}
          className={`rounded-xl px-3 py-2.5 text-center text-xs font-bold transition-colors ${section === "maintenance" ? "bg-muted text-primary" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}
          aria-current={section === "maintenance" ? "page" : undefined}
        >
          Maintenance
        </Link>
      </motion.nav>

      {section === "maintenance" && <MaintenanceModule fixedVehicleId={vehicleId} compact />}

      {section !== "maintenance" && <motion.div {...fadeUp(0.1)} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {section === "general" && (
            <>
          {vehicle.description && (
            <Card className="rounded-2xl border-0 bg-surface shadow-sm"><CardHeader className="pb-1"><CardTitle className="flex items-center gap-2 text-sm"><FileText size={15} className="text-primary" /> Description</CardTitle></CardHeader><CardContent><p className="text-xs leading-6 text-muted-foreground">{vehicle.description}</p></CardContent></Card>
          )}

          <Card className="rounded-2xl border-0 bg-surface shadow-sm">
            <CardHeader className="pb-1"><CardTitle className="flex items-center gap-2 text-sm"><Settings2 size={15} className="text-primary" /> Specifications</CardTitle></CardHeader>
            <CardContent><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Users, label: "Seats", value: `${vehicle.seats} seats` },
                { icon: Settings2, label: "Transmission", value: vehicle.transmission },
                { icon: Fuel, label: "Fuel Type", value: vehicle.fuelType },
                { icon: Palette, label: "Color", value: vehicle.color ?? "Not set" },
              ].map(({ icon: Icon, label, value }) => <div key={label} className="rounded-xl bg-background p-3"><Icon size={15} className="mb-2 text-primary" /><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-0.5 text-xs font-semibold text-foreground">{value}</p></div>)}
            </div></CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-surface shadow-sm"><CardHeader className="pb-1"><CardTitle className="flex items-center gap-2 text-sm"><CheckCircle2 size={15} className="text-primary" /> Features</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{vehicle.features.map((feature) => <span key={feature} className="rounded-xl border border-border bg-muted px-3 py-1.5 text-xs font-medium text-primary">{feature}</span>)}</div></CardContent></Card>

          <Card className="rounded-2xl border-0 bg-surface shadow-sm"><CardHeader className="pb-1"><CardTitle className="text-sm">Image Gallery</CardTitle></CardHeader><CardContent>{vehicle.images.length ? <VehicleImageGallery images={vehicle.images} alt={vehicle.name} /> : <p className="text-xs text-muted-foreground">No images uploaded.</p>}</CardContent></Card>
            </>
          )}

          {section === "condition" && <Card className="rounded-2xl border-0 bg-surface shadow-sm">
            <CardHeader className="flex flex-col items-stretch justify-between gap-3 pb-3 sm:flex-row sm:items-start">
              <div><CardTitle className="flex items-center gap-2 text-sm"><ClipboardCheck size={16} className="text-primary" /> {selectedInspection ? inspectionLabel(selectedInspection) : "Current Condition"}</CardTitle>{selectedInspection && <button type="button" className="mt-2 text-xs font-semibold text-primary" onClick={() => setSelectedInspection(null)}>Return to current condition</button>}</div>
              {currentCondition && (
                <Button
                  size="sm"
                  className="w-full shrink-0 sm:w-auto"
                  disabled={vehicle.canUpdateCurrentCondition === false}
                  onClick={() => setUpdateOpen(true)}
                >
                  <RefreshCw size={14} /> Update Current Condition
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {currentCondition && vehicle.canUpdateCurrentCondition === false && (
                <div className="mb-4 rounded-xl border border-warning-border bg-warning-surface px-3 py-2.5 text-xs font-medium text-warning">
                  {vehicle.conditionUpdateBlockedReason ?? "Current condition cannot be updated while this vehicle has an ongoing rental."}
                </div>
              )}
              {isInspectionLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading inspection...</p> : displayedInspection ? (
                <VehicleConditionSnapshot inspection={displayedInspection} />
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-background p-8 text-center">
                  <ClipboardCheck className="mx-auto text-primary" size={28} />
                  <h2 className="mt-3 text-sm font-bold text-foreground">Initial vehicle condition has not been configured yet.</h2>
                  <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-muted-foreground">Create and sign the initial snapshot without recreating or editing the vehicle.</p>
                  <Button className="mt-4" onClick={() => setSetupOpen(true)}>Set Initial Condition</Button>
                </div>
              )}
            </CardContent>
          </Card>}
        </div>

        <aside>
          {section === "general" ? (
            <Card className="sticky top-5 rounded-2xl border-0 bg-surface shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ClipboardCheck size={16} className="text-primary" /> Current Condition</CardTitle></CardHeader>
              <CardContent>
                {currentCondition ? (
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-background p-3"><Gauge size={15} className="mb-2 text-primary" /><p className="text-[11px] text-muted-foreground">Odometer</p><p className="mt-0.5 text-xs font-bold text-foreground">{currentCondition.odometer.toLocaleString()} km</p></div>
                      <div className="rounded-xl bg-background p-3"><Fuel size={15} className="mb-2 text-primary" /><p className="text-[11px] text-muted-foreground">Fuel</p><p className="mt-0.5 text-xs font-bold text-foreground">{currentCondition.fuelLevel}/8</p></div>
                    </div>
                    <p className="text-[11px] leading-5 text-muted-foreground">{currentCondition.markers?.length ?? 0} body issue{currentCondition.markers?.length === 1 ? "" : "s"} · Finalized {formatDate(currentCondition.finalizedAt)}</p>
                    <Link href={`/owner/vehicle/${vehicleId}/condition`} className="rounded-xl bg-primary px-3 py-2.5 text-center text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90">View Full Condition</Link>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-background p-4 text-center">
                    <p className="text-xs leading-5 text-muted-foreground">No initial condition snapshot has been configured.</p>
                    <Link href={`/owner/vehicle/${vehicleId}/condition`} className="mt-3 inline-flex rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90">Set Initial Condition</Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
          <Card className="sticky top-5 rounded-2xl border-0 bg-surface shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><History size={16} className="text-primary" /> Inspection History</CardTitle></CardHeader>
            <CardContent>
              {history.length ? <div className="grid gap-2">{history.map((inspection) => (
                <button key={inspection.id} type="button" className={`rounded-xl border p-3 text-left transition-colors ${selectedInspection?.id === inspection.id ? "border-primary bg-muted" : "border-border bg-background hover:border-primary/50"}`} onClick={() => void openInspection(inspection.id)}>
                  <p className="text-xs font-bold text-foreground">{inspectionLabel(inspection)}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarClock size={12} /> {formatDate(inspection.finalizedAt)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{inspection.creator?.name ?? "Unknown inspector"} · {inspection.status}</p>
                </button>
              ))}</div> : <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No finalized inspections yet.</p>}
            </CardContent>
          </Card>
          )}
        </aside>
      </motion.div>}

      <InitialConditionDialog open={setupOpen} onOpenChange={setSetupOpen} vehicleId={vehicleId} personnelName={personnelName} onSaved={loadVehicleData} />
      {currentCondition && (
        <UpdateConditionDialog
          open={updateOpen || (section === "condition" && Boolean(maintenanceRecordId))}
          onOpenChange={(open) => {
            setUpdateOpen(open);
            if (!open && maintenanceRecordId) router.replace(`/owner/vehicle/${vehicleId}/condition`);
          }}
          vehicleId={vehicleId}
          currentCondition={currentCondition}
          personnelName={personnelName}
          onSaved={loadVehicleData}
          maintenanceRecordId={maintenanceRecordId}
        />
      )}
    </div>
  );
}

export default function VehicleDetails() {
  return <VehicleDetailsPage />;
}
