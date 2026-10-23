export type VehicleChecklistCategory = "exterior" | "interior" | "equipment";

export const VEHICLE_CHECKLIST_CATEGORY_LABELS: Record<VehicleChecklistCategory, string> = {
  exterior: "Exterior Checklist",
  interior: "Interior Checklist",
  equipment: "Equipment / Tools",
};
