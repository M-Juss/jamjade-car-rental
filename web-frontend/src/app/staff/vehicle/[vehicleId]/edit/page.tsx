"use client";

import { useParams } from "next/navigation";
import EditVehicleForm from "@/forms/vehicle/details/EditVehicleForm";

export default function AdminEditVehiclePage() {
  const params = useParams<{ vehicleId: string }>();

  return <EditVehicleForm vehicleId={params?.vehicleId ?? ""} />;
}
