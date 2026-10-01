import { z } from "zod/v3";

const numberText = (min: number, max: number, message: string) => z.string().trim().refine(
  (value) => value !== "" && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max,
  message,
);

const coordinateSchema = z.object({
  latitude: numberText(-90, 90, "Latitude must be between -90 and 90."),
  longitude: numberText(-180, 180, "Longitude must be between -180 and 180."),
});

export const geofenceTemplateSchema = z.object({
  name: z.string().trim().min(1, "Enter a geofence name.").max(255),
  geometryType: z.enum(["circle", "polygon"]),
  centerLatitude: z.string(),
  centerLongitude: z.string(),
  radiusMeters: z.string(),
  polygonCoordinates: z.array(coordinateSchema).max(100),
}).superRefine((value, context) => {
  if (value.geometryType === "circle") {
    if (!numberText(-90, 90, "Latitude must be between -90 and 90.").safeParse(value.centerLatitude).success) {
      context.addIssue({ code: "custom", path: ["centerLatitude"], message: "Enter a latitude between -90 and 90." });
    }
    if (!numberText(-180, 180, "Longitude must be between -180 and 180.").safeParse(value.centerLongitude).success) {
      context.addIssue({ code: "custom", path: ["centerLongitude"], message: "Enter a longitude between -180 and 180." });
    }
    if (!numberText(Number.MIN_VALUE, 100000, "Radius must be greater than 0 and no more than 100,000 meters.").safeParse(value.radiusMeters).success) {
      context.addIssue({ code: "custom", path: ["radiusMeters"], message: "Enter a radius greater than 0 and no more than 100,000 meters." });
    }
  } else if (value.polygonCoordinates.length < 3) {
    context.addIssue({ code: "custom", path: ["polygonCoordinates"], message: "Add at least three points to draw a polygon." });
  }
});

export type GeofenceTemplateFormValues = z.infer<typeof geofenceTemplateSchema>;
