function normalizeBackendUrl(value?: string) {
  const rawUrl = value?.trim();

  if (!rawUrl) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_API in web-frontend/.env.local");
  }

  return rawUrl.replace(/\/+$/, "");
}

const LOCAL_API_BASE_URL = normalizeBackendUrl(process.env.NEXT_PUBLIC_BACKEND_API);
const TUNNEL_API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_TUNNEL
  ? normalizeBackendUrl(process.env.NEXT_PUBLIC_BACKEND_API_TUNNEL)
  : null;

function isLoopbackHost(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function getRuntimeApiBaseUrl() {
  if (typeof window === "undefined") return LOCAL_API_BASE_URL;

  const browserHostname = window.location.hostname;

  if (TUNNEL_API_BASE_URL && !isLoopbackHost(browserHostname)) {
    return TUNNEL_API_BASE_URL === "same-origin"
      ? window.location.origin
      : TUNNEL_API_BASE_URL;
  }

  try {
    const apiUrl = new URL(LOCAL_API_BASE_URL);

    if (!isLoopbackHost(apiUrl.hostname) || !isLoopbackHost(browserHostname)) {
      return LOCAL_API_BASE_URL;
    }

    apiUrl.hostname = browserHostname;

    return apiUrl.toString().replace(/\/+$/, "");
  } catch {
    return LOCAL_API_BASE_URL;
  }
}

export function getApiBaseUrl() {
  return getRuntimeApiBaseUrl();
}

export function buildApiUrl(path: string, baseUrl = getRuntimeApiBaseUrl()) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${baseUrl}/${path.replace(/^\/+/, "")}`;
}

const vehicleCutouts: Record<string, string> = {
  "UDEO7laaeVUfknxJp8NpRbBICIpYay8zSyWT3alt.jpg": "toyota-vios-red.png",
  "44Uk0Cq0cGPjXmtZBNMQ58e6IzANtaugZ7pkQQmD.jpg": "honda-brv-2020.png",
  "JneuHefkuFQfyDuBYIO05nbp0pFqd8gejYfo9YpA.jpg": "toyota-avanza-2022.png",
  "Z5P2AorYIAMFLngtJQSFBpLFgVSgZ4YemlWdH5gz.jpg": "toyota-hiace-2019.png",
  "qOZY9KSRWygyWiP5zTKSGBX5RYauxnpz82lG0qqj.jpg": "toyota-hiace-2024.png",
  "T0EQm3GUYyrw6jLJvbxjJ5UiG62lcgmcPHLw9SyC.jpg": "toyota-innova-2025.png",
  "wOwmXCdUwf5nV3KtscuBS82hJAquwAk2qtcwkMtY.jpg": "toyota-innova-2026.png",
  "vtbylE5jp7aRRLaL7hkHwsAKi3ZxCIgmSe1UBcRf.jpg": "toyota-vios-2018.png",
  "KcqPc9z0Blm5rVs5zTpnCszccA5oLBmN4WYf2aTr.jpg": "KcqPc9z0Blm5rVs5zTpnCszccA5oLBmN4WYf2aTr.png",
  "pt5bakd3id0xtzL2n2D4mvQzemO4zgCMpNb9pmFM.jpg": "pt5bakd3id0xtzL2n2D4mvQzemO4zgCMpNb9pmFM.png",
  "pyMhmSrtOhOtHimp3O8q0NA3fWs8DHM6TxXTi8dH.jpg": "pyMhmSrtOhOtHimp3O8q0NA3fWs8DHM6TxXTi8dH.png",
  "5vMtE7loYyW555fQBJn4YvNJ281oEdxx14D2hPpN.jpg": "5vMtE7loYyW555fQBJn4YvNJ281oEdxx14D2hPpN.png",
  "6KGos4nxTV13UxfEy5oe5ZAPJxZ0eQuf4Z1Ug6N6.jpg": "6KGos4nxTV13UxfEy5oe5ZAPJxZ0eQuf4Z1Ug6N6.png",
  "JPwi0KktjWPMVexbLopUQH3RNSSmkVw0mdGwULlT.jpg": "JPwi0KktjWPMVexbLopUQH3RNSSmkVw0mdGwULlT.png",
  "Q36VwEjKR00aQhl8Xv1bPAZzmA89ixBY4zHt1XTC.jpg": "Q36VwEjKR00aQhl8Xv1bPAZzmA89ixBY4zHt1XTC.png",
  "aXFXb7WKmdl9SBoqAbsDBAveQcreZlgZ792Zuwgs.jpg": "aXFXb7WKmdl9SBoqAbsDBAveQcreZlgZ792Zuwgs.png",
  "DvbK2yJURT2zJmXvHudQFEeCfoXzCTofCZRn6KIe.jpg": "DvbK2yJURT2zJmXvHudQFEeCfoXzCTofCZRn6KIe.png",
  "b5FHg4G20jeJaMkKB8s0tVpiBnGWcKZDc8Cyia1F.jpg": "b5FHg4G20jeJaMkKB8s0tVpiBnGWcKZDc8Cyia1F.png",
  "9jFtzMf5wY7v9LymrTBH8f9i3mY5gB2S5VEzl5Of.jpg": "9jFtzMf5wY7v9LymrTBH8f9i3mY5gB2S5VEzl5Of.png",
  "C61PBpaM743g7z3kkwd6mzd1j300zRgSjURTWwsE.jpg": "C61PBpaM743g7z3kkwd6mzd1j300zRgSjURTWwsE.png",
  "a2SQZoWTZ7vFUCEuNqr54475MbgQqptpkqtMcSWr.jpg": "a2SQZoWTZ7vFUCEuNqr54475MbgQqptpkqtMcSWr.png",
  "XXsis72KxgNwFtbZT2Y0mpc6mD3Tbt9SdmWXzctY.jpg": "XXsis72KxgNwFtbZT2Y0mpc6mD3Tbt9SdmWXzctY.png",
  "XeJDPplaog6oqt9Rayx8iDciOv9jPBIRYAA9ai35.jpg": "XeJDPplaog6oqt9Rayx8iDciOv9jPBIRYAA9ai35.png",
  "iiLSPKP3Qgw5ACq2tTc829Chxj8k90BcFwjwtimE.jpg": "iiLSPKP3Qgw5ACq2tTc829Chxj8k90BcFwjwtimE.png",
  "JI7dDZBFmOYCNpbMfSyQSI0ZxhlKsAjKBFdO0fcd.jpg": "JI7dDZBFmOYCNpbMfSyQSI0ZxhlKsAjKBFdO0fcd.png",
  "uf3YrL4Hn7wmGzv3SALEiWw7Cn5Iv2RTe4miXH9h.jpg": "uf3YrL4Hn7wmGzv3SALEiWw7Cn5Iv2RTe4miXH9h.png",
  "i0hDGYHChzO0AUTtWfoAAo78JAgd1ehjee7tL2nk.jpg": "i0hDGYHChzO0AUTtWfoAAo78JAgd1ehjee7tL2nk.png",
  "QPc9JXTdluKJWopbh9pgQK68WIY9hwQ2cA92GoEH.jpg": "QPc9JXTdluKJWopbh9pgQK68WIY9hwQ2cA92GoEH.png",
  "eAn4sPfZwcEienf97EQoVbyQaSz8lZLfADNeyXKE.jpg": "eAn4sPfZwcEienf97EQoVbyQaSz8lZLfADNeyXKE.png",
  "G8vyvLAkWYmpVjaWFAzTyeTWmEumFF5XkGwEF02d.jpg": "G8vyvLAkWYmpVjaWFAzTyeTWmEumFF5XkGwEF02d.png",
  "h0SzY06h62NvTWPdNVO2fpvI0MU4ddjon6akNjX1.jpg": "h0SzY06h62NvTWPdNVO2fpvI0MU4ddjon6akNjX1.png",
  "0XXbSoJx3qnrxwneBD7Ol1v5g2M3i2tlIDonw58s.jpg": "0XXbSoJx3qnrxwneBD7Ol1v5g2M3i2tlIDonw58s.png",
  "KMftff3MhFOjqMkKed27xiPahwdZxjpnhJgGBx3u.jpg": "KMftff3MhFOjqMkKed27xiPahwdZxjpnhJgGBx3u.png",
  "oKZ0BJFSg8qK8yVXfYgRlPI10qY1kiTHuuQrQH9F.jpg": "oKZ0BJFSg8qK8yVXfYgRlPI10qY1kiTHuuQrQH9F.png",
  "rx3Fif6by6wFqx0Q5qX9i2XaSU9EyiB41tUUu8RZ.jpg": "rx3Fif6by6wFqx0Q5qX9i2XaSU9EyiB41tUUu8RZ.png",
  "xMdQDyl7U5ufeq67RLT7mwhwLpAUJe9R1q11IFIk.jpg": "xMdQDyl7U5ufeq67RLT7mwhwLpAUJe9R1q11IFIk.png",
  "tWmDWdkNaBRRlK3UVR0svtY9zTkYXYFhfOp2PZeg.jpg": "tWmDWdkNaBRRlK3UVR0svtY9zTkYXYFhfOp2PZeg.png",
  "iT1vQLlJWNhEQFyprIL3rMMkzzV0HjN8jzuJTkao.jpg": "iT1vQLlJWNhEQFyprIL3rMMkzzV0HjN8jzuJTkao.png",
  "gR11RlHpJx4DsKNB8HFeHUQGg69k7gJG1EgOAlOJ.jpg": "gR11RlHpJx4DsKNB8HFeHUQGg69k7gJG1EgOAlOJ.png",
  "NlE1rpoXz8FhMgLOiKbGxOLF6MnvefttPau4Od8t.jpg": "NlE1rpoXz8FhMgLOiKbGxOLF6MnvefttPau4Od8t.png",
  "fnedG8ej535HriTpfe8PhjvyguHne9aVRVVOXQF7.jpg": "fnedG8ej535HriTpfe8PhjvyguHne9aVRVVOXQF7.png",
  "6fRO17BcrPqfnp07uaeZvfC42cZhPjtCn8jxfcCA.jpg": "6fRO17BcrPqfnp07uaeZvfC42cZhPjtCn8jxfcCA.png",
};

export function resolveAssetUrl(url?: string | null, baseUrl = getRuntimeApiBaseUrl()) {
  const filename = url?.split(/[?#]/, 1)[0].match(/(?:^|\/)vehicles\/([^/]+)$/)?.[1];
  if (filename && vehicleCutouts[filename]) return `/vehicles-transparent/${vehicleCutouts[filename]}`;

  if (!url) return null;

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);

      if (isLoopbackHost(parsed.hostname)) {
        return `${baseUrl}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return url;
    }

    return url;
  }

  return `${baseUrl}/${url.replace(/^\/+/, "")}`;
}
