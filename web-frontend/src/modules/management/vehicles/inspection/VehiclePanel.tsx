"use client";

import { useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clampVehicleZoom,
  clientPointInSvg,
  MAX_VEHICLE_ZOOM,
  MIN_VEHICLE_ZOOM,
  toPercentage,
  VEHICLE_VIEWBOX_HEIGHT,
  VEHICLE_VIEWBOX_WIDTH,
} from "./coordinate-utils";
import { VehicleMarker } from "./VehicleMarker";
import { VehiclePanelArtwork, VehiclePanelHitRegion } from "./panels/VehiclePanelArtwork";
import type {
  PendingVehicleBodyMarker,
  VehicleBodyMarker,
  VehiclePanelName,
} from "./types";

type Point = { clientX: number; clientY: number };
type Pan = { x: number; y: number };

type VehiclePanelProps = {
  panel: VehiclePanelName;
  markers: VehicleBodyMarker[];
  comparisonMarkers?: VehicleBodyMarker[];
  pendingMarker?: PendingVehicleBodyMarker | null;
  selectedSequence?: number | null;
  readonly?: boolean;
  disableNewMarker?: boolean;
  onAddMarker?: (panel: VehiclePanelName, x: number, y: number) => void;
  onSelectMarker?: (marker: VehicleBodyMarker) => void;
};

const MOVEMENT_THRESHOLD = 7;

export function VehiclePanel({
  panel,
  markers,
  comparisonMarkers = [],
  pendingMarker,
  selectedSequence,
  readonly,
  disableNewMarker,
  onAddMarker,
  onSelectMarker,
}: VehiclePanelProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<{
    startPoint?: Point;
    startPan: Pan;
    moved: boolean;
    pinched: boolean;
    hitElement?: SVGGraphicsElement;
    markerSequence?: number;
    pinchDistance?: number;
    pinchZoom?: number;
    pinchPan?: Pan;
    pinchMidpoint?: Point;
  }>({ startPan: { x: 0, y: 0 }, moved: false, pinched: false });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });

  const resetViewport = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const applyZoom = (nextZoom: number) => {
    const clamped = clampVehicleZoom(nextZoom);
    setZoom(clamped);
    if (clamped === 1) setPan({ x: 0, y: 0 });
  };

  const rootPoint = (point: Point) => {
    const svg = svgRef.current;
    return svg ? clientPointInSvg(svg, point.clientX, point.clientY) : null;
  };

  const pointerMidpoint = () => {
    const points = [...pointersRef.current.values()];
    if (points.length < 2) return null;
    return {
      clientX: (points[0].clientX + points[1].clientX) / 2,
      clientY: (points[0].clientY + points[1].clientY) / 2,
    };
  };

  const pointerDistance = () => {
    const points = [...pointersRef.current.values()];
    if (points.length < 2) return 0;
    return Math.hypot(
      points[1].clientX - points[0].clientX,
      points[1].clientY - points[0].clientY,
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {zoom.toFixed(1)}×
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Zoom out ${panel} view`}
            title="Zoom out"
            disabled={zoom <= MIN_VEHICLE_ZOOM}
            onClick={() => applyZoom(zoom - 0.5)}
          >
            <Minus />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Zoom in ${panel} view`}
            title="Zoom in"
            disabled={zoom >= MAX_VEHICLE_ZOOM}
            onClick={() => applyZoom(zoom + 0.5)}
          >
            <Plus />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Reset ${panel} view`}
            title="Reset view"
            disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
            onClick={resetViewport}
          >
            <RotateCcw />
          </Button>
        </div>
      </div>
      <svg
        ref={svgRef}
        aria-label={`${panel} vehicle body inspection view`}
        className="aspect-[5/3] w-full select-none touch-none bg-surface"
        role="img"
        viewBox={`0 0 ${VEHICLE_VIEWBOX_WIDTH} ${VEHICLE_VIEWBOX_HEIGHT}`}
        onPointerDown={(event) => {
          const target = event.target as SVGGraphicsElement;
          const hitElement = target.closest?.("[data-vehicle-hit-region]") as SVGGraphicsElement | null;
          const markerElement = target.closest?.("[data-vehicle-marker]") as SVGGraphicsElement | null;
          const markerSequence = Number(markerElement?.dataset.vehicleMarker);
          pointersRef.current.set(event.pointerId, {
            clientX: event.clientX,
            clientY: event.clientY,
          });
          event.currentTarget.setPointerCapture(event.pointerId);

          if (pointersRef.current.size === 1) {
            gestureRef.current = {
              startPoint: { clientX: event.clientX, clientY: event.clientY },
              startPan: pan,
              moved: false,
              pinched: false,
              hitElement: hitElement ?? undefined,
              markerSequence: Number.isFinite(markerSequence) ? markerSequence : undefined,
            };
          } else if (pointersRef.current.size === 2) {
            gestureRef.current.pinched = true;
            gestureRef.current.pinchDistance = pointerDistance();
            gestureRef.current.pinchZoom = zoom;
            gestureRef.current.pinchPan = pan;
            gestureRef.current.pinchMidpoint = pointerMidpoint() ?? undefined;
          }
        }}
        onPointerMove={(event) => {
          if (!pointersRef.current.has(event.pointerId)) return;
          pointersRef.current.set(event.pointerId, {
            clientX: event.clientX,
            clientY: event.clientY,
          });

          const gesture = gestureRef.current;
          if (pointersRef.current.size >= 2) {
            gesture.pinched = true;
            gesture.moved = true;
            const startDistance = gesture.pinchDistance ?? pointerDistance();
            const startZoom = gesture.pinchZoom ?? zoom;
            const startPan = gesture.pinchPan ?? pan;
            const startMidpoint = gesture.pinchMidpoint ?? pointerMidpoint();
            const currentMidpoint = pointerMidpoint();
            if (!startDistance || !startMidpoint || !currentMidpoint) return;

            const nextZoom = clampVehicleZoom(startZoom * (pointerDistance() / startDistance));
            const startSvg = rootPoint(startMidpoint);
            const currentSvg = rootPoint(currentMidpoint);
            if (!startSvg || !currentSvg) return;

            const anchorX = (startSvg.x - startPan.x) / startZoom;
            const anchorY = (startSvg.y - startPan.y) / startZoom;
            setZoom(nextZoom);
            setPan(nextZoom === 1 ? { x: 0, y: 0 } : {
              x: currentSvg.x - anchorX * nextZoom,
              y: currentSvg.y - anchorY * nextZoom,
            });
            return;
          }

          if (gesture.pinched) return;

          if (!gesture.startPoint) return;
          const distance = Math.hypot(
            event.clientX - gesture.startPoint.clientX,
            event.clientY - gesture.startPoint.clientY,
          );
          if (distance <= MOVEMENT_THRESHOLD) return;
          gesture.moved = true;
          if (zoom <= 1) return;

          const startSvg = rootPoint(gesture.startPoint);
          const currentSvg = rootPoint({ clientX: event.clientX, clientY: event.clientY });
          if (!startSvg || !currentSvg) return;
          setPan({
            x: gesture.startPan.x + currentSvg.x - startSvg.x,
            y: gesture.startPan.y + currentSvg.y - startSvg.y,
          });
        }}
        onPointerUp={(event) => {
          const gesture = gestureRef.current;
          const shouldAdd =
            pointersRef.current.size === 1 &&
            !gesture.moved &&
            !gesture.pinched &&
            !readonly &&
            !disableNewMarker &&
            gesture.hitElement;

          if (
            pointersRef.current.size === 1 &&
            !gesture.moved &&
            !gesture.pinched &&
            gesture.markerSequence !== undefined &&
            !readonly
          ) {
            const marker = markers.find(
              (candidate) => candidate.sequenceNumber === gesture.markerSequence,
            );
            if (marker) onSelectMarker?.(marker);
          }

          if (shouldAdd && gesture.hitElement) {
            const point = clientPointInSvg(gesture.hitElement, event.clientX, event.clientY);
            if (point) {
              onAddMarker?.(
                panel,
                toPercentage(point.x, VEHICLE_VIEWBOX_WIDTH),
                toPercentage(point.y, VEHICLE_VIEWBOX_HEIGHT),
              );
            }
          }

          pointersRef.current.delete(event.pointerId);
          if (pointersRef.current.size === 0) {
            gestureRef.current = { startPan: pan, moved: false, pinched: false };
          }
        }}
        onPointerCancel={(event) => {
          pointersRef.current.delete(event.pointerId);
          gestureRef.current.pinched = true;
        }}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          <VehiclePanelHitRegion panel={panel} />
          <VehiclePanelArtwork panel={panel} />
          {markers.map((marker) => (
            <VehicleMarker
              key={marker.id ?? marker.sequenceNumber}
              marker={marker}
              zoom={zoom}
              selected={selectedSequence === marker.sequenceNumber}
              onSelect={readonly ? undefined : () => onSelectMarker?.(marker)}
            />
          ))}
          {comparisonMarkers.map((marker) => (
            <VehicleMarker
              key={`comparison-${marker.id ?? marker.sequenceNumber}`}
              marker={marker}
              zoom={zoom}
              comparison
            />
          ))}
          {pendingMarker && <VehicleMarker marker={pendingMarker} zoom={zoom} selected />}
        </g>
      </svg>
    </div>
  );
}
