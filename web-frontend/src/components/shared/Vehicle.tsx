"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Car, Plus, Search, Eye, Pencil, Trash2,
  ChevronLeft, ChevronRight, SlidersHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { SelectWithLabel } from "@/components/common/SelectWithLabel";
import { VehicleFormDialog } from "@/forms/VehicleForm";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const vehicles = [
  { id: "V001", name: "Toyota Fortuner", brand: "Toyota", transmission: "Automatic", fuel: "Diesel", seats: 7, price: 4500, status: "Available", img: "🚙" },
  { id: "V002", name: "Honda CR-V", brand: "Honda", transmission: "Automatic", fuel: "Gasoline", seats: 5, price: 3800, status: "Rented", img: "🚗" },
  { id: "V003", name: "Mitsubishi Montero Sport", brand: "Mitsubishi", transmission: "Automatic", fuel: "Diesel", seats: 7, price: 4200, status: "Available", img: "🛻" },
  { id: "V004", name: "Ford Ranger Wildtrak", brand: "Ford", transmission: "Automatic", fuel: "Diesel", seats: 5, price: 3500, status: "Maintenance", img: "🚕" },
  { id: "V005", name: "Toyota Vios", brand: "Toyota", transmission: "Automatic", fuel: "Gasoline", seats: 5, price: 1800, status: "Available", img: "🚘" },
  { id: "V006", name: "Hyundai Tucson", brand: "Hyundai", transmission: "Automatic", fuel: "Gasoline", seats: 5, price: 3200, status: "Rented", img: "🚙" },
  { id: "V007", name: "Nissan Navara", brand: "Nissan", transmission: "Manual", fuel: "Diesel", seats: 5, price: 3000, status: "Available", img: "🛻" },
  { id: "V008", name: "Kia Stonic", brand: "Kia", transmission: "Automatic", fuel: "Gasoline", seats: 5, price: 2200, status: "Available", img: "🚗" },
];

const statusStyle: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rented: "bg-[#EEF4FF] text-[#346EF6] border-blue-200",
  Maintenance: "bg-amber-50 text-amber-700 border-amber-200",
};

// ─── VEHICLE MANAGEMENT PAGE ──────────────────────────────────────────────────

// TODO: Extract into reusable component: <VehicleTable />

export default function Vehicle() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [transmissionFilter, setTransmissionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 6;

  const filtered = vehicles.filter((v) => {
    const matchSearch =
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.brand.toLowerCase().includes(search.toLowerCase());
    const matchBrand = brandFilter === "all" || v.brand === brandFilter;
    const matchTrans = transmissionFilter === "all" || v.transmission === transmissionFilter;
    const matchStatus = statusFilter === "all" || v.status === statusFilter;
    return matchSearch && matchBrand && matchTrans && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
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
    { value: "Rented", label: "Rented" },
    { value: "Maintenance", label: "Maintenance" },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 bg-[#F5F5F5] min-h-screen">

      {/* ================= HEADER ================= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#1A2340] tracking-tight">Vehicle Management</h1>
          <p className="text-sm text-[#8896A7] mt-0.5">Manage your entire fleet from one place.</p>
        </div>
        <Button
          onClick={() => setVehicleFormOpen(true)}
          className="rounded-xl bg-[#346EF6] hover:bg-[#2558D8] text-white text-[13px] font-semibold h-10 px-4 shadow-[0_4px_14px_rgba(52,110,246,0.28)] transition-all duration-200 w-full sm:w-auto"
        >
          <Plus size={15} className="mr-2" />
          Add Vehicle
        </Button>
      </motion.div>

      {/* ================= TOOLBAR ================= */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.07 }}
      >
        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
          <CardContent className="px-4">
            <div className="flex flex-wrap gap-2.5 items-center">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AABF]" />
                <Input
                  placeholder="Search vehicles..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-8 h-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC] focus-visible:ring-[#346EF6] focus-visible:ring-1"
                />
              </div>

              <div className="w-[130px]">
                <SelectWithLabel
                  id="brand-filter"
                  label="Brand"
                  placeholder="Brand"
                  options={brandOptions}
                  value={brandFilter}
                  onValueChange={(v) => {
                    setBrandFilter(v);
                    setPage(1);
                  }}
                />
              </div>

              <div className="w-[150px]">
                <SelectWithLabel
                  id="transmission-filter"
                  label="Transmission"
                  placeholder="Transmission"
                  options={transmissionOptions}
                  value={transmissionFilter}
                  onValueChange={(v) => {
                    setTransmissionFilter(v);
                    setPage(1);
                  }}
                />
              </div>

              <div className="w-[130px]">
                <SelectWithLabel
                  id="status-filter"
                  label="Status"
                  placeholder="Status"
                  options={statusOptions}
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                />
              </div>

            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ================= VEHICLE TABLE ================= */}
      {/* TODO: Extract into reusable component: <VehicleTable /> */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12 }}
      >
        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr className="border-b border-[#F0F2F7] bg-[#FAFBFD]">
                  {["Vehicle", "Brand", "Transmission", "Fuel", "Seats", "Price/Day", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left text-[10.5px] font-semibold text-[#A0AABF] uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-[13px] text-[#A0AABF]">
                      No vehicles found.
                    </td>
                  </tr>
                ) : paginated.map((v) => (
                  <tr key={v.id} className="border-b border-[#F8F9FC] hover:bg-[#F5F5F5] transition-colors duration-100 group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#F5F5F5] flex items-center justify-center text-xl flex-shrink-0">
                          {v.img}
                        </div>
                        <span className="text-[12.5px] font-semibold text-[#1A2340] whitespace-nowrap">{v.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#4A5568]">{v.brand}</td>
                    <td className="px-4 py-3 text-[12px] text-[#4A5568]">{v.transmission}</td>
                    <td className="px-4 py-3 text-[12px] text-[#4A5568]">{v.fuel}</td>
                    <td className="px-4 py-3 text-[12px] text-[#4A5568]">{v.seats}</td>
                    <td className="px-4 py-3 text-[12.5px] font-semibold text-[#1A2340]">₱{v.price.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-lg border ${statusStyle[v.status]}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Use Next.js dynamic route: router.push(`/owner/vehicle/${v.id}`) */}
                        <button
                          onClick={() => router.push(`/owner/vehicle/${v.id}`)}
                          className="p-1.5 rounded-lg hover:bg-[#EEF4FF] text-[#A0AABF] hover:text-[#346EF6] transition-colors duration-150"
                          title="View"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => router.push(`/owner/vehicle/${v.id}/edit`)}
                          className="p-1.5 rounded-lg hover:bg-[#F0FDF4] text-[#A0AABF] hover:text-emerald-600 transition-colors duration-150"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(v.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-[#A0AABF] hover:text-rose-500 transition-colors duration-150"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#F0F2F7]">
            <p className="text-[11.5px] text-[#A0AABF]">
              Showing {Math.min((page - 1) * perPage + 1, filtered.length)}–{Math.min(page * perPage, filtered.length)} of {filtered.length} vehicles
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 rounded-lg border border-[#E8ECF4] flex items-center justify-center text-[#4A5568] hover:bg-[#F5F5F5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-lg text-[12px] font-semibold transition-colors ${
                    p === page
                      ? "bg-[#346EF6] text-white shadow-[0_2px_8px_rgba(52,110,246,0.3)]"
                      : "border border-[#E8ECF4] text-[#4A5568] hover:bg-[#F5F5F5]"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="w-7 h-7 rounded-lg border border-[#E8ECF4] flex items-center justify-center text-[#4A5568] hover:bg-[#F5F5F5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ================= DELETE CONFIRMATION DIALOG ================= */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl border-[#EEF1F8]">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center mb-3">
              <Trash2 size={20} className="text-rose-500" />
            </div>
            <DialogTitle className="text-[16px] font-bold text-[#1A2340]">Delete Vehicle</DialogTitle>
            <DialogDescription className="text-[13px] text-[#6B7589] mt-1">
              This action cannot be undone. The vehicle and all its data will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}
              className="flex-1 rounded-xl border-[#E2E8F0] text-[#4A5568] h-10 text-[13px]">
              Cancel
            </Button>
            <Button onClick={() => setDeleteTarget(null)}
              className="flex-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white h-10 text-[13px] font-semibold">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VehicleFormDialog
        open={vehicleFormOpen}
        onOpenChange={setVehicleFormOpen}
        onSave={(data) => {
          console.log("Vehicle saved:", data);
        }}
      />

    </div>
  );
}
