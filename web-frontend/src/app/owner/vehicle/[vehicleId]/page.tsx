"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Fuel,
  Users,
  Gauge,
  Palette,
  Settings2,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const MOCK_VEHICLE = {
  id: "V001",
  name: "Toyota Fortuner",
  brand: "Toyota",
  model: "Fortuner",
  plate: "ABC 1234",
  year: "2023",
  transmission: "Automatic",
  fuel: "Diesel",
  seats: 7,
  gvm: "3,050 kg",
  mileage: "12,400 km",
  color: "Pearl White",
  price: 4500,
  status: "Available",
  img: "🚙",
  features: [
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
    "ABS Brakes",
    "Airbags",
    "Push Start Button",
    "Keyless Entry",
    "Child Seat Available",
    "Fuel Efficient",
    "Pet Friendly",
    "4WD / AWD",
  ],
  gallery: ["🚙", "🛻", "🚗"],
};

const statusStyle: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rented: "bg-[#EEF4FF] text-[#346EF6] border-blue-200",
  Maintenance: "bg-amber-50 text-amber-700 border-amber-200",
};

// ─── VEHICLE DETAILS PAGE ─────────────────────────────────────────────────────

export default function VehicleDetails() {
  const router = useRouter();
  const vehicle = MOCK_VEHICLE;

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay },
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
        <span className="text-[12.5px] font-semibold text-[#1A2340]">
          {vehicle.name}
        </span>
      </motion.div>

      <motion.div {...fadeUp(0.07)}>
        <Card className="rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] bg-white overflow-hidden">
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div className="w-20 h-20 rounded-2xl bg-[#F5F5F5] flex items-center justify-center text-5xl flex-shrink-0 shadow-inner">
                {vehicle.img}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-[#1A2340]">
                    {vehicle.name}
                  </h2>
                  <span
                    className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-lg border ${statusStyle[vehicle.status]}`}
                  >
                    {vehicle.status}
                  </span>
                </div>
                <p className="text-[12.5px] text-[#8896A7]">
                  {vehicle.brand} · {vehicle.year} · {vehicle.plate}
                </p>
                <p className="text-[20px] font-bold text-[#346EF6] mt-2">
                  ₱{vehicle.price.toLocaleString()}
                  <span className="text-[13px] font-medium text-[#8896A7]">
                    {" "}
                    / day
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div {...fadeUp(0.12)} className="space-y-4">
        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
          <CardHeader className="pb-1 px-5 pt-5">
            <CardTitle className="text-[13px] font-bold text-[#1A2340] flex items-center gap-2">
              <Settings2 size={14} className="text-[#346EF6]" /> Specifications
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-1">
              {[
                {
                  icon: Users,
                  label: "Seats",
                  val: `${vehicle.seats} seats`,
                },
                { icon: Gauge, label: "GVM", val: vehicle.gvm },
                {
                  icon: Settings2,
                  label: "Transmission",
                  val: vehicle.transmission,
                },
                { icon: Fuel, label: "Fuel Type", val: vehicle.fuel },
                { icon: Gauge, label: "Mileage", val: vehicle.mileage },
                { icon: Palette, label: "Color", val: vehicle.color },
              ].map(({ icon: Icon, label, val }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[#F8F9FC] hover:bg-[#F0F4FF] transition-colors duration-150"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-[#346EF6]" />
                  </div>
                  <div>
                    <p className="text-[10.5px] text-[#A0AABF] font-medium">
                      {label}
                    </p>
                    <p className="text-[12.5px] font-semibold text-[#1A2340]">
                      {val}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
          <CardHeader className="pb-1 px-5 pt-5">
            <CardTitle className="text-[13px] font-bold text-[#1A2340] flex items-center gap-2">
              <CheckCircle2 size={14} className="text-[#346EF6]" /> Features
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex flex-wrap gap-2 mt-1">
              {vehicle.features.map((f) => (
                <span
                  key={f}
                  className="text-[11.5px] font-medium px-3 py-1.5 rounded-xl bg-[#EEF4FF] text-[#346EF6] border border-blue-100"
                >
                  {f}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
          <CardHeader className="pb-1 px-5 pt-5">
            <CardTitle className="text-[13px] font-bold text-[#1A2340]">
              Image Gallery
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <div className="w-full h-48 rounded-2xl bg-[#F5F5F5] flex items-center justify-center text-7xl border border-[#E8ECF4]">
              {vehicle.img}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {vehicle.gallery.map((g, i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl bg-[#F5F5F5] flex items-center justify-center text-4xl border border-[#E8ECF4] hover:border-[#346EF6] cursor-pointer transition-colors duration-150"
                >
                  {g}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
