import type { Vehicle } from '@/types/browse';
import { apiGet, API_BASE_URL } from '@/services/http';

import type { MobileVehicleRecord } from './types';

const backendOrigin = API_BASE_URL.match(/^(https?:\/\/[^/]+)/i)?.[1] ?? '';

function normalizeImageUrl(value?: string | null) {
  const imageUrl = value?.trim();

  if (!imageUrl) {
    return null;
  }

  if (imageUrl.startsWith('/')) {
    return backendOrigin ? `${backendOrigin}${imageUrl}` : imageUrl;
  }

  const localUrl = imageUrl.match(
    /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/.*)$/i,
  );

  if (localUrl && backendOrigin) {
    return `${backendOrigin}${localUrl[1]}`;
  }

  if (!/^https?:\/\//i.test(imageUrl) && backendOrigin) {
    return `${backendOrigin}/${imageUrl.replace(/^\/+/, '')}`;
  }

  return imageUrl;
}

function mapVehicle(record: MobileVehicleRecord): Vehicle {
  const imageUrls = (record.images ?? [])
    .map(normalizeImageUrl)
    .filter((image): image is string => Boolean(image));
  const cardImage = normalizeImageUrl(record.cardImage ?? record.image ?? imageUrls[0]);
  const images = cardImage
    ? [cardImage, ...imageUrls.filter((image) => image !== cardImage)]
    : imageUrls;

  return {
    lateReturnPolicy: record.lateReturnPolicy,
    id: String(record.id),
    name: record.name,
    brand: record.brand,
    model: record.model,
    pricePerDay: Number(record.pricePerDay),
    status: record.status,
    cardImage,
    images,
    seats: Number(record.seats),
    transmission: record.transmission,
    fuelType: record.fuelType,
    color: record.color,
    features: record.features ?? [],
    description: record.description ?? '',
    isFeatured: Boolean(record.isFeatured),
    unavailableDateRanges: record.unavailableDateRanges ?? [],
    createdAt: record.createdAt ?? '1970-01-01',
  };
}

export async function getAvailableVehicles() {
  const vehicles: Vehicle[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await apiGet<MobileVehicleRecord[]>(
      `/mobile/vehicles?status=available&per_page=100&page=${page}`,
    );

    vehicles.push(...response.data.map(mapVehicle));
    lastPage = Number(response.meta?.last_page ?? 1);
    page += 1;
  } while (page <= lastPage);

  return vehicles;
}

export async function getVehicle(vehicleId: string) {
  const response = await apiGet<MobileVehicleRecord>(
    `/mobile/vehicles/${encodeURIComponent(vehicleId)}`,
  );

  return mapVehicle(response.data);
}
