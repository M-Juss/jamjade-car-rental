import { apiGet } from '@/services/http';
export type PlacePrediction = {
  description: string;
  place_id: string;
  source?: 'google';
  structured_formatting?: { main_text?: string; secondary_text?: string };
};
export type ResolvedPlace = {
  placeId: string;
  address: string;
  latitude: number;
  longitude: number;
};
// Billing session identifier only; authentication uses the existing Sanctum token.
export const createGooglePlacesSessionToken = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
export const canSearchGooglePlaces = (query: string) =>
  query.trim().length >= 2;
export async function searchGooglePlaces({
  query,
  sessionToken,
  signal,
}: {
  query: string;
  sessionToken: string;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({
    input: query,
    session_token: sessionToken,
  });
  const response = await apiGet<{ placeId: string; description: string }[]>(
    `/mobile/delivery/places?${params}`,
    { signal },
  );
  return response.data.map((place) => ({
    description: place.description,
    place_id: place.placeId,
    source: 'google' as const,
  }));
}
export async function resolveGooglePlace(
  placeId: string,
  token: string,
  selectedAddress: string,
): Promise<ResolvedPlace> {
  const response = await apiGet<Omit<ResolvedPlace, 'address'>>(
    `/mobile/delivery/place?${new URLSearchParams({ place_id: placeId, session_token: token })}`,
  );
  return { ...response.data, address: selectedAddress };
}
