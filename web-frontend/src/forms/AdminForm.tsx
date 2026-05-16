"use client";

import { useEffect, useState } from "react";
import { EyeOff, EyeIcon, Lock, Mail, Pencil, Phone, Plus, ShieldCheck, User, X } from "lucide-react";
import { InputWithLabel } from "@/components/common/InputWithLabel";
import { SelectWithLabel } from "@/components/common/SelectWithLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

type Role = "owner" | "admin" | "staff";
type Status = "active" | "inactive" | "suspended";

interface AdminFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  role: Role;
  status: Status;
  password: string;
  confirm_password: string;
}

interface AdminFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "add" | "edit";
  initial?: Partial<AdminFormData>;
  onSave: (data: Partial<AdminFormData> & { password?: string }) => void;
}

const getInitialForm = (initial?: Partial<AdminFormData>): AdminFormData => ({
  first_name: initial?.first_name ?? "",
  last_name: initial?.last_name ?? "",
  email: initial?.email ?? "",
  phone_number: initial?.phone_number ?? "",
  role: initial?.role ?? "admin",
  status: initial?.status ?? "active",
  password: "",
  confirm_password: "",
});

export function AdminForm({ open, onOpenChange, mode, initial, onSave }: AdminFormProps) {
  const [form, setForm] = useState<AdminFormData>(getInitialForm(initial));
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);

  useEffect(() => {
    setForm(getInitialForm(initial));
    setShowPw(false);
    setShowCpw(false);
  }, [mode, initial, open]);

  const set = (k: keyof AdminFormData, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleClose = () => {
    setForm(getInitialForm(initial));
    setShowPw(false);
    setShowCpw(false);
    onOpenChange(false);
  };

  const handleSave = () => {
    onSave({ ...form, role: "admin" });
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] lg:w-[48vw]
          max-w-[820px] sm:max-w-none p-0 gap-0 rounded-2xl border-0
          shadow-[0_24px_64px_rgba(0,0,0,0.14)]
          flex flex-col max-h-[88vh]
          [&>button]:hidden
        "
      >
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-[#F0F2F7]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
                {mode === "add" ? <Plus size={17} className="text-[#346EF6]" /> : <Pencil size={15} className="text-[#346EF6]" />}
              </div>
              <div>
                <DialogTitle className="text-[16px] font-bold text-[#1A2340] leading-tight">
                  {mode === "add" ? "Add Admin" : "Edit Admin"}
                </DialogTitle>
                <DialogDescription className="text-[12px] text-[#8896A7] mt-0.5">
                  {mode === "add" ? "Fill in the details to create a new admin account." : "Update the admin account details."}
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[#A0AABF] hover:text-[#4A5568] hover:bg-[#F5F5F5] transition-all duration-150 flex-shrink-0 mt-0.5"
            >
              <X size={15} />
            </button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
                  <User size={12} className="text-[#346EF6]" />
                </div>
                <h3 className="text-[12.5px] font-bold text-[#1A2340]">Basic Information</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputWithLabel
                  id="admin-first-name"
                  label="First Name"
                  required
                  icon={<User size={13} />}
                  value={form.first_name}
                  onChange={(e) => set("first_name", e.target.value)}
                  placeholder="e.g. Maria"
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />
                <InputWithLabel
                  id="admin-last-name"
                  label="Last Name"
                  required
                  icon={<User size={13} />}
                  value={form.last_name}
                  onChange={(e) => set("last_name", e.target.value)}
                  placeholder="e.g. Santos"
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />
                <InputWithLabel
                  id="admin-email"
                  label="Email"
                  required
                  icon={<Mail size={13} />}
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="admin@jamjade.com"
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />
                <InputWithLabel
                  id="admin-phone"
                  label="Phone Number"
                  icon={<Phone size={13} />}
                  value={form.phone_number}
                  onChange={(e) => set("phone_number", e.target.value)}
                  placeholder="+63 9XX XXX XXXX"
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />
              </div>
            </div>

            <Separator className="bg-[#F0F2F7]" />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
                  <ShieldCheck size={12} className="text-[#346EF6]" />
                </div>
                <h3 className="text-[12.5px] font-bold text-[#1A2340]">Account Security</h3>
              </div>

              <div className="space-y-3">
                <SelectWithLabel
                  id="admin-status"
                  label="Status"
                  placeholder="Select status"
                  options={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                    { value: "suspended", label: "Suspended" },
                  ]}
                  value={form.status}
                  onValueChange={(v) => set("status", v)}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                  triggerClassName="h-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC]"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11.5px] font-semibold text-[#4A5568]">
                      Password {mode === "add" && <span className="text-rose-400">*</span>}
                    </Label>
                    <div className="relative">
                      <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AABF]" />
                      <Input
                        value={form.password}
                        onChange={(e) => set("password", e.target.value)}
                        type={showPw ? "text" : "password"}
                        placeholder="••••••••"
                        className="h-9 pl-8 pr-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC] focus-visible:ring-[#346EF6] focus-visible:ring-1 focus-visible:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A0AABF] hover:text-[#4A5568]"
                      >
                        {showPw ? <EyeOff size={13} /> : <EyeIcon size={13} />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11.5px] font-semibold text-[#4A5568]">
                      Confirm Password {mode === "add" && <span className="text-rose-400">*</span>}
                    </Label>
                    <div className="relative">
                      <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AABF]" />
                      <Input
                        value={form.confirm_password}
                        onChange={(e) => set("confirm_password", e.target.value)}
                        type={showCpw ? "text" : "password"}
                        placeholder="••••••••"
                        className="h-9 pl-8 pr-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC] focus-visible:ring-[#346EF6] focus-visible:ring-1 focus-visible:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCpw(!showCpw)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A0AABF] hover:text-[#4A5568]"
                      >
                        {showCpw ? <EyeOff size={13} /> : <EyeIcon size={13} />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-[#A0AABF]">
                  Role is fixed to <span className="font-semibold text-[#346EF6]">Admin</span>. Status defaults to active.
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-[#F0F2F7] flex gap-2 sm:flex-row flex-col-reverse">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1 rounded-xl border-[#E2E8F0] text-[#4A5568] h-10 text-[13px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 rounded-xl bg-[#346EF6] hover:bg-[#2558D8] text-white h-10 text-[13px] font-semibold shadow-[0_4px_14px_rgba(52,110,246,0.28)]"
          >
            {mode === "add" ? "Save Admin" : "Update Admin"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
