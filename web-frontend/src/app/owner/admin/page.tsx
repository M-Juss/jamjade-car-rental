"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users, UserCheck, UserX, ShieldOff, Search, Plus,
  MoreHorizontal, Eye, Pencil, Trash2, ShieldCheck,
  ShieldAlert, X, Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminForm } from "@/forms/AdminForm";

// ================= MOCK DATA =================

type Role = "owner" | "admin" | "staff";
type Status = "active" | "inactive" | "suspended";

interface Admin {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  role: Role;
  status: Status;
  created_at: string;
  updated_at: string;
}

const MOCK_ADMINS: Admin[] = [
  { id: "ADM-001", first_name: "Maria", last_name: "Santos", email: "maria@jamjade.com", phone_number: "+63 912 345 6789", role: "owner", status: "active", created_at: "Jan 10, 2025", updated_at: "May 1, 2025" },
  { id: "ADM-002", first_name: "Juan", last_name: "dela Cruz", email: "juan@jamjade.com", phone_number: "+63 917 222 3344", role: "admin", status: "active", created_at: "Feb 3, 2025", updated_at: "Apr 28, 2025" },
  { id: "ADM-003", first_name: "Ana", last_name: "Reyes", email: "ana@jamjade.com", phone_number: "+63 920 111 2233", role: "staff", status: "inactive", created_at: "Feb 20, 2025", updated_at: "Mar 15, 2025" },
  { id: "ADM-004", first_name: "Carlos", last_name: "Mendoza", email: "carlos@jamjade.com", phone_number: "+63 918 999 8877", role: "admin", status: "suspended", created_at: "Mar 5, 2025", updated_at: "May 10, 2025" },
  { id: "ADM-005", first_name: "Liza", last_name: "Uy", email: "liza@jamjade.com", phone_number: "+63 916 456 7890", role: "staff", status: "active", created_at: "Mar 22, 2025", updated_at: "May 12, 2025" },
  { id: "ADM-006", first_name: "Marco", last_name: "Tan", email: "marco@jamjade.com", phone_number: "+63 915 333 4455", role: "staff", status: "inactive", created_at: "Apr 8, 2025", updated_at: "Apr 8, 2025" },
];

// ================= BADGE STYLES =================

const statusStyle: Record<Status, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-[#F5F5F5] text-[#8896A7] border-[#E8ECF4]",
  suspended: "bg-rose-50 text-rose-600 border-rose-200",
};

const roleStyle: Record<Role, string> = {
  owner: "bg-violet-50 text-violet-700 border-violet-200",
  admin: "bg-[#EEF4FF] text-[#346EF6] border-blue-200",
  staff: "bg-amber-50 text-amber-700 border-amber-200",
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);



// ================= ADMIN PAGE =================

export default function AdminPage() {
  const [admins, setAdmins] = useState<Admin[]>(MOCK_ADMINS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);

  // ── Filtering ────────────────────────────────────────────────────────────

  const filtered = admins.filter((a) => {
    const full = `${a.first_name} ${a.last_name} ${a.email} ${a.id}`.toLowerCase();
    const matchSearch = full.includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── KPI counts ───────────────────────────────────────────────────────────

  const counts = {
    total: admins.length,
    active: admins.filter((a) => a.status === "active").length,
    inactive: admins.filter((a) => a.status === "inactive").length,
    suspended: admins.filter((a) => a.status === "suspended").length,
  };

  // ── Handlers ─────────────────────────────────────────────────────────────

  const openAdd = () => { setFormMode("add"); setSelectedAdmin(null); setFormOpen(true); };
  const openEdit = (a: Admin) => { setFormMode("edit"); setSelectedAdmin(a); setFormOpen(true); };
  const openView = (a: Admin) => { setSelectedAdmin(a); setViewOpen(true); };
  const openDelete = (a: Admin) => { setSelectedAdmin(a); setDeleteOpen(true); };
  const openToggle = (a: Admin) => { setSelectedAdmin(a); setToggleOpen(true); };

  const handleDelete = () => {
    if (selectedAdmin) setAdmins((p) => p.filter((a) => a.id !== selectedAdmin.id));
    setDeleteOpen(false);
  };

  const handleToggle = () => {
    if (!selectedAdmin) return;
    setAdmins((p) => p.map((a) =>
      a.id === selectedAdmin.id
        ? { ...a, status: a.status === "active" ? "inactive" : "active" }
        : a
    ));
    setToggleOpen(false);
  };

  const handleSave = (data: Partial<Admin> & { password?: string; confirm_password?: string }) => {
    if (formMode === "add") {
      const newAdmin: Admin = {
        id: `ADM-00${admins.length + 1}`,
        first_name: data.first_name ?? "",
        last_name: data.last_name ?? "",
        email: data.email ?? "",
        phone_number: data.phone_number ?? "",
        role: (data.role as Role) ?? "admin",
        status: (data.status as Status) ?? "active",
        created_at: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        updated_at: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      };
      setAdmins((p) => [newAdmin, ...p]);
    } else if (selectedAdmin) {
      setAdmins((p) => p.map((a) =>
        a.id === selectedAdmin.id ? { ...a, ...data } : a
      ));
    }
  };

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay },
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 bg-[#F5F5F5] min-h-screen">

      {/* ================= HEADER ================= */}
      <motion.div {...fadeUp(0)} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2340] tracking-tight">Admin Management</h1>
          <p className="text-sm text-[#8896A7] mt-0.5">Manage admin accounts and access control.</p>
        </div>
        <Button onClick={openAdd}
          className="rounded-xl bg-[#346EF6] hover:bg-[#2558D8] text-white text-[13px] font-semibold h-10 px-4 shadow-[0_4px_14px_rgba(52,110,246,0.28)] transition-all duration-200 w-full sm:w-auto">
          <Plus size={15} className="mr-2" /> Add Admin
        </Button>
      </motion.div>

      {/* ================= SUMMARY CARDS ================= */}
      {/* TODO: Extract this into reusable component: <AdminStatCard /> */}
      <motion.div {...fadeUp(0.07)} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Admins", value: counts.total, icon: Users, bg: "bg-[#EEF4FF]", c: "text-[#346EF6]" },
          { label: "Active", value: counts.active, icon: UserCheck, bg: "bg-emerald-50", c: "text-emerald-600" },
          { label: "Inactive", value: counts.inactive, icon: UserX, bg: "bg-[#F5F5F5]", c: "text-[#8896A7]" },
          { label: "Suspended", value: counts.suspended, icon: ShieldOff, bg: "bg-rose-50", c: "text-rose-500" },
        ].map(({ label, value, icon: Icon, bg, c }) => (
          <Card key={label} className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white hover:shadow-[0_4px_20px_rgba(52,110,246,0.1)] hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={17} className={c} strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-[22px] font-bold text-[#1A2340] leading-none">{value}</p>
                <p className="text-[11px] text-[#8896A7] mt-0.5 font-medium">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* ================= FILTERS ================= */}
      <motion.div {...fadeUp(0.12)}>
        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2.5 items-center">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AABF]" />
                <Input placeholder="Search admins..." value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC] focus-visible:ring-[#346EF6] focus-visible:ring-1" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC] w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              {(search || statusFilter !== "all") && (
                <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("all"); }}
                  className="h-9 rounded-xl border-[#E8ECF4] text-[#8896A7] text-[12px] px-3 hover:bg-[#F5F5F5]">
                  <X size={12} className="mr-1.5" /> Clear
                </Button>
              )}
              <div className="ml-auto flex items-center gap-1.5 text-[11px] text-[#A0AABF]">
                <Filter size={11} /> {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ================= ADMIN TABLE ================= */}
      {/* TODO: Extract this into reusable component: <AdminTable /> */}
      <motion.div {...fadeUp(0.17)}>
        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAFBFD] border-b border-[#F0F2F7] hover:bg-[#FAFBFD]">
                  {["Admin ID", "Full Name", "Email", "Phone", "Status", ""].map((h) => (
                    <TableHead key={h} className="text-[10.5px] font-semibold text-[#A0AABF] uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-14">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-2xl bg-[#F5F5F5] flex items-center justify-center">
                          <Users size={20} className="text-[#A0AABF]" />
                        </div>
                        <p className="text-[13px] font-semibold text-[#4A5568]">No admins found</p>
                        <p className="text-[11.5px] text-[#A0AABF]">Try adjusting your filters.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.map((admin) => (
                  <TableRow key={admin.id}
                    className="border-b border-[#F8F9FC] hover:bg-[#F5F5F5] transition-colors duration-100">
                    <TableCell className="px-4 py-3 text-[12px] font-mono font-semibold text-[#346EF6]">
                      {admin.id}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="text-[12.5px] font-semibold text-[#1A2340] whitespace-nowrap">
                        {admin.first_name} {admin.last_name}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-[12px] text-[#4A5568]">{admin.email}</TableCell>
                    <TableCell className="px-4 py-3 text-[12px] text-[#4A5568] whitespace-nowrap">{admin.phone_number}</TableCell>
                    <TableCell className="px-4 py-3">
                      <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-lg border ${statusStyle[admin.status]}`}>
                        {capitalize(admin.status)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[#A0AABF] hover:bg-[#EEF4FF] hover:text-[#346EF6] transition-colors duration-150">
                            <MoreHorizontal size={14} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.1)] border-[#EEF1F8] p-1">
                          <DropdownMenuItem onClick={() => openView(admin)}
                            className="rounded-lg text-[12.5px] text-[#4A5568] px-3 py-2 cursor-pointer">
                            <Eye size={13} className="mr-2 text-[#A0AABF]" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(admin)}
                            className="rounded-lg text-[12.5px] text-[#4A5568] px-3 py-2 cursor-pointer">
                            <Pencil size={13} className="mr-2 text-[#A0AABF]" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-[#F0F2F7] my-1" />
                          <DropdownMenuItem onClick={() => openToggle(admin)}
                            className="rounded-lg text-[12.5px] px-3 py-2 cursor-pointer text-amber-600">
                            {admin.status === "active"
                              ? <><ShieldOff size={13} className="mr-2" /> Disable</>
                              : <><ShieldCheck size={13} className="mr-2" /> Activate</>
                            }
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDelete(admin)}
                            className="rounded-lg text-[12.5px] text-rose-500 px-3 py-2 cursor-pointer">
                            <Trash2 size={13} className="mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </motion.div>

      {/* ================= ADD / EDIT ADMIN DIALOG ================= */}
      <AdminForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initial={selectedAdmin ?? undefined}
        onSave={handleSave}
      />

      {/* ================= VIEW ADMIN DIALOG ================= */}
      {/* TODO: Extract this into reusable component: <ViewAdminDialog /> */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-[480px] rounded-2xl border-0 shadow-[0_24px_64px_rgba(0,0,0,0.13)] p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#F0F2F7]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF4FF] flex items-center justify-center">
                <Eye size={16} className="text-[#346EF6]" />
              </div>
              <div>
                <DialogTitle className="text-[15px] font-bold text-[#1A2340]">Admin Details</DialogTitle>
                <DialogDescription className="text-[11.5px] text-[#8896A7]">
                  Full account information for {selectedAdmin?.first_name}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {selectedAdmin && (
            <div className="px-6 py-5 space-y-3">
              {/* Avatar */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#F8F9FC] border border-[#EEF1F8]">
                <div className="w-12 h-12 rounded-xl bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
                  <span className="text-[15px] font-bold text-[#346EF6]">
                    {selectedAdmin.first_name[0]}{selectedAdmin.last_name[0]}
                  </span>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#1A2340]">{selectedAdmin.first_name} {selectedAdmin.last_name}</p>
                  <p className="text-[11.5px] text-[#8896A7]">{selectedAdmin.email}</p>
                  <div className="flex gap-1.5 mt-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${roleStyle[selectedAdmin.role]}`}>{capitalize(selectedAdmin.role)}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${statusStyle[selectedAdmin.status]}`}>{capitalize(selectedAdmin.status)}</span>
                  </div>
                </div>
              </div>
              {/* Details grid */}
              <div className="space-y-2">
                {[
                  ["Admin ID", selectedAdmin.id],
                  ["Phone Number", selectedAdmin.phone_number],
                  ["Created At", selectedAdmin.created_at],
                  ["Updated At", selectedAdmin.updated_at],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-[#F0F2F7] last:border-0">
                    <span className="text-[11.5px] text-[#8896A7]">{label}</span>
                    <span className="text-[12.5px] font-semibold text-[#1A2340]">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="px-6 pb-5">
            <Button onClick={() => setViewOpen(false)} variant="outline"
              className="w-full rounded-xl border-[#E2E8F0] text-[#4A5568] h-10 text-[13px]">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ================= CONFIRMATION DIALOGS ================= */}

      {/* Delete */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="max-w-[400px] rounded-2xl border-0 shadow-[0_24px_64px_rgba(0,0,0,0.13)]">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center mb-3">
              <Trash2 size={20} className="text-rose-500" />
            </div>
            <AlertDialogTitle className="text-[16px] font-bold text-[#1A2340]">Delete Admin</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-[#6B7589] mt-1 leading-relaxed">
              Are you sure you want to delete <strong>{selectedAdmin?.first_name} {selectedAdmin?.last_name}</strong>?
              We recommend disabling the account instead of permanently deleting it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 mt-2">
            <AlertDialogCancel className="flex-1 rounded-xl border-[#E2E8F0] text-[#4A5568] h-10 text-[13px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}
              className="flex-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white h-10 text-[13px] font-semibold">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disable / Activate */}
      <AlertDialog open={toggleOpen} onOpenChange={setToggleOpen}>
        <AlertDialogContent className="max-w-[400px] rounded-2xl border-0 shadow-[0_24px_64px_rgba(0,0,0,0.13)]">
          <AlertDialogHeader>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${selectedAdmin?.status === "active" ? "bg-amber-50" : "bg-emerald-50"}`}>
              {selectedAdmin?.status === "active"
                ? <ShieldAlert size={20} className="text-amber-500" />
                : <ShieldCheck size={20} className="text-emerald-500" />
              }
            </div>
            <AlertDialogTitle className="text-[16px] font-bold text-[#1A2340]">
              {selectedAdmin?.status === "active" ? "Disable Admin" : "Activate Admin"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-[#6B7589] mt-1 leading-relaxed">
              {selectedAdmin?.status === "active"
                ? `Disabling ${selectedAdmin?.first_name}'s account will prevent them from logging in until reactivated.`
                : `Activating ${selectedAdmin?.first_name}'s account will restore their access to the system.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 mt-2">
            <AlertDialogCancel className="flex-1 rounded-xl border-[#E2E8F0] text-[#4A5568] h-10 text-[13px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleToggle}
              className={`flex-1 rounded-xl h-10 text-[13px] font-semibold text-white ${selectedAdmin?.status === "active" ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-500 hover:bg-emerald-600"}`}>
              {selectedAdmin?.status === "active" ? "Disable" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
