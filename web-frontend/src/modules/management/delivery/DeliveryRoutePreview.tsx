"use client";
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";
import { getSelectedDeliveryRoute } from "@/services/delivery/delivery.service";
function decode(encoded: string) {
  let index = 0,
    lat = 0,
    lng = 0;
  const result: google.maps.LatLngLiteral[] = [];
  const read = () => {
    let value = 0,
      shift = 0,
      byte: number;
    do {
      if (index >= encoded.length) throw new Error("Invalid route");
      byte = encoded.charCodeAt(index++) - 63;
      value |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    return value & 1 ? ~(value >> 1) : value >> 1;
  };
  while (index < encoded.length) {
    lat += read();
    lng += read();
    result.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return result;
}
export function DeliveryRoutePreview({ quoteId }: { quoteId: string }) {
  const node = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  useEffect(() => {
    let active = true;
    let line: google.maps.Polyline | undefined;
    const load = async () => {
      const route = await getSelectedDeliveryRoute(quoteId);
      if (!active) return;
      setSummary(
        `${(route.distanceMeters / 1000).toFixed(2)} km · ${Math.ceil(route.durationSeconds / 60)} minutes`,
      );
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!key) throw new Error();
      await loadGoogleMaps(key);
      if (!active || !node.current) return;
      const points = decode(route.encodedPolyline ?? "");
      if (!points.length) throw new Error();
      const map = new google.maps.Map(node.current, {
        center: points[0],
        zoom: 12,
        gestureHandling: "cooperative",
        mapTypeControl: false,
        streetViewControl: false,
      });
      line = new google.maps.Polyline({
        map,
        path: points,
        strokeColor: getComputedStyle(document.documentElement)
          .getPropertyValue("--primary")
          .trim(),
        strokeWeight: 4,
      });
      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 32);
    };
    load()
      .catch(() => {
        if (active)
          setError(
            "The selected route could not be shown. Check maps configuration or ask the customer to select a new route if it changed.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      line?.setMap(null);
    };
  }, [quoteId]);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{summary}</p>
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading selected route...
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div
        ref={node}
        className="h-60 rounded-xl border border-border"
        aria-label="Selected delivery route map"
      />
    </div>
  );
}
