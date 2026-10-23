"use client";

import { useCallback, useEffect, useState } from "react";
import { getVehicleOptions, type VehicleOptions } from "@/services/vehicle/configuration.service";

export function useVehicleOptions(enabled = true) {
  const [data, setData] = useState<VehicleOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const options = await getVehicleOptions();
      setData(options); setError(null);
      return options;
    } catch {
      setData(null); setError("Unable to load vehicle options.");
      return null;
    }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    getVehicleOptions().then((options) => {
      if (active) { setData(options); setError(null); }
    }).catch(() => {
      if (active) { setData(null); setError("Unable to load vehicle options."); }
    });
    return () => { active = false; };
  }, [enabled]);
  return { data, error, reload };
}

export function vehicleSelectOptions(names: string[], current?: string) {
  return [...new Set([...names, ...(current ? [current] : [])])].map((name) => ({ value: name, label: name }));
}
