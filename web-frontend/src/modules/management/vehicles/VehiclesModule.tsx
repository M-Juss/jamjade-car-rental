"use client";

import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";

import { ManagementTable as Table, ManagementTableCell as TableCell, TableCard } from "@/components/common/tables/ManagementTable";
import { TablePagination } from "@/components/common/tables/TablePagination";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Settings2,
  Eye,
  Pencil,
  Trash2,
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
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardContent } from "@/components/ui/card";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { TableActionMenu } from "@/components/common/tables/TableActionMenu";
import { VehicleConfigurationDialog } from "./components/VehicleConfigurationDialog";
import { VehicleFormDialog } from "@/forms/vehicle/details/CreateVehicleDialog";
import { TABLE_PAGE_SIZE } from "@/lib/table-pagination";
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
  Available: "bg-success-surface text-success border-success-border",
  Rented: "bg-muted text-primary border-blue-200",
  Maintenance: "bg-warning-surface text-warning border-warning-border",
  Unavailable: "bg-background text-muted-foreground border-border",
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
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const perPage = TABLE_PAGE_SIZE;

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
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const brands = [...new Set(vehicles.map((v) => v.brand))];
  const brandOptions = [
    { value: "all", label: "All Brands" },
    ...brands.map((brand) => ({ value: brand, label: brand })),
  ];
  const transmissionOptions = [
    { value: "all", label: "All Transmission" },
    ...[...new Set(vehicles.map((vehicle) => vehicle.transmission))].map((value) => ({ value, label: value })),
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
        <ManagementPageHeading title="Vehicles" description="Manage vehicle details, availability, and condition." />
        <div className="flex w-full gap-2 sm:w-auto">
        {portal === "admin" ? <Button type="button" variant="outline" className="h-10 flex-1 rounded-xl text-sm sm:flex-none" onClick={() => setConfigurationOpen(true)}><Settings2 size={15} />Configure</Button> : null}
        <Button
          onClick={() => setVehicleFormOpen(true)}
          className="rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-semibold h-10 px-4 shadow-none transition-all duration-200 flex-1 sm:flex-none"
        >
          <Plus size={15} className="mr-2" />
          Add Vehicle
        </Button>
        </div>
      </div>
      {portal === "admin" ? <VehicleConfigurationDialog open={configurationOpen} onOpenChange={setConfigurationOpen} /> : null}

      {/* ================= TOOLBAR ================= */}
      <TableCard>
          <CardContent className="border-b border-border p-4">
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

      {/* ================= VEHICLE TABLE ================= */}
        {error && (
          <div className="mb-3 rounded-xl border border-destructive-border bg-destructive-surface px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </div>
        )}
          <div className="min-w-0">
            <Table>
              <colgroup>
                <col style={{ width: "24%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "13%" }} />
                <col />
                <col style={{ width: "3rem" }} />
              </colgroup>
              <TableHeader>
                <TableRow className="border-b border-border bg-background">
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
                    <TableHead
                      key={h}
                      className="text-left text-xs font-semibold text-subtle-foreground normal-case tracking-normal px-4 py-3 whitespace-normal"
                    >
                      {h === "Actions" ? <span className="sr-only">Actions</span> : h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-sm text-subtle-foreground"
                    >
                      Loading vehicles...
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">Vehicles could not be loaded.</TableCell></TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-sm text-subtle-foreground"
                    >
                      No vehicles found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((v) => (
                    <TableRow
                      key={v.id}
                      className="border-b border-background hover:bg-background transition-colors duration-100 group"
                    >
                      <TableCell data-label="Vehicle" className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-transparent flex items-center justify-center text-xl flex-shrink-0">
                            {getVehicleImage(v) ? (
                              <div
                                aria-label={v.name}
                                role="img"
                                className="h-full w-full rounded-xl object-contain"
                                style={{
                                  background: `center / contain no-repeat url("${getVehicleImage(v)}")`,
                                }}
                              />
                            ) : (
                              "🚗"
                            )}
                          </div>
                          <span className="text-sm font-semibold text-foreground whitespace-normal">
                            {v.plateNumber ? `${v.name} ${v.plateNumber}` : v.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell data-label="Brand" className="px-4 py-3 text-sm text-muted-foreground">
                        {v.brand}
                      </TableCell>
                      <TableCell data-label="Transmission" className="px-4 py-3 text-sm text-muted-foreground">
                        {v.transmission}
                      </TableCell>
                      <TableCell data-label="Model" className="px-4 py-3 text-sm text-muted-foreground">
                        {v.model}
                      </TableCell>
                      <TableCell data-label="Seats" className="px-4 py-3 text-sm text-muted-foreground">
                        {v.seats}
                      </TableCell>
                      <TableCell data-label="Price/Day" className="px-4 py-3 text-sm font-semibold text-foreground">
                        ₱{v.pricePerDay.toLocaleString()}
                      </TableCell>
                      <TableCell data-label="Status" className="px-4 py-3">
                        <span
                          className={`table-status-badge text-xs font-semibold px-2.5 py-1 rounded-lg border ${statusStyle[getStatusLabel(v)] ?? statusStyle.Unavailable}`}
                        >
                          {getStatusLabel(v)}
                        </span>
                      </TableCell>
                      <TableCell data-label="Actions" className="px-4 py-3">
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
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

        {!isLoading && !error && filtered.length > 0 && <div className="border-t border-border px-4 py-3 [&>div]:mt-0"><TablePagination total={filtered.length} page={currentPage} lastPage={totalPages} onPageChange={setPage} label="Vehicles pagination" /></div>}
      </TableCard>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-[400px] rounded-2xl border border-border shadow-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground">
              Delete Vehicle
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-1 text-sm text-muted-foreground">
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
