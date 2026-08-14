export const VEHICLE_PANEL_ORDER = ["front", "left", "rear", "right"] as const;
export type VehiclePanelName = (typeof VEHICLE_PANEL_ORDER)[number];

export const VEHICLE_ISSUE_TYPES = [
  "scratch",
  "dent",
  "crack",
  "paint_damage",
  "damaged_part",
  "other",
] as const;
export type VehicleIssueType = (typeof VEHICLE_ISSUE_TYPES)[number];

export const VEHICLE_ISSUE_TYPE_LABELS: Record<VehicleIssueType, string> = {
  scratch: "Scratch",
  dent: "Dent",
  crack: "Crack",
  paint_damage: "Paint damage",
  damaged_part: "Damaged part",
  other: "Other",
};

export type VehicleBodyMarker = {
  id?: string;
  sequenceNumber: number;
  panel: VehiclePanelName;
  xPosition: number;
  yPosition: number;
  issueType: VehicleIssueType;
  description: string;
};

export type PendingVehicleBodyMarker = Omit<
  VehicleBodyMarker,
  "issueType" | "description"
>;

export type VehicleBodyInspectionMode = "edit" | "readonly" | "compare";
