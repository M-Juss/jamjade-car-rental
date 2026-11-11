"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary } from "@googlemaps/js-api-loader";
import { Loader2, LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadGoogleMaps } from "@/lib/google-maps";
import type { FleetRental } from "@/services/fleet/types";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { fleetVehicleName } from "../../fleet-presentation";
import { fleetStatusLabels } from "../../fleet-status";

type Props = {
  rentals: FleetRental[];
  selectedId: number | null;
  onSelect: (id: number, trigger: HTMLElement) => void;
  loadingRentals: boolean;
};
type MarkerEntry = {
  marker: google.maps.marker.AdvancedMarkerElement;
  content: HTMLDivElement;
  label: HTMLSpanElement;
  tip: HTMLSpanElement;
};

export function FleetGoogleMap({ rentals, selectedId, onSelect, loadingRentals }: Props) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef(new Map<number, MarkerEntry>());
  const select = useRef(onSelect);
  const viewportIds = useRef("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const locations = rentals.filter((rental) => rental.tracking.location
    && Date.parse(rental.tracking.location.expiresAt) > clock);

  useEffect(() => { select.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    const entries = markers.current;
    loadGoogleMaps(apiKey).then(() => importLibrary("marker")).then(() => {
      if (cancelled || !node.current) return;
      map.current = new google.maps.Map(node.current, {
        center: { lat: 14.5995, lng: 120.9842 },
        zoom: 12,
        mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
        clickableIcons: false,
        gestureHandling: "cooperative",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      setReady(true);
    }).catch(() => { if (!cancelled) setFailure(true); });
    return () => {
      cancelled = true;
      entries.forEach(({ marker }) => { marker.map = null; google.maps.event.clearInstanceListeners(marker); });
      entries.clear();
      if (map.current) google.maps.event.clearInstanceListeners(map.current);
      map.current = null;
    };
  }, [apiKey]);

  useEffect(() => {
    const nextExpiry = Math.min(...rentals.flatMap((rental) => rental.tracking.location
      ? [Date.parse(rental.tracking.location.expiresAt)] : []).filter((value) => value > clock));
    if (!Number.isFinite(nextExpiry)) return;
    const timer = setTimeout(() => setClock(Date.now()), Math.min(2_147_483_647, Math.max(1, nextExpiry - Date.now())));
    return () => clearTimeout(timer);
  }, [rentals, clock]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const visible = rentals.filter((rental) => rental.tracking.location
      && Date.parse(rental.tracking.location.expiresAt) > Math.max(clock, Date.now()));
    const ids = new Set(visible.map((rental) => rental.id));
    markers.current.forEach((entry, id) => {
      if (!ids.has(id)) {
        entry.marker.map = null;
        google.maps.event.clearInstanceListeners(entry.marker);
        markers.current.delete(id);
      }
    });
    visible.forEach((rental) => {
      const point = rental.tracking.location!;
      let entry = markers.current.get(rental.id);
      if (!entry) {
        const content = document.createElement("div");
        const label = document.createElement("span");
        const tip = document.createElement("span");
        tip.setAttribute("aria-hidden", "true");
        content.append(label, tip);
        const marker = new google.maps.marker.AdvancedMarkerElement({ map: map.current, content, gmpClickable: true });
        marker.setAttribute("aria-haspopup", "dialog");
        marker.className = "rounded-lg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2";
        marker.addListener("click", () => select.current(rental.id, marker));
        entry = { content, marker, label, tip };
        markers.current.set(rental.id, entry);
      }
      const recent = rental.tracking.status === "recent_location";
      const fill = recent ? "bg-primary text-primary-foreground" : "bg-muted text-foreground";
      entry.content.className = "relative whitespace-nowrap pb-2";
      entry.label.className = `relative z-10 block rounded-lg border-2 border-surface px-2.5 py-1.5 text-xs font-semibold leading-4 shadow-none ${fill} ${selectedId === rental.id ? "ring-2 ring-primary ring-offset-2" : ""}`;
      entry.tip.className = `absolute bottom-[3px] left-1/2 z-20 size-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-surface ${fill}`;
      const label = rental.vehicle?.plateNumber || rental.bookingCode;
      const description = `${fleetVehicleName(rental.vehicle)}, ${label}, ${fleetStatusLabels[rental.tracking.status]}, last shared ${formatReturnDateTime(rental.tracking.lastLocationAt, true)}, accuracy ${Math.round(point.accuracy)} meters`;
      entry.label.textContent = label;
      entry.content.setAttribute("aria-label", description);
      entry.content.title = description;
      entry.marker.title = description;
      entry.marker.position = { lat: point.latitude, lng: point.longitude };
      entry.marker.zIndex = selectedId === rental.id ? 20 : 10;
    });
    const key = visible.map((rental) => rental.id).sort().join(",");
    if (key && viewportIds.current !== key) {
      const bounds = new google.maps.LatLngBounds();
      visible.forEach((rental) => bounds.extend({ lat: rental.tracking.location!.latitude, lng: rental.tracking.location!.longitude }));
      if (visible.length === 1) { map.current.setCenter(bounds.getCenter()); map.current.setZoom(16); }
      else map.current.fitBounds(bounds, 48);
    }
    viewportIds.current = key;
    const selected = visible.find((rental) => rental.id === selectedId)?.tracking.location;
    if (selected) map.current.panTo({ lat: selected.latitude, lng: selected.longitude });
  }, [rentals, selectedId, ready, clock]);

  function centerLocations() {
    if (!map.current || !locations.length) return;
    const bounds = new google.maps.LatLngBounds();
    locations.forEach((rental) => bounds.extend({ lat: rental.tracking.location!.latitude, lng: rental.tracking.location!.longitude }));
    if (locations.length === 1) { map.current.setCenter(bounds.getCenter()); map.current.setZoom(16); }
    else map.current.fitBounds(bounds, 48);
  }

  const unavailable = !apiKey || failure;
  return (
    <div className="relative h-[360px] overflow-hidden rounded-xl border border-border bg-background sm:h-[480px]">
      <div ref={node} className="h-full w-full" aria-label="Latest shared rental locations" />
      {unavailable || !ready || loadingRentals || !locations.length ? (
        <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 p-6 text-center text-sm text-muted-foreground">
          {!unavailable && (!ready || loadingRentals) ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <MapPin className="size-7" aria-hidden />}
          <p>{unavailable ? "Map unavailable. Rentals are listed alongside it." : !ready ? "Loading map" : loadingRentals ? "Loading locations" : "No shared locations on this page."}</p>
        </div>
      ) : null}
      {ready && locations.length > 0 ? (
        <Button variant="outline" size="icon-sm" className="absolute bottom-7 left-3 bg-surface" aria-label="Center locations on this page" onClick={centerLocations}>
          <LocateFixed />
        </Button>
      ) : null}
    </div>
  );
}
