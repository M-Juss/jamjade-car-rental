import { apiGet } from '@/services/http';

export type MobileAddressDirectoryItem = {
  code: string;
  name: string;
  type?: string | null;
  postalCode?: string | null;
};

function withQuery(path: string, params: Record<string, string | null | undefined>) {
  const query = Object.entries(params)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
    .join('&');

  return query ? `${path}?${query}` : path;
}

export async function getAddressRegions() {
  const response = await apiGet<MobileAddressDirectoryItem[]>('/mobile/address/regions');

  return response.data;
}

export async function getAddressProvinces(regionCode?: string | null) {
  const response = await apiGet<MobileAddressDirectoryItem[]>(
    withQuery('/mobile/address/provinces', { region_code: regionCode }),
  );

  return response.data;
}

export async function getAddressCitiesMunicipalities(provinceCode: string) {
  const response = await apiGet<MobileAddressDirectoryItem[]>(
    withQuery('/mobile/address/cities-municipalities', { province_code: provinceCode }),
  );

  return response.data;
}

export async function getAddressBarangays(
  regionCode: string,
  provinceCode: string,
  cityMunicipalityCode: string,
) {
  const response = await apiGet<MobileAddressDirectoryItem[]>(
    withQuery('/mobile/address/barangays', {
      region_code: regionCode,
      province_code: provinceCode,
      city_municipality_code: cityMunicipalityCode,
    }),
  );

  return response.data;
}
