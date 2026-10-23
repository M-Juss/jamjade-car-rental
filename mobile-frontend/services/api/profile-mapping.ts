import { getActiveApiBaseUrl } from '@/services/http';

import type { MobileCustomerProfile, MobileUser } from './types';

export function normalizeProfilePhotoUrl(value?: string | null) {
  const imageUrl = value?.trim();

  if (!imageUrl) {
    return '';
  }

  const backendOrigin = new URL(getActiveApiBaseUrl()).origin;
  const localUrl = imageUrl.match(
    /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/.*)$/i,
  );

  if (localUrl) {
    return `${backendOrigin}${localUrl[1]}`;
  }

  if (!/^[a-z][a-z\d+.-]*:/i.test(imageUrl)) {
    return `${backendOrigin}/${imageUrl.replace(/^\/+/, '')}`;
  }

  return imageUrl;
}

export function mapCustomerProfile(profile: MobileCustomerProfile): MobileCustomerProfile {
  return { ...profile, profilePicture: normalizeProfilePhotoUrl(profile.profilePicture) };
}

export function mapUserProfile(user: MobileUser): MobileUser {
  return { ...user, profile: user.profile ? mapCustomerProfile(user.profile) : user.profile };
}
