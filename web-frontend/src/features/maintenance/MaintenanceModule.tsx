"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  Gauge,
  Loader2,
  Plus,
  Search,
  Settings,
  Wrench,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/common/KpiCard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MaintenanceLifecycleDialog,
} from "@/forms/maintenance/MaintenanceLifecycleDialog";
import { MaintenancePlanDialog } from "@/forms/maintenance/MaintenancePlanDialog";
import {
  ScheduleMaintenanceDialog,
} from "@/forms/maintenance/ScheduleMaintenanceDialog";
import { appToast } from "@/lib/toast";
import {
  cancelMaintenance,
  deactivateMaintenancePlan,
  getMaintenancePlans,
  getMaintenanceRecords,
  getMaintenanceSummary,
  getMaintenanceVehicles,
  type MaintenancePlan,
  type MaintenanceRecord,
  type MaintenanceStatus,
  type MaintenanceSummary,
} from "@/services/maintenance";
import type { VehicleRecord } from "@/services/vehicle";
import {
  DueMaintenanceTable,
  MaintenanceRecordsTable,
  VehiclePlansTable,
} from "./components/MaintenanceTables";

type ConfirmationTarget =
  | { type: "cancel"; record: MaintenanceRecord }
  | { type: "deactivate"; plan: MaintenancePlan };

type MaintenanceModuleProps = {
  fixedVehicleId?: string;
  compact?: boolean;
};

export function MaintenanceModule({
  fixedVehicleId,
  compact = false,
}: MaintenanceModuleProps) {
  const router = useRouter();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [summary, setSummary] = useState<MaintenanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "due" | MaintenanceStatus>("all");
  const [planOpen, setPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MaintenancePlan>();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [initialPlanId, setInitialPlanId] = useState<string>();
  const [lifecycle, setLifecycle] = useState<{
    record: MaintenanceRecord;
    mode: "start" | "complete";
  } | null>(null);
  const [confirmationTarget, setConfirmationTarget] = useState<ConfirmationTarget | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [nextRecords, nextPlans, nextVehicles, nextSummary] = await Promise.all([
        getMaintenanceRecords(fixedVehicleId),
        getMaintenancePlans(fixedVehicleId),
        getMaintenanceVehicles(),
        getMaintenanceSummary(),
      ]);

      setRecords(nextRecords);
      setPlans(nextPlans);
      setVehicles(nextVehicles);
      setSummary(nextSummary);
    } catch {
      setError("Maintenance information could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fixedVehicleId]);

  useEffect(() => {
    async function loadMaintenance() {
      await load();
    }

    void loadMaintenance();
  }, [load]);

  const filteredRecords = useMemo(() => records.filter((record) => {
    const matchesStatus = tab === "all" || record.status === tab;
    const matchesSearch = `${record.vehicle?.name} ${record.title}`
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesStatus && matchesSearch;
  }), [records, search, tab]);

  const duePlans = useMemo(() => plans.filter((plan) => (
    ["due_soon", "due", "overdue"].includes(plan.dueStatus)
    && `${plan.vehicle?.name} ${plan.name}`.toLowerCase().includes(search.toLowerCase())
  )), [plans, search]);

  const summaryItems = [
    {
      label: "Due Soon",
      value: fixedVehicleId
        ? plans.filter((plan) => plan.dueStatus === "due_soon").length
        : summary?.dueSoon,
      icon: Gauge,
      iconClassName: "bg-warning-surface text-warning",
    },
    {
      label: "Overdue",
      value: fixedVehicleId
        ? plans.filter((plan) => plan.dueStatus === "overdue").length
        : summary?.overdue,
      icon: AlertCircle,
      iconClassName: "bg-destructive-surface text-destructive",
    },
    {
      label: "Scheduled",
      value: fixedVehicleId
        ? records.filter((record) => record.status === "scheduled").length
        : summary?.scheduled,
      icon: CalendarClock,
      iconClassName: "bg-muted text-primary",
    },
    {
      label: "In Progress",
      value: fixedVehicleId
        ? records.filter((record) => record.status === "in_progress").length
        : summary?.inProgress,
      icon: Wrench,
      iconClassName: "bg-success-surface text-success",
    },
  ];

  const openSchedule = (planId?: string) => {
    setInitialPlanId(planId);
    setScheduleOpen(true);
  };

  const confirmAction = async () => {
    if (!confirmationTarget) return;

    try {
      setIsConfirming(true);

      if (confirmationTarget.type === "cancel") {
        await cancelMaintenance(confirmationTarget.record.id);
        appToast.success(
          "Maintenance schedule cancelled successfully. The selected dates are available again.",
        );
      } else {
        await deactivateMaintenancePlan(confirmationTarget.plan.id);
        appToast.success("Maintenance plan deactivated successfully.");
      }

      setConfirmationTarget(null);
      await load();
    } catch {
      appToast.error(
        confirmationTarget.type === "cancel"
          ? "The maintenance schedule could not be cancelled. Please try again."
          : "The maintenance plan could not be deactivated. Please try again.",
      );
    } finally {
      setIsConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading maintenance
      </div>
    );
  }

  return (
    <section className={compact
      ? "space-y-4"
      : "min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8"}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={compact
            ? "text-lg font-bold text-foreground"
            : "text-2xl font-bold tracking-tight text-foreground"}
          >
            {compact ? "Vehicle Maintenance" : "Maintenance Management"}
          </h1>
          <p className={compact
            ? "mt-1 text-xs text-muted-foreground"
            : "mt-0.5 text-sm text-muted-foreground"}
          >
            Plans inform staff. Only manually scheduled records block bookings.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditingPlan(undefined);
              setPlanOpen(true);
            }}
          >
            <Settings size={15} />
            Add Plan
          </Button>
          <Button type="button" onClick={() => openSchedule()}>
            <Plus size={15} />
            Schedule Maintenance
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="rounded-2xl border border-destructive-border bg-destructive-surface shadow-none">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle size={16} />
              {error}
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summaryItems.map(({ label, value, icon, iconClassName }) => (
          <KpiCard
            key={label}
            label={label}
            value={value ?? 0}
            icon={icon}
            iconClassName={iconClassName}
          />
        ))}
      </div>

      {fixedVehicleId ? (
        <VehiclePlansTable
          plans={plans}
          onSchedule={openSchedule}
          onEdit={(plan) => {
            setEditingPlan(plan);
            setPlanOpen(true);
          }}
          onDeactivate={(plan) => setConfirmationTarget({ type: "deactivate", plan })}
        />
      ) : null}

      <Card className="rounded-2xl border-0 bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
        <CardContent className="p-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative min-w-[180px] flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle-foreground" />
              <Input
                className="h-9 rounded-xl border-border bg-background pl-8 text-[12.5px] focus-visible:ring-1 focus-visible:ring-primary"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search maintenance..."
                aria-label="Search maintenance"
              />
            </div>
            <Select value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
              <SelectTrigger className="h-9 w-full rounded-xl border-border bg-background text-[12.5px] sm:w-[170px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="due">Due / Overdue</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {tab === "due" ? (
        <DueMaintenanceTable plans={duePlans} onSchedule={openSchedule} />
      ) : (
        <MaintenanceRecordsTable
          records={filteredRecords}
          onStart={(record) => setLifecycle({ record, mode: "start" })}
          onComplete={(record) => setLifecycle({ record, mode: "complete" })}
          onCancel={(record) => setConfirmationTarget({ type: "cancel", record })}
          onCondition={(record) => router.push(
            `/owner/vehicle/${record.vehicleId}/condition?maintenanceRecord=${record.id}`,
          )}
        />
      )}

      <MaintenancePlanDialog
        open={planOpen}
        onOpenChange={(open) => {
          setPlanOpen(open);
          if (!open) setEditingPlan(undefined);
        }}
        vehicles={vehicles}
        fixedVehicleId={fixedVehicleId}
        editingPlan={editingPlan}
        onSaved={() => void load()}
      />
      <ScheduleMaintenanceDialog
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open);
          if (!open) setInitialPlanId(undefined);
        }}
        vehicles={vehicles}
        plans={plans}
        fixedVehicleId={fixedVehicleId}
        initialPlanId={initialPlanId}
        onSaved={() => void load()}
      />
      <MaintenanceLifecycleDialog
        record={lifecycle?.record ?? null}
        mode={lifecycle?.mode ?? null}
        onOpenChange={() => setLifecycle(null)}
        onSaved={() => void load()}
      />

      <AlertDialog
        open={Boolean(confirmationTarget)}
        onOpenChange={(open) => {
          if (!open && !isConfirming) setConfirmationTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-[420px] rounded-2xl border-0 shadow-[0_24px_64px_rgba(0,0,0,0.13)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmationTarget?.type === "cancel"
                ? "Cancel Maintenance Schedule?"
                : "Deactivate Maintenance Plan?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationTarget?.type === "cancel"
                ? `Cancel “${confirmationTarget.record.title}”? Its future calendar block will be released.`
                : `Deactivate “${confirmationTarget?.plan.name}”? It will no longer appear as an active maintenance plan.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>Keep It</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isConfirming}
              onClick={(event) => {
                event.preventDefault();
                void confirmAction();
              }}
            >
              {isConfirming
                ? "Updating..."
                : confirmationTarget?.type === "cancel"
                  ? "Cancel Schedule"
                  : "Deactivate Plan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
