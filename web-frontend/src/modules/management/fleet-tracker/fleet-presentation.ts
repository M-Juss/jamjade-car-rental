import type { FleetRental } from "@/services/fleet/types";

export function fleetVehicleName(vehicle: FleetRental["vehicle"]): string {
  if (!vehicle) return "Vehicle unavailable";
  let name = vehicle.name.trim();
  const brand = vehicle.brand?.trim();
  const model = vehicle.model?.trim();
  if (brand && name.toLowerCase() !== brand.toLowerCase() && !name.toLowerCase().startsWith(`${brand.toLowerCase()} `)) name = `${brand} ${name}`;
  if (model && name.toLowerCase() !== model.toLowerCase() && !name.toLowerCase().endsWith(` ${model.toLowerCase()}`)) name = `${name} ${model}`;
  return name;
}
