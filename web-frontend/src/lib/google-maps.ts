import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
let configured = false;
export function loadGoogleMaps(apiKey: string) {
  if (!configured) {
    setOptions({ key: apiKey, v: "weekly" });
    configured = true;
  }
  return importLibrary("maps");
}
