"use client";

import { useParams } from "next/navigation";
import EditVehicleForm from "@/forms/vehicle/details/EditVehicleForm";

export default function EditVehiclePage() {
  const params = useParams<{ vehicleId: string }>();
  const vehicleId = params?.vehicleId ?? "V001";

  return <EditVehicleForm vehicleId={vehicleId} />;
}
