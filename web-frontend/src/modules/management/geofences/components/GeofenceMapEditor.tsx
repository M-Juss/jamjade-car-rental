"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";
import { Loader2, MapPin } from "lucide-react";
import type { GeofenceCoordinate } from "@/services/booking/types";

type GeofenceMapEditorProps = {
  geometryType: "circle" | "polygon";
  center?: GeofenceCoordinate | null;
  radiusMeters?: number;
  points: GeofenceCoordinate[];
  polygonClosed: boolean;
  readOnly?: boolean;
  onCircleCenter?: (coordinate: GeofenceCoordinate) => void;
  onPolygonPoint?: (coordinate: GeofenceCoordinate) => void;
  onClosePolygon?: () => void;
  onOpenPolygon?: () => void;
};

const defaultCenter = { lat: 14.5995, lng: 120.9842 };

export function GeofenceMapEditor({
  geometryType,
  center,
  radiusMeters,
  points,
  polygonClosed,
  readOnly = false,
  onCircleCenter,
  onPolygonPoint,
  onClosePolygon,
  onOpenPolygon,
}: GeofenceMapEditorProps) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const initialViewportSetRef = useRef(false);
  const shapeRef = useRef<google.maps.Circle | google.maps.Polygon | google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const onCircleRef = useRef(onCircleCenter);
  const onPolygonRef = useRef(onPolygonPoint);
  const geometryTypeRef = useRef(geometryType);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [loading, setLoading] = useState(Boolean(apiKey));
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const error = apiKey ? loadError : "Map preview is unavailable.";

  useEffect(() => {
    onCircleRef.current = onCircleCenter;
    onPolygonRef.current = onPolygonPoint;
    geometryTypeRef.current = geometryType;
  }, [geometryType, onCircleCenter, onPolygonPoint]);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    loadGoogleMaps(apiKey).then(() => {
      if (cancelled || !nodeRef.current) return;
      const map = new google.maps.Map(nodeRef.current, {
        center: defaultCenter,
        zoom: 12,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: readOnly ? "cooperative" : "greedy",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      if (!readOnly) {
        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (event.latLng) {
            const coordinate = { latitude: event.latLng.lat(), longitude: event.latLng.lng() };
            if (geometryTypeRef.current === "circle") onCircleRef.current?.(coordinate);
            else onPolygonRef.current?.(coordinate);
          }
        });
      }
      mapRef.current = map;
      setMapReady(true);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setLoadError("Google Maps could not load. Check the API key, domain restrictions, and Maps JavaScript API access.");
        setLoading(false);
      }
    });
    return () => { cancelled = true; mapRef.current = null; };
  }, [apiKey, readOnly]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    shapeRef.current?.setMap(null);
    shapeRef.current = null;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (geometryType === "circle" && center) {
      const position = { lat: center.latitude, lng: center.longitude };
      markersRef.current.push(new google.maps.Marker({
        map,
        position: { lat: center.latitude, lng: center.longitude },
        title: "Fence center",
        clickable: false,
      }));
      if (radiusMeters && radiusMeters > 0) {
        shapeRef.current = new google.maps.Circle({
          map,
          clickable: false,
          center: { lat: center.latitude, lng: center.longitude },
          radius: radiusMeters,
          fillColor: "#346EF6",
          fillOpacity: 0.12,
          strokeColor: "#346EF6",
          strokeOpacity: 0.8,
          strokeWeight: 2,
        });
      }
      if (!initialViewportSetRef.current && shapeRef.current instanceof google.maps.Circle) {
        const bounds = shapeRef.current.getBounds();
        if (bounds) map.fitBounds(bounds, 32);
        else map.panTo(position);
      } else {
        map.panTo(position);
      }
      initialViewportSetRef.current = true;
    } else if (geometryType === "polygon" && points.length > 0) {
      const path = points.map((point) => ({ lat: point.latitude, lng: point.longitude }));
      markersRef.current = path.map((position, index) => {
        const canTogglePolygonClosure = !readOnly && index === 0 && path.length >= 3;
        const marker = new google.maps.Marker({
          map,
          position,
          label: String(index + 1),
          title: !readOnly && index === 0 && path.length >= 3
            ? polygonClosed ? "Click to reopen the polygon" : "Click to close the polygon"
            : `Boundary point ${index + 1}`,
          clickable: canTogglePolygonClosure,
        });

        if (canTogglePolygonClosure) {
          marker.addListener("click", () => {
            if (polygonClosed) onOpenPolygon?.();
            else onClosePolygon?.();
          });
        }

        return marker;
      });
      if (path.length >= 3 && polygonClosed) {
        shapeRef.current = new google.maps.Polygon({
          map,
          paths: path,
          clickable: false,
          fillColor: "#346EF6",
          fillOpacity: 0.16,
          strokeColor: "#346EF6",
          strokeOpacity: 0.9,
          strokeWeight: 2,
        });
      } else if (path.length >= 2) {
        shapeRef.current = new google.maps.Polyline({ map, path, clickable: false, strokeColor: "#346EF6", strokeWeight: 2 });
      }
      if (!initialViewportSetRef.current) {
        if (path.length === 1) map.panTo(path[0]);
        else {
          const bounds = new google.maps.LatLngBounds();
          path.forEach((position) => bounds.extend(position));
          map.fitBounds(bounds, 32);
        }
        initialViewportSetRef.current = true;
      }
    }
  }, [center, geometryType, mapReady, onClosePolygon, onOpenPolygon, points, polygonClosed, radiusMeters, readOnly]);

  return (
    <div className="relative shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
      <div ref={nodeRef} className={`w-full ${readOnly ? "h-[180px] sm:h-[320px] lg:h-[360px]" : "h-[280px] sm:h-[480px] lg:h-[540px]"}`} aria-label={readOnly ? "Geofence boundary map" : "Geofence map editor"} />
      {loading ? <div className="absolute inset-0 flex items-center justify-center bg-surface/90 text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />Loading map</div> : null}
      {error ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface px-5 text-center text-sm text-muted-foreground"><MapPin className="size-5 text-primary" /><span>{error}</span></div> : null}
    </div>
  );
}
