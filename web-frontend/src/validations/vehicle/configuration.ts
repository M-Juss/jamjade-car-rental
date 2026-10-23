import { z } from "zod/v3";
import type { VehicleOptionSection } from "@/services/vehicle/configuration.service";

export function vehicleOptionSchema(section: VehicleOptionSection) {
  const max = section === "brand" ? 80 : ["transmission", "fuel_type"].includes(section) ? 40 : 120;
  return z.object({
    name: z.string().trim().min(1, "Enter a name.").max(max, "Maximum " + max + " characters.")
      .refine((name) => section !== "feature" || name.toLowerCase() !== "dashcam", "Dashcam is no longer offered."),
    is_active: z.boolean(),
  });
}
export type VehicleOptionValues = z.infer<ReturnType<typeof vehicleOptionSchema>>;
