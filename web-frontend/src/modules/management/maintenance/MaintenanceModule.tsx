"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock, Gauge, Loader2, Plus, Settings, Wrench } from "lucide-react";
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
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { CancelMaintenanceDialog } from "@/forms/maintenance/records/CancelMaintenanceDialog";
import { MaintenanceLifecycleDialog } from "@/forms/maintenance/records/MaintenanceLifecycleDialog";
import { MaintenancePlanDialog } from "@/forms/maintenance/plans/MaintenancePlanDialog";
import { RescheduleMaintenanceDialog } from "@/forms/maintenance/records/RescheduleMaintenanceDialog";
import { ScheduleMaintenanceDialog } from "@/forms/maintenance/records/ScheduleMaintenanceDialog";
import { UpdateConditionDialog } from "@/forms/vehicle/condition/UpdateConditionDialog";
import { appToast } from "@/lib/toast";
import { getAuthenticatedUser } from "@/services/auth";
import {
  deleteMaintenancePlan,
  finalizeMaintenanceCondition,
  getMaintenanceCompletionCondition,
  getMaintenancePlans,
  getMaintenanceRecords,
  getMaintenanceSummary,
  getMaintenanceVehicles,
  type MaintenancePlan,
  type MaintenanceRecord,
  type MaintenanceSummary,
} from "@/services/maintenance";
import type { VehicleInspectionRecord, VehicleRecord } from "@/services/vehicle";
import type { VehicleConditionUpdateFormValues } from "@/validations/vehicle/schemas";
import {
  MaintenanceHistoryTable,
  MaintenancePlansTable,
  ScheduledMaintenanceTable,
} from "./components/MaintenanceTables";
import { MaintenanceDetailsDialog } from "./components/MaintenanceDetailsDialog";

type ModuleTab = "plans" | "active" | "history";

type MaintenanceModuleProps = {
  fixedVehicleId?: string;
  compact?: boolean;
};

export function MaintenanceModule({ fixedVehicleId, compact = false }: MaintenanceModuleProps) {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [summary, setSummary] = useState<MaintenanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ModuleTab>("plans");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planOpen, setPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MaintenancePlan>();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [initialPlanId, setInitialPlanId] = useState<string>();
  const [lifecycle, setLifecycle] = useState<{ record: MaintenanceRecord; mode: "start" | "complete" } | null>(null);
  const [rescheduleRecord, setRescheduleRecord] = useState<MaintenanceRecord | null>(null);
  const [cancelRecord, setCancelRecord] = useState<MaintenanceRecord | null>(null);
  const [detailsRecord, setDetailsRecord] = useState<MaintenanceRecord | null>(null);
  const [deletePlan, setDeletePlan] = useState<MaintenancePlan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conditionFlow, setConditionFlow] = useState<{
    record: MaintenanceRecord;
    currentCondition: VehicleInspectionRecord;
    personnelName?: string;
  } | null>(null);

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

  const normalizedSearch = search.trim().toLowerCase();
  const filteredPlans = useMemo(() => plans.filter((plan) => (
    (statusFilter === "all" || plan.dueStatus === statusFilter)
    && `${plan.vehicle?.name ?? ""} ${plan.name} ${plan.categoryLabel}`.toLowerCase().includes(normalizedSearch)
  )), [normalizedSearch, plans, statusFilter]);
  const filteredActive = useMemo(() => records.filter((record) => (
    ["scheduled", "in_progress"].includes(record.status)
    && (statusFilter === "all" || record.status === statusFilter)
    && `${record.vehicle?.name ?? ""} ${record.title} ${record.serviceProvider ?? ""}`.toLowerCase().includes(normalizedSearch)
  )), [normalizedSearch, records, statusFilter]);
  const filteredHistory = useMemo(() => records.filter((record) => (
    ["completed", "cancelled"].includes(record.status)
    && (statusFilter === "all" || record.status === statusFilter)
    && `${record.vehicle?.name ?? ""} ${record.title} ${record.serviceProvider ?? ""}`.toLowerCase().includes(normalizedSearch)
  )), [normalizedSearch, records, statusFilter]);

  const summaryItems = [
    { label: "Due Soon", value: fixedVehicleId ? plans.filter((plan) => plan.dueStatus === "due_soon").length : summary?.dueSoon, icon: Gauge, iconClassName: "bg-warning-surface text-warning" },
    { label: "Overdue", value: fixedVehicleId ? plans.filter((plan) => plan.dueStatus === "overdue").length : summary?.overdue, icon: AlertCircle, iconClassName: "bg-destructive-surface text-destructive" },
    { label: "Scheduled", value: fixedVehicleId ? records.filter((record) => record.status === "scheduled").length : summary?.scheduled, icon: CalendarClock, iconClassName: "bg-muted text-primary" },
    { label: "In Progress", value: fixedVehicleId ? records.filter((record) => record.status === "in_progress").length : summary?.inProgress, icon: Wrench, iconClassName: "bg-success-surface text-success" },
  ];

  const statusOptions = tab === "plans"
    ? [["all", "All Conditions"], ["upcoming", "Upcoming"], ["due_soon", "Due Soon"], ["due", "Due"], ["overdue", "Overdue"]]
    : tab === "active"
      ? [["all", "All Status"], ["scheduled", "Scheduled"], ["in_progress", "In Progress"]]
      : [["all", "All Status"], ["completed", "Completed"], ["cancelled", "Cancelled"]];

  const openSchedule = (planId?: string) => {
    setInitialPlanId(planId);
    setScheduleOpen(true);
  };

  const openConditionFlow = async (record: MaintenanceRecord) => {
    try {
      const [currentCondition, auth] = await Promise.all([
        getMaintenanceCompletionCondition(record.id),
        getAuthenticatedUser(),
      ]);
      setConditionFlow({ record, currentCondition, personnelName: auth.user.name });
    } catch {
      appToast.error("Vehicle Condition verification could not be loaded. Please try again.");
    }
  };

  const finalizeCondition = async (values: VehicleConditionUpdateFormValues) => {
    if (!conditionFlow) return;
    await finalizeMaintenanceCondition(conditionFlow.record.id, values);
  };

  const confirmDelete = async () => {
    if (!deletePlan) return;
    try {
      setIsDeleting(true);
      const result = await deleteMaintenancePlan(deletePlan.id);
      appToast.success(result.deleted
        ? "Unused maintenance plan deleted successfully."
        : "Maintenance plan archived successfully. Its history was preserved.");
      setDeletePlan(null);
      await load();
    } catch {
      appToast.error("The maintenance plan could not be deleted. Resolve active maintenance and try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />Loading maintenance</div>;
  }

  return (
    <section className={compact ? "space-y-4" : "min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={compact ? "text-lg font-bold text-foreground" : "text-2xl font-bold tracking-tight text-foreground"}>{compact ? "Vehicle Maintenance" : "Maintenance Management"}</h1>
          <p className={compact ? "mt-1 text-xs text-muted-foreground" : "mt-0.5 text-sm text-muted-foreground"}>Plans are reminders. Only scheduled or in-progress work affects booking availability.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => { setEditingPlan(undefined); setPlanOpen(true); }}><Settings /> Add Plan</Button>
          <Button type="button" onClick={() => openSchedule()}><Plus /> Custom Maintenance</Button>
        </div>
      </div>

      {error ? <Card className="rounded-2xl border border-destructive-border bg-destructive-surface shadow-none"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-sm text-destructive"><AlertCircle size={16} />{error}</div><Button type="button" size="sm" variant="outline" onClick={() => void load()}>Try Again</Button></CardContent></Card> : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summaryItems.map(({ label, value, icon, iconClassName }) => <KpiCard key={label} label={label} value={value ?? 0} icon={icon} iconClassName={iconClassName} />)}
      </div>

      <Tabs value={tab} onValueChange={(value) => { setTab(value as ModuleTab); setStatusFilter("all"); }}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl border border-border bg-surface p-1">
          <TabsTrigger value="plans" className="px-3 py-2 text-[12px]">Maintenance Plans</TabsTrigger>
          <TabsTrigger value="active" className="px-3 py-2 text-[12px]">Scheduled &amp; Active</TabsTrigger>
          <TabsTrigger value="history" className="px-3 py-2 text-[12px]">History</TabsTrigger>
        </TabsList>

        <Card className="rounded-2xl border-0 bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <CardContent className="p-4"><div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <SearchInput value={search} onValueChange={setSearch} placeholder="Search maintenance..." wrapperClassName="min-w-[180px] flex-1" />
            <FilterSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              ariaLabel="Filter maintenance records by status"
              className="sm:w-[170px]"
              options={statusOptions.map(([value, label]) => ({ value, label }))}
            />
          </div></CardContent>
        </Card>

        <TabsContent value="plans"><MaintenancePlansTable plans={filteredPlans} onSchedule={openSchedule} onEdit={(plan) => { setEditingPlan(plan); setPlanOpen(true); }} onDelete={setDeletePlan} onViewRecord={(recordId) => { const record = records.find((item) => item.id === recordId); if (record) setDetailsRecord(record); }} /></TabsContent>
        <TabsContent value="active"><ScheduledMaintenanceTable records={filteredActive} onView={setDetailsRecord} onStart={(record) => setLifecycle({ record, mode: "start" })} onComplete={(record) => setLifecycle({ record, mode: "complete" })} onReschedule={setRescheduleRecord} onCancel={setCancelRecord} onCondition={(record) => void openConditionFlow(record)} /></TabsContent>
        <TabsContent value="history"><MaintenanceHistoryTable records={filteredHistory} onView={setDetailsRecord} /></TabsContent>
      </Tabs>

      <MaintenancePlanDialog open={planOpen} onOpenChange={(open) => { setPlanOpen(open); if (!open) setEditingPlan(undefined); }} vehicles={vehicles} fixedVehicleId={fixedVehicleId} editingPlan={editingPlan} onSaved={() => void load()} />
      <ScheduleMaintenanceDialog open={scheduleOpen} onOpenChange={(open) => { setScheduleOpen(open); if (!open) setInitialPlanId(undefined); }} vehicles={vehicles} plans={plans} fixedVehicleId={fixedVehicleId} initialPlanId={initialPlanId} onSaved={() => void load()} />
      <MaintenanceLifecycleDialog record={lifecycle?.record ?? null} mode={lifecycle?.mode ?? null} onOpenChange={() => setLifecycle(null)} onSaved={() => void load()} onConditionRequired={(record) => void openConditionFlow(record)} />
      <RescheduleMaintenanceDialog record={rescheduleRecord} vehicle={vehicles.find((vehicle) => vehicle.id === rescheduleRecord?.vehicleId)} onOpenChange={() => setRescheduleRecord(null)} onSaved={() => void load()} />
      <CancelMaintenanceDialog record={cancelRecord} onOpenChange={() => setCancelRecord(null)} onSaved={() => void load()} />
      <MaintenanceDetailsDialog record={detailsRecord} onOpenChange={() => setDetailsRecord(null)} />

      {conditionFlow ? (
        <UpdateConditionDialog
          open
          onOpenChange={(open) => { if (!open) setConditionFlow(null); }}
          vehicleId={conditionFlow.record.vehicleId}
          currentCondition={conditionFlow.currentCondition}
          personnelName={conditionFlow.personnelName}
          defaultReason={conditionFlow.record.category === "body_repair" ? "repair_completed" : "maintenance_completed"}
          reasonLocked
          finalizeCondition={finalizeCondition}
          successMessage="Vehicle Condition verified and maintenance completed successfully."
          onSaved={async () => { setConditionFlow(null); await load(); }}
        />
      ) : null}

      <AlertDialog open={Boolean(deletePlan)} onOpenChange={(open) => { if (!open && !isDeleting) setDeletePlan(null); }}>
        <AlertDialogContent className="max-w-[430px] rounded-2xl border-0 shadow-[0_24px_64px_rgba(0,0,0,0.13)]">
          <AlertDialogHeader><AlertDialogTitle>Delete Maintenance Plan?</AlertDialogTitle><AlertDialogDescription>{deletePlan?.hasHistory ? `“${deletePlan.name}” has maintenance history, so it will be archived and the history will remain.` : `Delete “${deletePlan?.name}”? This unused plan will be removed.`}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Keep Plan</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={isDeleting} onClick={(event) => { event.preventDefault(); void confirmDelete(); }}>{isDeleting ? "Deleting..." : "Delete Plan"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
