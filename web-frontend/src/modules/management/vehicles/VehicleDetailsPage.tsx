"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { tabListClassName, tabTriggerClassName } from "@/components/ui/tab-styles";
import Image from "next/image";
import { VehicleMaintenanceHistory } from "@/modules/management/maintenance/VehicleMaintenanceHistory";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import { VehicleImageGallery } from "@/modules/management/vehicles/components/VehicleImageGallery";
import { VehicleConditionSnapshot } from "@/modules/management/vehicles/inspection";
import { InitialConditionDialog } from "@/forms/vehicle/condition/InitialConditionDialog";
import { UpdateConditionDialog } from "@/forms/vehicle/condition/UpdateConditionDialog";
import { getAuthenticatedUser } from "@/services/auth";
import {
  getCurrentVehicleCondition,
  getVehicle,
  getVehicleInspection,
  getVehicleInspectionHistory,
  type VehicleInspectionRecord,
  type VehicleRecord,
} from "@/services/vehicle";
import { managementPath } from "@/modules/management/shell/config/module-registry";
import { useManagementPortal } from "@/modules/management/shell/context/ManagementSessionProvider";

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
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value));
}

function inspectionLabel(inspection: VehicleInspectionRecord) {
  const label = inspection.typeLabel ?? inspection.type.charAt(0).toUpperCase() + inspection.type.slice(1);
  return <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span>{label} Inspection</span>{inspection.booking?.reference ? <span className="text-xs font-normal text-muted-foreground">{inspection.booking.reference}</span> : null}</span>;
}

export type VehicleDetailsSection = "general" | "condition" | "maintenance";

export function VehicleDetailsPage({ section = "general" }: { section?: VehicleDetailsSection }) {
  const router = useRouter();
  const portal = useManagementPortal();
  const vehiclePath = managementPath(portal, "vehicles") ?? "/owner/vehicle";
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
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button onClick={() => router.push(vehiclePath)} className="group flex shrink-0 items-center gap-1.5 rounded-md p-1.5 -ml-1.5 text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <ChevronLeft size={15} className="transition-transform group-hover:-translate-x-0.5" /> Vehicle Management
        </button>
        <span className="text-border">/</span><span className="min-w-0 text-xs font-semibold text-foreground">{vehicle.name}</span>
      </div>

      <Card className="border-border bg-surface py-3 shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex size-16 shrink-0 items-center justify-center">
              {heroImage ? (
                <Image
                  src={heroImage}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-contain"
                />
              ) : (
                <span aria-hidden="true">🚗</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-baseline gap-x-2 text-lg font-semibold text-foreground">
                <span className="break-words">{vehicle.name}</span>
                <span aria-hidden="true" className="text-border">|</span>
                <span className="break-words text-sm font-semibold">
                  {vehicle.plateNumber ? <><span className="sr-only">Plate number: </span>{vehicle.plateNumber}</> : "Plate unavailable"}
                </span>
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-muted-foreground">{[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${statusStyle[getStatusLabel(vehicle)] ?? statusStyle.Unavailable}`}>{getStatusLabel(vehicle)}</span>
            <p className="whitespace-nowrap text-lg font-semibold text-primary">₱{vehicle.pricePerDay.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">/ day</span></p>
          </div>
        </CardContent>
      </Card>

      <nav aria-label="Vehicle detail sections" className={tabListClassName}>
        <Link
          href={`${vehiclePath}/${vehicleId}`}
          className={tabTriggerClassName}
          aria-current={section === "general" ? "page" : undefined}
        >
          General Information
        </Link>
        <Link
          href={`${vehiclePath}/${vehicleId}/condition`}
          className={tabTriggerClassName}
          aria-current={section === "condition" ? "page" : undefined}
        >
          Vehicle Condition
        </Link>
        <Link
          href={`${vehiclePath}/${vehicleId}/maintenance`}
          className={tabTriggerClassName}
          aria-current={section === "maintenance" ? "page" : undefined}
        >
          Maintenance
        </Link>
      </nav>

      {section === "maintenance" && vehicleId && <VehicleMaintenanceHistory key={vehicleId} vehicleId={vehicleId} />}

      {section !== "maintenance" && <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {section === "general" && (
            <>
          {vehicle.description && (
            <Card className="rounded-2xl border border-border bg-surface shadow-none"><CardHeader className="pb-1"><CardTitle className="flex items-center gap-2 text-sm"><FileText size={15} className="text-primary" /> Description</CardTitle></CardHeader><CardContent><p className="text-xs leading-6 text-muted-foreground">{vehicle.description}</p></CardContent></Card>
          )}

          <Card className="rounded-2xl border border-border bg-surface shadow-none">
            <CardHeader className="pb-1"><CardTitle className="flex items-center gap-2 text-sm"><Settings2 size={15} className="text-primary" /> Specifications</CardTitle></CardHeader>
            <CardContent><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Users, label: "Seats", value: `${vehicle.seats} seats` },
                { icon: Settings2, label: "Transmission", value: vehicle.transmission },
                { icon: Fuel, label: "Fuel Type", value: vehicle.fuelType },
                { icon: Palette, label: "Color", value: vehicle.color ?? "Not set" },
              ].map(({ icon: Icon, label, value }) => <div key={label} className="rounded-xl bg-background p-3"><Icon size={15} className="mb-2 text-primary" /><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-xs font-semibold text-foreground">{value}</p></div>)}
            </div></CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-surface shadow-none"><CardHeader className="pb-1"><CardTitle className="flex items-center gap-2 text-sm"><CheckCircle2 size={15} className="text-primary" /> Features</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{vehicle.features.map((feature) => <span key={feature} className="min-w-0 max-w-full rounded-xl border border-border bg-muted px-3 py-1.5 text-xs font-medium text-primary">{feature}</span>)}</div></CardContent></Card>

          <Card className="rounded-2xl border border-border bg-surface shadow-none"><CardHeader className="pb-1"><CardTitle className="text-sm">Image Gallery</CardTitle></CardHeader><CardContent>{vehicle.images.length ? <VehicleImageGallery images={vehicle.images} alt={vehicle.name} /> : <p className="text-xs text-muted-foreground">No images uploaded.</p>}</CardContent></Card>
            </>
          )}

          {section === "condition" && <Card className="rounded-2xl border border-border bg-surface shadow-none">
            <CardHeader className="flex flex-col items-stretch justify-between gap-3 pb-3 sm:flex-row sm:items-start">
              <div><CardTitle className="flex items-center gap-2 text-sm"><ClipboardCheck size={16} className="text-primary" /> {selectedInspection ? inspectionLabel(selectedInspection) : "Current Condition"}</CardTitle>{selectedInspection && <button type="button" className="mt-2 inline-flex rounded-md py-2 pr-2 text-xs font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => setSelectedInspection(null)}>Return to current condition</button>}</div>
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
                  <h2 className="mt-3 text-sm font-semibold text-foreground">No initial condition recorded.</h2>
                  <Button className="mt-4" onClick={() => setSetupOpen(true)}>Set Initial Condition</Button>
                </div>
              )}
            </CardContent>
          </Card>}
        </div>

        <aside className="min-w-0">
          {section === "general" ? (
            <Card className="sticky top-5 rounded-2xl border border-border bg-surface shadow-none">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ClipboardCheck size={16} className="text-primary" /> Current Condition</CardTitle></CardHeader>
              <CardContent>
                {currentCondition ? (
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-background p-3"><Gauge size={15} className="mb-2 text-primary" /><p className="text-xs text-muted-foreground">Odometer</p><p className="mt-0.5 text-xs font-semibold text-foreground">{currentCondition.odometer.toLocaleString()} km</p></div>
                      <div className="rounded-xl bg-background p-3"><Fuel size={15} className="mb-2 text-primary" /><p className="text-xs text-muted-foreground">Fuel</p><p className="mt-0.5 text-xs font-semibold text-foreground">{currentCondition.fuelLevel}/8</p></div>
                    </div>
                    <div className="space-y-1 text-xs leading-5 text-muted-foreground"><p>{currentCondition.markers?.length ?? 0} body issue{currentCondition.markers?.length === 1 ? "" : "s"}</p><p>Finalized {formatDate(currentCondition.finalizedAt)}</p></div>
                    <Link href={`${vehiclePath}/${vehicleId}/condition`} className="rounded-xl bg-primary px-3 py-2.5 text-center text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">View Full Condition</Link>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-background p-4 text-center">
                    <p className="text-xs leading-5 text-muted-foreground">No initial condition recorded.</p>
                    <Link href={`${vehiclePath}/${vehicleId}/condition`} className="mt-3 inline-flex rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">Set Initial Condition</Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
          <Card className="sticky top-5 rounded-2xl border border-border bg-surface shadow-none">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><History size={16} className="text-primary" /> Inspection History</CardTitle></CardHeader>
            <CardContent>
              {history.length ? <div className="grid gap-2">{history.map((inspection) => (
                <button key={inspection.id} type="button" className={`rounded-xl border p-3 text-left transition-colors ${selectedInspection?.id === inspection.id ? "border-primary bg-muted" : "border-border bg-background hover:border-primary/50"}`} onClick={() => void openInspection(inspection.id)}>
                  <p className="text-xs font-semibold text-foreground">{inspectionLabel(inspection)}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock size={12} /> {formatDate(inspection.finalizedAt)}</p>
                  <span className="mt-1 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{inspection.creator?.name ?? "Unknown inspector"}</span><span>{inspection.status}</span></span>
                </button>
              ))}</div> : <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No finalized inspections yet.</p>}
            </CardContent>
          </Card>
          )}
        </aside>
      </div>}

      <InitialConditionDialog open={setupOpen} onOpenChange={setSetupOpen} vehicleId={vehicleId} personnelName={personnelName} onSaved={loadVehicleData} />
      {currentCondition && (
        <UpdateConditionDialog
          open={updateOpen || (section === "condition" && Boolean(maintenanceRecordId))}
          onOpenChange={(open) => {
            setUpdateOpen(open);
            if (!open && maintenanceRecordId) router.replace(`${vehiclePath}/${vehicleId}/condition`);
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
