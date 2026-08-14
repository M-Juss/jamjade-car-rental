import type { VehicleBodyMarker } from "./types";
import {
  percentageToCoordinate,
  VEHICLE_VIEWBOX_HEIGHT,
  VEHICLE_VIEWBOX_WIDTH,
} from "./coordinate-utils";

type VehicleMarkerProps = {
  marker: Pick<VehicleBodyMarker, "sequenceNumber" | "xPosition" | "yPosition">;
  zoom: number;
  selected?: boolean;
  comparison?: boolean;
  onSelect?: () => void;
};

export function VehicleMarker({
  marker,
  zoom,
  selected,
  comparison,
  onSelect,
}: VehicleMarkerProps) {
  const x = percentageToCoordinate(marker.xPosition, VEHICLE_VIEWBOX_WIDTH);
  const y = percentageToCoordinate(marker.yPosition, VEHICLE_VIEWBOX_HEIGHT);
  const radius = 24 / zoom;

  return (
    <g
      aria-label={`Point ${marker.sequenceNumber}`}
      data-vehicle-marker={marker.sequenceNumber}
      className={onSelect ? "cursor-pointer" : undefined}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      transform={`translate(${x} ${y})`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.();
        }
      }}
    >
      <circle
        r={radius}
        className={comparison
          ? "fill-warning stroke-white"
          : selected
            ? "fill-foreground stroke-white"
            : "fill-destructive stroke-white"}
        strokeWidth={4 / zoom}
      />
      <text
        dy="0.35em"
        fill="white"
        fontSize={20 / zoom}
        fontWeight="700"
        pointerEvents="none"
        textAnchor="middle"
      >
        {marker.sequenceNumber}
      </text>
    </g>
  );
}
