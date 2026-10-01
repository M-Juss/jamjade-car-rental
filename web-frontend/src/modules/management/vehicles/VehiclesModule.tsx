"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent } from "@/components/ui/card";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { TableActionMenu } from "@/components/common/tables/TableActionMenu";
import { VehicleFormDialog } from "@/forms/vehicle/details/CreateVehicleDialog";
import { appToast } from "@/lib/toast";
import {
  createVehicle,
  deleteVehicle,
  getVehicles,
  type VehicleRecord,
} from "@/services/vehicle";
import type { VehicleFormValues } from "@/validations/vehicle/schemas";
import { managementPath } from "@/modules/management/shell/config/module-registry";
import { useManagementPortal } from "@/modules/management/shell/context/ManagementSessionProvider";

const statusStyle: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rented: "bg-muted text-primary border-blue-200",
  Maintenance: "bg-amber-50 text-amber-700 border-amber-200",
  Unavailable: "bg-slate-100 text-slate-600 border-slate-200",
};

function getStatusLabel(vehicle: VehicleRecord) {
  return (
    vehicle.statusLabel ??
    vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1)
  );
}

function getVehicleImage(vehicle: VehicleRecord) {
  return vehicle.image ?? vehicle.images[0] ?? null;
}

// ─── VEHICLE MANAGEMENT PAGE ──────────────────────────────────────────────────

// TODO: Extract into reusable component: <VehicleTable />

export default function Vehicle() {
  const router = useRouter();
  const portal = useManagementPortal();
  const vehiclePath = managementPath(portal, "vehicles") ?? "/owner/vehicle";
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [transmissionFilter, setTransmissionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const perPage = 6;

  useEffect(() => {
    let ignore = false;

    async function loadVehicles() {
      try {
        setIsLoading(true);
        setError(null);
        const records = await getVehicles();

        if (!ignore) {
          setVehicles(records);
          setPage(1);
        }
      } catch {
        if (!ignore) {
          setError("Unable to load vehicles.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadVehicles();

    return () => {
      ignore = true;
    };
  }, []);

  const filtered = useMemo(
    () =>
      vehicles.filter((v) => {
        const status = getStatusLabel(v);
        const matchSearch =
          v.name.toLowerCase().includes(search.toLowerCase()) ||
          v.brand.toLowerCase().includes(search.toLowerCase()) ||
          (v.model ?? "").toLowerCase().includes(search.toLowerCase());
        const matchBrand = brandFilter === "all" || v.brand === brandFilter;
        const matchTrans =
          transmissionFilter === "all" || v.transmission === transmissionFilter;
        const matchStatus = statusFilter === "all" || status === statusFilter;
        return matchSearch && matchBrand && matchTrans && matchStatus;
      }),
    [brandFilter, search, statusFilter, transmissionFilter, vehicles],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const brands = [...new Set(vehicles.map((v) => v.brand))];
  const brandOptions = [
    { value: "all", label: "All Brands" },
    ...brands.map((brand) => ({ value: brand, label: brand })),
  ];
  const transmissionOptions = [
    { value: "all", label: "All Transmission" },
    { value: "Automatic", label: "Automatic" },
    { value: "Manual", label: "Manual" },
  ];
  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "Available", label: "Available" },
    { value: "Unavailable", label: "Unavailable" },
    { value: "Rented", label: "Rented" },
    { value: "Maintenance", label: "Maintenance" },
  ];

  const handleCreateVehicle = async (data: VehicleFormValues) => {
    const vehicle = await createVehicle(data);

    setVehicles((current) => [vehicle, ...current]);
    setPage(1);
  };

  const handleDeleteVehicle = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      await deleteVehicle(deleteTarget);
      setVehicles((current) =>
        current.filter((vehicle) => vehicle.id !== deleteTarget),
      );
      setDeleteTarget(null);
      appToast.success("Vehicle deleted successfully.");
    } catch {
      appToast.error("The vehicle could not be deleted. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 bg-background min-h-screen">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Vehicle Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your entire fleet from one place.
          </p>
        </div>
        <Button
          onClick={() => setVehicleFormOpen(true)}
          className="rounded-xl bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold h-10 px-4 shadow-[0_4px_14px_rgba(52,110,246,0.28)] transition-all duration-200 w-full sm:w-auto"
        >
          <Plus size={15} className="mr-2" />
          Add Vehicle
        </Button>
      </div>

      {/* ================= TOOLBAR ================= */}
      <div>
        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
          <CardContent className="px-4">
            <div className="flex flex-wrap gap-2.5 items-center">
              <SearchInput
                value={search}
                onValueChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                placeholder="Search vehicles..."
                wrapperClassName="min-w-[180px] flex-1"
              />

              <FilterSelect
                value={brandFilter}
                placeholder="Brand"
                ariaLabel="Filter vehicles by brand"
                className="w-[130px]"
                options={brandOptions}
                onValueChange={(value) => {
                  setBrandFilter(value);
                  setPage(1);
                }}
              />

              <FilterSelect
                value={transmissionFilter}
                placeholder="Transmission"
                ariaLabel="Filter vehicles by transmission"
                className="w-[150px]"
                options={transmissionOptions}
                onValueChange={(value) => {
                  setTransmissionFilter(value);
                  setPage(1);
                }}
              />

              <FilterSelect
                value={statusFilter}
                placeholder="Status"
                ariaLabel="Filter vehicles by status"
                className="w-[130px]"
                options={statusOptions}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ================= VEHICLE TABLE ================= */}
      {/* TODO: Extract into reusable component: <VehicleTable /> */}
      <div>
        {error && (
          <div className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12.5px] font-medium text-rose-700">
            {error}
          </div>
        )}
        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr className="border-b border-border bg-background">
                  {[
                    "Vehicle",
                    "Brand",
                    "Transmission",
                    "Model",
                    "Seats",
                    "Price/Day",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[10.5px] font-semibold text-subtle-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center py-12 text-[13px] text-subtle-foreground"
                    >
                      Loading vehicles...
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center py-12 text-[13px] text-subtle-foreground"
                    >
                      No vehicles found.
                    </td>
                  </tr>
                ) : (
                  paginated.map((v) => (
                    <tr
                      key={v.id}
                      className="border-b border-background hover:bg-background transition-colors duration-100 group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-background flex items-center justify-center text-xl flex-shrink-0">
                            {getVehicleImage(v) ? (
                              <div
                                aria-label={v.name}
                                role="img"
                                className="h-full w-full rounded-xl object-cover"
                                style={{
                                  background: `center / cover no-repeat url("${getVehicleImage(v)}")`,
                                }}
                              />
                            ) : (
                              "🚗"
                            )}
                          </div>
                          <span className="text-[12.5px] font-semibold text-foreground whitespace-nowrap">
                            {v.plateNumber ? `${v.name} ${v.plateNumber}` : v.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {v.brand}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {v.transmission}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {v.model}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {v.seats}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] font-semibold text-foreground">
                        ₱{v.pricePerDay.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-lg border ${statusStyle[getStatusLabel(v)] ?? statusStyle.Unavailable}`}
                        >
                          {getStatusLabel(v)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <TableActionMenu
                          label={`Open actions for ${v.name}`}
                          items={[
                            {
                              label: "View",
                              icon: (
                                <Eye
                                  size={13}
                                  className="mr-2 text-subtle-foreground"
                                />
                              ),
                              onClick: () =>
                                router.push(`${vehiclePath}/${v.id}`),
                            },
                            {
                              label: "Edit",
                              icon: (
                                <Pencil
                                  size={13}
                                  className="mr-2 text-subtle-foreground"
                                />
                              ),
                              onClick: () =>
                                router.push(`${vehiclePath}/${v.id}/edit`),
                            },
                            {
                              label: "Delete",
                              icon: <Trash2 size={13} className="mr-2" />,
                              onClick: () => setDeleteTarget(v.id),
                              separatorBefore: true,
                              variant: "danger",
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
            <p className="text-[11.5px] text-subtle-foreground">
              Showing {Math.min((page - 1) * perPage + 1, filtered.length)}–
              {Math.min(page * perPage, filtered.length)} of {filtered.length}{" "}
              vehicles
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-lg text-[12px] font-semibold transition-colors ${
                    p === page
                      ? "bg-primary text-white shadow-[0_2px_8px_rgba(52,110,246,0.3)]"
                      : "border border-border text-muted-foreground hover:bg-background"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </Card>
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-[400px] rounded-2xl border-0 shadow-[0_24px_64px_rgba(0,0,0,0.13)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px] font-bold text-foreground">
              Delete Vehicle
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-1 text-[13px] text-muted-foreground">
              This action cannot be undone. The vehicle and all its data will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Keep Vehicle</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteVehicle();
              }}
            >
              {isDeleting ? "Deleting..." : "Delete Vehicle"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VehicleFormDialog
        open={vehicleFormOpen}
        onOpenChange={setVehicleFormOpen}
        onSave={handleCreateVehicle}
      />
    </div>
  );
}
