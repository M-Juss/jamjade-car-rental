"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, X, Car, DollarSign, Users, Settings2,
  Fuel, Gauge, Check, Wind, Bluetooth, Navigation,
  Camera, ParkingCircle, Usb, Wifi, Armchair, Video,
  Gauge as CruiseIcon, Shield, Key, Zap, Baby,
  Leaf, Mountain, Plus,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { InputWithLabel } from "@/components/common/InputWithLabel";
import { SelectWithLabel } from "@/components/common/SelectWithLabel";

// ─── FEATURES DATA ────────────────────────────────────────────────────────────

// TODO: Extract into reusable component: <FeatureSelector />

const FEATURES = [
  { id: "ac", label: "Air Conditioning", icon: Wind },
  { id: "bluetooth", label: "Bluetooth", icon: Bluetooth },
  { id: "carplay", label: "Apple CarPlay", icon: Car },
  { id: "android", label: "Android Auto", icon: Car },
  { id: "gps", label: "GPS Navigation", icon: Navigation },
  { id: "reverse", label: "Reverse Camera", icon: Camera },
  { id: "parking", label: "Parking Sensors", icon: ParkingCircle },
  { id: "usb", label: "USB Charging", icon: Usb },
  { id: "wireless", label: "Wireless Charging", icon: Wifi },
  { id: "leather", label: "Leather Seats", icon: Armchair },
  { id: "dashcam", label: "Dashcam", icon: Video },
  { id: "cruise", label: "Cruise Control", icon: CruiseIcon },
  { id: "abs", label: "ABS Brakes", icon: Shield },
  { id: "airbag", label: "Airbags", icon: Shield },
  { id: "pushstart", label: "Push Start", icon: Key },
  { id: "keyless", label: "Keyless Entry", icon: Key },
  { id: "childseat", label: "Child Seat", icon: Baby },
  { id: "fueleff", label: "Fuel Efficient", icon: Leaf },
  { id: "petfriendly", label: "Pet Friendly", icon: Leaf },
  { id: "awd", label: "4WD / AWD", icon: Mountain },
];

const BRANDS = ["Toyota", "Honda", "Mitsubishi", "Ford", "Hyundai", "Nissan", "Kia", "Mazda", "Suzuki", "Isuzu"];

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave?: (data: FormState) => void;
}

interface FormState {
  name: string;
  brand: string;
  price: string;
  seats: string;
  gvm: string;
  color: string;
  mileage: string;
  transmission: string;
  fuel: string;
  features: string[];
  image: string | null;
}

const INITIAL_FORM: FormState = {
  name: "", brand: "", price: "", seats: "",
  gvm: "", color: "", mileage: "", transmission: "", fuel: "", features: [], image: null,
};

// ─── DIALOG COMPONENT ────────────────────────────────────────────────────────

export function VehicleFormDialog({ open, onOpenChange, onSave }: VehicleFormDialogProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof FormState, val: string) =>
    setForm((p) => ({ ...p, [key]: val }));

  const toggleFeature = (id: string) =>
    setForm((p) => ({
      ...p,
      features: p.features.includes(id)
        ? p.features.filter((f) => f !== id)
        : [...p.features, id],
    }));

  const handleImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => set("image", e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleImage(e.dataTransfer.files[0]);
  };

  const handleReset = () => {
    setForm(INITIAL_FORM);
    onOpenChange(false);
  };

  const handleSave = () => {
    onSave?.(form);
    handleReset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] lg:w-[50vw]
          max-w-[960px] sm:max-w-none p-0 gap-0 rounded-2xl border-0
          shadow-[0_24px_64px_rgba(0,0,0,0.14)]
          flex flex-col max-h-[70v h]
          sm:max-h-[88vh]
          [&>button]:hidden
        "
      >

        {/* ================= DIALOG HEADER ================= */}
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-[#F0F2F7]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
                <Car size={18} className="text-[#346EF6]" strokeWidth={2.2} />
              </div>
              <div>
                <DialogTitle className="text-[16px] font-bold text-[#1A2340] leading-tight">
                  Add Vehicle
                </DialogTitle>
                <DialogDescription className="text-[12px] text-[#8896A7] mt-0.5">
                  Fill in the details to add a new vehicle to the fleet.
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[#A0AABF] hover:text-[#4A5568] hover:bg-[#F5F5F5] transition-all duration-150 flex-shrink-0 mt-0.5"
            >
              <X size={15} />
            </button>
          </div>
        </DialogHeader>

        {/* ================= SCROLLABLE BODY ================= */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* ================= IMAGE UPLOAD ================= */}
            {/* TODO: Extract into reusable component: <ImageUpload /> */}
            <div>
              <Label className="text-[11.5px] font-semibold text-[#4A5568] mb-2 block">Vehicle Image</Label>

              {form.image ? (
                // Image Preview
                <div className="relative rounded-2xl overflow-hidden border border-[#E8ECF4] bg-[#F8F9FC]">
                  <img
                    src={form.image}
                    alt="Vehicle preview"
                    className="w-full h-44 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-white text-[12px] font-semibold text-[#1A2340] shadow hover:bg-[#F5F5F5] transition-colors"
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => set("image", "")}
                      className="px-3 py-1.5 rounded-lg bg-white text-[12px] font-semibold text-rose-500 shadow hover:bg-rose-50 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                // Dropzone
                <motion.div
                  whileHover={{ scale: 1.005 }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`
                    relative h-40 rounded-2xl border-2 border-dashed cursor-pointer
                    flex flex-col items-center justify-center gap-2.5 transition-all duration-200
                    ${dragOver
                      ? "border-[#346EF6] bg-[#EEF4FF]"
                      : "border-[#D1D5E0] bg-[#F8F9FC] hover:border-[#346EF6] hover:bg-[#F0F5FF]"
                    }
                  `}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-200 ${dragOver ? "bg-[#346EF6]" : "bg-[#EEF4FF]"}`}>
                    <Upload size={18} className={dragOver ? "text-white" : "text-[#346EF6]"} strokeWidth={2} />
                  </div>
                  <div className="text-center">
                    <p className="text-[12.5px] font-semibold text-[#1A2340]">
                      {dragOver ? "Drop to upload" : "Click or drag & drop"}
                    </p>
                    <p className="text-[11px] text-[#A0AABF] mt-0.5">PNG, JPG, WEBP up to 10MB</p>
                  </div>
                </motion.div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImage(e.target.files?.[0])}
              />
            </div>

            <Separator className="bg-[#F0F2F7]" />

            {/* ================= BASIC INFORMATION ================= */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
                  <Car size={12} className="text-[#346EF6]" />
                </div>
                <h3 className="text-[12.5px] font-bold text-[#1A2340]">Basic Information</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Vehicle Name */}
                <InputWithLabel
                  id="vehicle-name"
                  label="Vehicle Name"
                  required
                  placeholder="e.g. Toyota Fortuner 2023"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  wrapperClassName="sm:col-span-2"
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />

                {/* Brand */}
                <div>
                  <SelectWithLabel
                    id="vehicle-brand"
                    label="Brand *"
                    placeholder="Select brand"
                    options={BRANDS.map((brand) => ({ value: brand, label: brand }))}
                    value={form.brand}
                    onValueChange={(v) => set("brand", v)}
                    labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                    triggerClassName="h-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC] focus:ring-[#346EF6] focus:ring-1"
                  />
                </div>

                {/* Price */}
                <InputWithLabel
                  id="vehicle-price"
                  label="Price / Day (₱)"
                  required
                  icon={<DollarSign size={13} />}
                  type="number"
                  placeholder="0"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />
              </div>
            </div>

            <Separator className="bg-[#F0F2F7]" />

            {/* ================= SPECIFICATIONS ================= */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
                  <Settings2 size={12} className="text-[#346EF6]" />
                </div>
                <h3 className="text-[12.5px] font-bold text-[#1A2340]">Specifications</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Seats */}
                <InputWithLabel
                  id="vehicle-seats"
                  label="Seats"
                  icon={<Users size={13} />}
                  type="number"
                  placeholder="e.g. 5"
                  value={form.seats}
                  onChange={(e) => set("seats", e.target.value)}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />

                {/* GVM */}
                <InputWithLabel
                  id="vehicle-gvm"
                  label="GVM (kg)"
                  icon={<Gauge size={13} />}
                  placeholder="e.g. 3050"
                  value={form.gvm}
                  onChange={(e) => set("gvm", e.target.value)}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />

                {/* Color */}
                <InputWithLabel
                  id="vehicle-color"
                  label="Color"
                  placeholder="e.g. Pearl White"
                  value={form.color}
                  onChange={(e) => set("color", e.target.value)}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />

                {/* Mileage */}
                <InputWithLabel
                  id="vehicle-mileage"
                  label="Mileage (km)"
                  type="number"
                  placeholder="e.g. 12400"
                  value={form.mileage}
                  onChange={(e) => set("mileage", e.target.value)}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />

                {/* Transmission */}
                <div>
                  <SelectWithLabel
                    id="vehicle-transmission"
                    label="Transmission"
                    placeholder="Select"
                    options={[
                      { value: "Automatic", label: "Automatic" },
                      { value: "Manual", label: "Manual" },
                    ]}
                    value={form.transmission}
                    onValueChange={(v) => set("transmission", v)}
                    labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                    triggerClassName="h-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC]"
                  />
                </div>

                {/* Fuel Type */}
                <div>
                  <SelectWithLabel
                    id="vehicle-fuel"
                    label="Fuel Type"
                    placeholder="Select"
                    options={[
                      { value: "Gasoline", label: "Gasoline" },
                      { value: "Diesel", label: "Diesel" },
                      { value: "Hybrid", label: "Hybrid" },
                      { value: "Electric", label: "Electric" },
                    ]}
                    value={form.fuel}
                    onValueChange={(v) => set("fuel", v)}
                    labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                    triggerClassName="h-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC]"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-[#F0F2F7]" />

            {/* ================= FEATURES ================= */}
            {/* TODO: Extract into reusable component: <FeatureSelector /> */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
                    <Zap size={12} className="text-[#346EF6]" />
                  </div>
                  <h3 className="text-[12.5px] font-bold text-[#1A2340]">Features</h3>
                </div>
                {form.features.length > 0 && (
                  <span className="text-[11px] font-semibold text-[#346EF6] bg-[#EEF4FF] px-2.5 py-1 rounded-lg">
                    {form.features.length} selected
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FEATURES.map(({ id, label, icon: Icon }) => {
                  const selected = form.features.includes(id);
                  return (
                    <motion.button
                      key={id}
                      type="button"
                      onClick={() => toggleFeature(id)}
                      whileTap={{ scale: 0.96 }}
                      className={`
                        relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border text-center
                        transition-all duration-150 cursor-pointer group
                        ${selected
                          ? "bg-[#EEF4FF] border-[#346EF6] shadow-[0_2px_8px_rgba(52,110,246,0.18)]"
                          : "bg-[#F8F9FC] border-[#E8ECF4] hover:border-[#B8CEFD] hover:bg-[#F0F5FF]"
                        }
                      `}
                    >
                      {/* Selected checkmark */}
                      <AnimatePresence>
                        {selected && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#346EF6] flex items-center justify-center"
                          >
                            <Check size={9} className="text-white" strokeWidth={3} />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150 ${selected ? "bg-[#346EF6]" : "bg-white border border-[#E8ECF4] group-hover:border-[#B8CEFD]"}`}>
                        <Icon size={13} className={selected ? "text-white" : "text-[#8896A7]"} strokeWidth={2} />
                      </div>
                      <span className={`text-[10.5px] font-semibold leading-tight ${selected ? "text-[#346EF6]" : "text-[#4A5568]"}`}>
                        {label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

          </div>
        </ScrollArea>

        {/* ================= STICKY ACTION FOOTER ================= */}
        <div className="flex-shrink-0 border-t border-[#F0F2F7] px-6 py-4 bg-white rounded-b-2xl">
          <div className="flex flex-col-reverse sm:flex-row gap-2.5">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1 rounded-xl border-[#E2E8F0] text-[#4A5568] h-10 text-[13px] font-medium hover:bg-[#F5F5F5]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 rounded-xl bg-[#346EF6] hover:bg-[#2558D8] text-white h-10 text-[13px] font-semibold shadow-[0_4px_14px_rgba(52,110,246,0.28)] transition-all duration-200"
            >
              <Car size={14} className="mr-2" />
              Save Vehicle
            </Button>
          </div>
          <p className="text-center text-[10.5px] text-[#A0AABF] mt-2.5">
            Fields marked <span className="text-rose-400 font-semibold">*</span> are required
          </p>
        </div>

      </DialogContent>
    </Dialog>
  );
}
