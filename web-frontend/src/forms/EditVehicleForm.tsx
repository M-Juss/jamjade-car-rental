"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Car,
  DollarSign,
  Users,
  Settings2,
  Gauge,
  Fuel,
  Zap,
  Check,
  Save,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { InputWithLabel } from "@/components/common/InputWithLabel";
import { SelectWithLabel } from "@/components/common/SelectWithLabel";

const FEATURES = [
  "Air Conditioning",
  "Bluetooth",
  "Apple CarPlay",
  "Android Auto",
  "GPS Navigation",
  "Reverse Camera",
  "Parking Sensors",
  "USB Charging",
  "Wireless Charging",
  "Leather Seats",
  "Dashcam",
  "Cruise Control",
];

const BRANDS = ["Toyota", "Honda", "Mitsubishi", "Ford", "Hyundai", "Nissan", "Kia"];

interface EditVehicleFormProps {
  vehicleId: string;
}

export default function EditVehicleForm({ vehicleId }: EditVehicleFormProps) {
  const router = useRouter();
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    "Air Conditioning",
    "Bluetooth",
    "Reverse Camera",
  ]);

  const [form, setForm] = useState({
    name: "Toyota Fortuner",
    brand: "Toyota",
    price: "4500",
    seats: "7",
    gvm: "3050",
    color: "Pearl White",
    mileage: "12400",
    transmission: "Automatic",
    fuel: "Diesel",
  });

  const set = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleFeature = (feature: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((item) => item !== feature)
        : [...prev, feature]
    );
  };

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay },
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 bg-[#F5F5F5] min-h-screen">
      <motion.div {...fadeUp(0)} className="flex items-center gap-2">
        <button
          onClick={() => router.push("/owner/vehicle")}
          className="flex items-center gap-1.5 text-[12.5px] text-[#8896A7] hover:text-[#346EF6] transition-colors duration-150 group"
        >
          <ChevronLeft
            size={15}
            className="group-hover:-translate-x-0.5 transition-transform duration-150"
          />
          Vehicle Management
        </button>
        <span className="text-[#D1D5E0] text-sm">/</span>
        <span className="text-[12.5px] font-semibold text-[#1A2340]">Edit {vehicleId}</span>
      </motion.div>

      <motion.div {...fadeUp(0.05)}>
        <Card className="rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] bg-white overflow-hidden">
          <CardHeader className="px-5 pt-5 pb-3 border-b border-[#F0F2F7]">
            <CardTitle className="text-[16px] font-bold text-[#1A2340] flex items-center gap-2">
              <Car size={16} className="text-[#346EF6]" /> Edit Vehicle
            </CardTitle>
          </CardHeader>

          <CardContent className="p-5 md:p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
                  <ImageIcon size={12} className="text-[#346EF6]" />
                </div>
                <h3 className="text-[12.5px] font-bold text-[#1A2340]">Image Gallery</h3>
                <span className="text-[10.5px] font-medium text-[#8896A7]">Static preview</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-3">
                <div className="h-52 rounded-2xl bg-[#F5F5F5] border border-[#E8ECF4] flex items-center justify-center text-7xl">
                  🚙
                </div>
                <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
                  {["🛻", "🚗", "🚘"].map((item, i) => (
                    <div
                      key={i}
                      className="h-16 lg:h-[68px] rounded-xl bg-[#F5F5F5] border border-[#E8ECF4] flex items-center justify-center text-3xl"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Separator className="bg-[#F0F2F7]" />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
                  <Car size={12} className="text-[#346EF6]" />
                </div>
                <h3 className="text-[12.5px] font-bold text-[#1A2340]">Basic Information</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputWithLabel
                  id="edit-vehicle-name"
                  label="Vehicle Name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  wrapperClassName="sm:col-span-2"
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />

                <div>
                  <SelectWithLabel
                    id="edit-vehicle-brand"
                    label="Brand"
                    placeholder="Select brand"
                    options={BRANDS.map((brand) => ({ value: brand, label: brand }))}
                    value={form.brand}
                    onValueChange={(v) => set("brand", v)}
                    labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                    triggerClassName="h-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC]"
                  />
                </div>

                <InputWithLabel
                  id="edit-vehicle-price"
                  label="Price / Day (₱)"
                  icon={<DollarSign size={13} />}
                  type="number"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />
              </div>
            </div>

            <Separator className="bg-[#F0F2F7]" />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
                  <Settings2 size={12} className="text-[#346EF6]" />
                </div>
                <h3 className="text-[12.5px] font-bold text-[#1A2340]">Specifications</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputWithLabel
                  id="edit-vehicle-seats"
                  label="Seats"
                  icon={<Users size={13} />}
                  type="number"
                  value={form.seats}
                  onChange={(e) => set("seats", e.target.value)}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />

                <InputWithLabel
                  id="edit-vehicle-gvm"
                  label="GVM (kg)"
                  icon={<Gauge size={13} />}
                  value={form.gvm}
                  onChange={(e) => set("gvm", e.target.value)}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />

                <InputWithLabel
                  id="edit-vehicle-color"
                  label="Color"
                  value={form.color}
                  onChange={(e) => set("color", e.target.value)}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />

                <InputWithLabel
                  id="edit-vehicle-mileage"
                  label="Mileage (km)"
                  type="number"
                  value={form.mileage}
                  onChange={(e) => set("mileage", e.target.value)}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                />

                <div>
                  <SelectWithLabel
                    id="edit-vehicle-transmission"
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

                <div>
                  <SelectWithLabel
                    id="edit-vehicle-fuel"
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

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
                    <Zap size={12} className="text-[#346EF6]" />
                  </div>
                  <h3 className="text-[12.5px] font-bold text-[#1A2340]">Features</h3>
                </div>
                <span className="text-[11px] font-semibold text-[#346EF6] bg-[#EEF4FF] px-2.5 py-1 rounded-lg">
                  {selectedFeatures.length} selected
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {FEATURES.map((feature) => {
                  const selected = selectedFeatures.includes(feature);
                  return (
                    <button
                      key={feature}
                      type="button"
                      onClick={() => toggleFeature(feature)}
                      className={`relative flex items-center justify-center text-center px-2 py-3 rounded-xl border text-[10.5px] font-semibold leading-tight transition-all duration-150 ${
                        selected
                          ? "bg-[#EEF4FF] border-[#346EF6] text-[#346EF6]"
                          : "bg-[#F8F9FC] border-[#E8ECF4] text-[#4A5568] hover:border-[#B8CEFD] hover:bg-[#F0F5FF]"
                      }`}
                    >
                      {selected && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#346EF6] flex items-center justify-center">
                          <Check size={9} className="text-white" strokeWidth={3} />
                        </span>
                      )}
                      {feature}
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator className="bg-[#F0F2F7]" />

            <div className="flex flex-col-reverse sm:flex-row gap-2.5">
              <Button
                variant="outline"
                onClick={() => router.push(`/owner/vehicle/${vehicleId}`)}
                className="flex-1 rounded-xl border-[#E2E8F0] text-[#4A5568] h-10 text-[13px] font-medium hover:bg-[#F5F5F5]"
              >
                <X size={14} className="mr-2" /> Discard
              </Button>
              <Button
                className="flex-1 rounded-xl bg-[#346EF6] hover:bg-[#2558D8] text-white h-10 text-[13px] font-semibold shadow-[0_4px_14px_rgba(52,110,246,0.28)]"
              >
                <Save size={14} className="mr-2" /> Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
