export const VEHICLE_CHECKLIST = {
  exterior: {
    carwash: "Carwash",
    tire: "Tire",
    gas_cover: "Gas Cover",
    body_check: "Body Check",
    side_mirror: "Side Mirror",
    wiper: "Wiper",
    head_light: "Head Light",
    tail_light: "Tail Light",
    signal_light: "Signal Light",
  },
  interior: {
    door_pocket: "Door Pocket",
    window_button: "Window Button",
    door_lock: "Door Lock",
    bottle_holder: "Bottle Holder",
    matting_carpet: "Matting / Carpet",
    ceiling: "Ceiling",
    dashboard: "Dashboard",
    seat_position: "Seat Position",
    lights: "Lights",
    radio: "Radio",
  },
  equipment: {
    umbrella: "Umbrella",
    cellphone: "Cellphone",
    tablet: "Tablet",
    toothbrush: "Toothbrush",
    spare_tire: "Spare Tire",
    early_warning_device: "Early Warning Device",
    four_tools: "4-Tools",
    glove_box: "Glove / Glove Box",
  },
} as const;

export type VehicleChecklistCategory = keyof typeof VEHICLE_CHECKLIST;

export const VEHICLE_CHECKLIST_CATEGORY_LABELS: Record<VehicleChecklistCategory, string> = {
  exterior: "Exterior Checklist",
  interior: "Interior Checklist",
  equipment: "Equipment / Tools",
};
