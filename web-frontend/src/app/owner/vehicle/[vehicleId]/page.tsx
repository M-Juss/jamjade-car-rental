"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Fuel,
  Users,
  Palette,
  Settings2,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VehicleImageGallery } from "@/components/common/VehicleImageGallery";
import { getVehicle, type VehicleRecord } from "@/services/vehicle";

const statusStyle: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rented: "bg-[#EEF4FF] text-[#346EF6] border-blue-200",
  Maintenance: "bg-amber-50 text-amber-700 border-amber-200",
  Unavailable: "bg-slate-100 text-slate-600 border-slate-200",
};

function getStatusLabel(vehicle: VehicleRecord) {
  return vehicle.statusLabel ?? vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1);
}

function getVehicleImage(vehicle: VehicleRecord) {
  return vehicle.image ?? vehicle.images[0] ?? null;
}

export default function VehicleDetails() {
  const router = useRouter();
  const params = useParams<{ vehicleId: string }>();
  const vehicleId = params?.vehicleId;
  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicleId) return;

    let ignore = false;

    async function loadVehicle() {
      try {
        setIsLoading(true);
        setError(null);
        const record = await getVehicle(vehicleId);

        if (!ignore) {
          setVehicle(record);
        }
      } catch {
        if (!ignore) {
          setError("Unable to load vehicle.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadVehicle();

    return () => {
      ignore = true;
    };
  }, [vehicleId]);

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
          {vehicle?.name ?? "Vehicle Details"}
        </span>
      </motion.div>

      {isLoading ? (
        <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
          <CardContent className="p-8 text-center text-[13px] font-medium text-[#8896A7]">
            Loading vehicle...
          </CardContent>
        </Card>
      ) : error || !vehicle ? (
        <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
          <CardContent className="p-8 text-center text-[13px] font-medium text-rose-600">
            {error ?? "Vehicle not found."}
          </CardContent>
        </Card>
      ) : (
        <>
          <motion.div {...fadeUp(0.07)}>
            <Card className="rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] bg-white overflow-hidden">
              <CardContent className="p-5 md:p-6">
                <div className="flex flex-col sm:flex-row items-start gap-5">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl bg-[#F5F5F5] flex-shrink-0 shadow-inner">
                    {getVehicleImage(vehicle) ? (
                      <div
                        aria-label={vehicle.name}
                        role="img"
                        className="h-full w-full object-cover"
                        style={{ background: `center / cover no-repeat url("${getVehicleImage(vehicle)}")` }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl">
                        🚗
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-[#1A2340]">
                        {vehicle.name}
                      </h2>
                      <span
                        className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-lg border ${statusStyle[getStatusLabel(vehicle)] ?? statusStyle.Unavailable}`}
                      >
                        {getStatusLabel(vehicle)}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-[#8896A7]">
                      {[vehicle.brand, vehicle.model].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-[20px] font-bold text-[#346EF6] mt-2">
                      ₱{vehicle.pricePerDay.toLocaleString()}
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
            {vehicle.description && (
              <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
                <CardHeader className="pb-1 px-5 pt-5">
                  <CardTitle className="text-[13px] font-bold text-[#1A2340] flex items-center gap-2">
                    <FileText size={14} className="text-[#346EF6]" /> Description
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <p className="text-[12.5px] leading-6 text-[#4A5568]">
                    {vehicle.description}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
              <CardHeader className="pb-1 px-5 pt-5">
                <CardTitle className="text-[13px] font-bold text-[#1A2340] flex items-center gap-2">
                  <Settings2 size={14} className="text-[#346EF6]" /> Specifications
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
                  {[
                    {
                      icon: Users,
                      label: "Seats",
                      val: `${vehicle.seats} seats`,
                    },
                    {
                      icon: Settings2,
                      label: "Transmission",
                      val: vehicle.transmission,
                    },
                    { icon: Fuel, label: "Fuel Type", val: vehicle.fuelType },
                    { icon: Palette, label: "Color", val: vehicle.color ?? "Not set" },
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
                {vehicle.features.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {vehicle.features.map((feature) => (
                      <span
                        key={feature}
                        className="text-[11.5px] font-medium px-3 py-1.5 rounded-xl bg-[#EEF4FF] text-[#346EF6] border border-blue-100"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-[#8896A7]">No features listed.</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0,0,0,0.05)] bg-white">
              <CardHeader className="pb-1 px-5 pt-5">
                <CardTitle className="text-[13px] font-bold text-[#1A2340]">
                  Image Gallery
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                {vehicle.images.length > 0 ? (
                  <VehicleImageGallery images={vehicle.images} alt={vehicle.name} />
                ) : (
                  <p className="text-[12.5px] text-[#8896A7]">No images uploaded.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
}
