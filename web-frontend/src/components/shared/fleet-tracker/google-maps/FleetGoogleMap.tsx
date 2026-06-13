"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { LocateFixed, Minus, Plus, Radar, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FleetVehicle } from "@/lib/mock_fleet_tracker";

type FleetGoogleMapProps = {
  vehicles: FleetVehicle[];
  selectedId: string;
  showGeofence: boolean;
  onSelect: (id: string) => void;
  onToggleGeofence: () => void;
  className?: string;
};

const defaultCenter = { lat: 14.5995, lng: 120.9842 };

const markerColors: Record<FleetVehicle["status"], string> = {
  Active: "#10B981",
  Paused: "#F59E0B",
  Idle: "#64748B",
  "Geofence Alert": "#F43F5E",
  "GPS Lost": "#8B5CF6",
};

let isGoogleMapsConfigured = false;

function createMarkerIcon(color: string, selected: boolean): google.maps.Icon {
  const size = selected ? 22 : 18;
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" stroke="white" stroke-width="4"/>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

export function FleetGoogleMap({
  vehicles,
  selectedId,
  showGeofence,
  onSelect,
  onToggleGeofence,
  className,
}: FleetGoogleMapProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const geofenceRef = useRef<google.maps.Circle | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const missingApiKeyError = apiKey ? null : "Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local";
  const [isLoading, setIsLoading] = useState(Boolean(apiKey));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [trafficEnabled, setTrafficEnabled] = useState(false);
  const error = missingApiKeyError ?? loadError;

  const center = useMemo(() => {
    const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedId);
    return selectedVehicle ? { lat: selectedVehicle.lat, lng: selectedVehicle.lng } : defaultCenter;
  }, [selectedId, vehicles]);

  useEffect(() => {
    if (!apiKey) return;

    let cancelled = false;

    if (!isGoogleMapsConfigured) {
      setOptions({
        key: apiKey,
        v: "weekly",
      });
      isGoogleMapsConfigured = true;
    }

    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(() => {
        if (cancelled || !mapNodeRef.current) return;

        mapRef.current = new google.maps.Map(mapNodeRef.current, {
          center: defaultCenter,
          zoom: 12,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        trafficLayerRef.current = new google.maps.TrafficLayer();
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Unable to load Google Maps. Check the API key, domain restrictions, and Maps JavaScript API access.");
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = vehicles.map((vehicle) => {
      const marker = new google.maps.Marker({
        map,
        position: { lat: vehicle.lat, lng: vehicle.lng },
        title: vehicle.carName,
        icon: createMarkerIcon(markerColors[vehicle.status], selectedId === vehicle.id),
        zIndex: selectedId === vehicle.id ? 20 : 10,
      });

      marker.addListener("click", () => onSelect(vehicle.id));
      return marker;
    });
  }, [onSelect, selectedId, vehicles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.panTo(center);
  }, [center]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    geofenceRef.current?.setMap(null);
    geofenceRef.current = null;

    if (showGeofence) {
      geofenceRef.current = new google.maps.Circle({
        map,
        center: defaultCenter,
        radius: 18000,
        fillColor: "#346EF6",
        fillOpacity: 0.08,
        strokeColor: "#346EF6",
        strokeOpacity: 0.45,
        strokeWeight: 2,
      });
    }
  }, [showGeofence]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !trafficLayerRef.current) return;

    trafficLayerRef.current.setMap(trafficEnabled ? map : null);
  }, [trafficEnabled]);

  const centerAllVehicles = () => {
    const map = mapRef.current;
    if (!map || !vehicles.length) return;

    const bounds = new google.maps.LatLngBounds();
    vehicles.forEach((vehicle) => bounds.extend({ lat: vehicle.lat, lng: vehicle.lng }));
    map.fitBounds(bounds, 48);
  };

  const updateZoom = (direction: "in" | "out") => {
    const map = mapRef.current;
    if (!map) return;

    const currentZoom = map.getZoom() ?? 12;
    map.setZoom(direction === "in" ? currentZoom + 1 : currentZoom - 1);
  };

  return (
    <div className={`relative min-h-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${className ?? ""}`}>
      <div ref={mapNodeRef} className="h-full w-full" />

      {isLoading ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 text-xs font-medium text-[#4A5568]">
          Loading Google Maps...
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-4 z-20 flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-xs font-medium text-rose-600">
          {error}
        </div>
      ) : null}

      <div className="absolute left-4 top-4 z-10 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-[#4A5568] shadow-sm backdrop-blur">
        Google Maps live fleet view
      </div>

      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <Button variant="outline" size="icon-sm" aria-label="Zoom in" onClick={() => updateZoom("in")}><Plus /></Button>
        <Button variant="outline" size="icon-sm" aria-label="Zoom out" onClick={() => updateZoom("out")}><Minus /></Button>
        <Button variant="outline" size="icon-sm" aria-label="Center all vehicles" onClick={centerAllVehicles}><LocateFixed /></Button>
        <Button variant={showGeofence ? "secondary" : "outline"} size="icon-sm" aria-label="Toggle geofence" onClick={onToggleGeofence}><Route /></Button>
        <Button variant={trafficEnabled ? "secondary" : "outline"} size="icon-sm" aria-label="Toggle traffic" onClick={() => setTrafficEnabled((value) => !value)}><Radar /></Button>
      </div>
    </div>
  );
}
