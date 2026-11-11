import type { ImageSourcePropType } from 'react-native';

// Match the original upload, not the vehicle/model, so replacement photos stay current.
const transparentVehicleImages: Record<string, ImageSourcePropType> = {
  'UDEO7laaeVUfknxJp8NpRbBICIpYay8zSyWT3alt.jpg': require('../../assets/images/vehicles/toyota-vios-red.png'),
  '44Uk0Cq0cGPjXmtZBNMQ58e6IzANtaugZ7pkQQmD.jpg': require('../../assets/images/vehicles/honda-brv-2020.png'),
  'JneuHefkuFQfyDuBYIO05nbp0pFqd8gejYfo9YpA.jpg': require('../../assets/images/vehicles/toyota-avanza-2022.png'),
  'Z5P2AorYIAMFLngtJQSFBpLFgVSgZ4YemlWdH5gz.jpg': require('../../assets/images/vehicles/toyota-hiace-2019.png'),
  'qOZY9KSRWygyWiP5zTKSGBX5RYauxnpz82lG0qqj.jpg': require('../../assets/images/vehicles/toyota-hiace-2024.png'),
  'T0EQm3GUYyrw6jLJvbxjJ5UiG62lcgmcPHLw9SyC.jpg': require('../../assets/images/vehicles/toyota-innova-2025.png'),
  'wOwmXCdUwf5nV3KtscuBS82hJAquwAk2qtcwkMtY.jpg': require('../../assets/images/vehicles/toyota-innova-2026.png'),
  'vtbylE5jp7aRRLaL7hkHwsAKi3ZxCIgmSe1UBcRf.jpg': require('../../assets/images/vehicles/toyota-vios-2018.png'),
  'KcqPc9z0Blm5rVs5zTpnCszccA5oLBmN4WYf2aTr.jpg': require('../../assets/images/vehicles/KcqPc9z0Blm5rVs5zTpnCszccA5oLBmN4WYf2aTr.png'),
  'pt5bakd3id0xtzL2n2D4mvQzemO4zgCMpNb9pmFM.jpg': require('../../assets/images/vehicles/pt5bakd3id0xtzL2n2D4mvQzemO4zgCMpNb9pmFM.png'),
  'pyMhmSrtOhOtHimp3O8q0NA3fWs8DHM6TxXTi8dH.jpg': require('../../assets/images/vehicles/pyMhmSrtOhOtHimp3O8q0NA3fWs8DHM6TxXTi8dH.png'),
  '5vMtE7loYyW555fQBJn4YvNJ281oEdxx14D2hPpN.jpg': require('../../assets/images/vehicles/5vMtE7loYyW555fQBJn4YvNJ281oEdxx14D2hPpN.png'),
  '6KGos4nxTV13UxfEy5oe5ZAPJxZ0eQuf4Z1Ug6N6.jpg': require('../../assets/images/vehicles/6KGos4nxTV13UxfEy5oe5ZAPJxZ0eQuf4Z1Ug6N6.png'),
  'JPwi0KktjWPMVexbLopUQH3RNSSmkVw0mdGwULlT.jpg': require('../../assets/images/vehicles/JPwi0KktjWPMVexbLopUQH3RNSSmkVw0mdGwULlT.png'),
  'Q36VwEjKR00aQhl8Xv1bPAZzmA89ixBY4zHt1XTC.jpg': require('../../assets/images/vehicles/Q36VwEjKR00aQhl8Xv1bPAZzmA89ixBY4zHt1XTC.png'),
  'aXFXb7WKmdl9SBoqAbsDBAveQcreZlgZ792Zuwgs.jpg': require('../../assets/images/vehicles/aXFXb7WKmdl9SBoqAbsDBAveQcreZlgZ792Zuwgs.png'),
  'DvbK2yJURT2zJmXvHudQFEeCfoXzCTofCZRn6KIe.jpg': require('../../assets/images/vehicles/DvbK2yJURT2zJmXvHudQFEeCfoXzCTofCZRn6KIe.png'),
  'b5FHg4G20jeJaMkKB8s0tVpiBnGWcKZDc8Cyia1F.jpg': require('../../assets/images/vehicles/b5FHg4G20jeJaMkKB8s0tVpiBnGWcKZDc8Cyia1F.png'),
  '9jFtzMf5wY7v9LymrTBH8f9i3mY5gB2S5VEzl5Of.jpg': require('../../assets/images/vehicles/9jFtzMf5wY7v9LymrTBH8f9i3mY5gB2S5VEzl5Of.png'),
  'C61PBpaM743g7z3kkwd6mzd1j300zRgSjURTWwsE.jpg': require('../../assets/images/vehicles/C61PBpaM743g7z3kkwd6mzd1j300zRgSjURTWwsE.png'),
  'a2SQZoWTZ7vFUCEuNqr54475MbgQqptpkqtMcSWr.jpg': require('../../assets/images/vehicles/a2SQZoWTZ7vFUCEuNqr54475MbgQqptpkqtMcSWr.png'),
  'XXsis72KxgNwFtbZT2Y0mpc6mD3Tbt9SdmWXzctY.jpg': require('../../assets/images/vehicles/XXsis72KxgNwFtbZT2Y0mpc6mD3Tbt9SdmWXzctY.png'),
  'XeJDPplaog6oqt9Rayx8iDciOv9jPBIRYAA9ai35.jpg': require('../../assets/images/vehicles/XeJDPplaog6oqt9Rayx8iDciOv9jPBIRYAA9ai35.png'),
  'iiLSPKP3Qgw5ACq2tTc829Chxj8k90BcFwjwtimE.jpg': require('../../assets/images/vehicles/iiLSPKP3Qgw5ACq2tTc829Chxj8k90BcFwjwtimE.png'),
  'JI7dDZBFmOYCNpbMfSyQSI0ZxhlKsAjKBFdO0fcd.jpg': require('../../assets/images/vehicles/JI7dDZBFmOYCNpbMfSyQSI0ZxhlKsAjKBFdO0fcd.png'),
  'uf3YrL4Hn7wmGzv3SALEiWw7Cn5Iv2RTe4miXH9h.jpg': require('../../assets/images/vehicles/uf3YrL4Hn7wmGzv3SALEiWw7Cn5Iv2RTe4miXH9h.png'),
  'i0hDGYHChzO0AUTtWfoAAo78JAgd1ehjee7tL2nk.jpg': require('../../assets/images/vehicles/i0hDGYHChzO0AUTtWfoAAo78JAgd1ehjee7tL2nk.png'),
  'QPc9JXTdluKJWopbh9pgQK68WIY9hwQ2cA92GoEH.jpg': require('../../assets/images/vehicles/QPc9JXTdluKJWopbh9pgQK68WIY9hwQ2cA92GoEH.png'),
  'eAn4sPfZwcEienf97EQoVbyQaSz8lZLfADNeyXKE.jpg': require('../../assets/images/vehicles/eAn4sPfZwcEienf97EQoVbyQaSz8lZLfADNeyXKE.png'),
  'G8vyvLAkWYmpVjaWFAzTyeTWmEumFF5XkGwEF02d.jpg': require('../../assets/images/vehicles/G8vyvLAkWYmpVjaWFAzTyeTWmEumFF5XkGwEF02d.png'),
  'h0SzY06h62NvTWPdNVO2fpvI0MU4ddjon6akNjX1.jpg': require('../../assets/images/vehicles/h0SzY06h62NvTWPdNVO2fpvI0MU4ddjon6akNjX1.png'),
  '0XXbSoJx3qnrxwneBD7Ol1v5g2M3i2tlIDonw58s.jpg': require('../../assets/images/vehicles/0XXbSoJx3qnrxwneBD7Ol1v5g2M3i2tlIDonw58s.png'),
  'KMftff3MhFOjqMkKed27xiPahwdZxjpnhJgGBx3u.jpg': require('../../assets/images/vehicles/KMftff3MhFOjqMkKed27xiPahwdZxjpnhJgGBx3u.png'),
  'oKZ0BJFSg8qK8yVXfYgRlPI10qY1kiTHuuQrQH9F.jpg': require('../../assets/images/vehicles/oKZ0BJFSg8qK8yVXfYgRlPI10qY1kiTHuuQrQH9F.png'),
  'rx3Fif6by6wFqx0Q5qX9i2XaSU9EyiB41tUUu8RZ.jpg': require('../../assets/images/vehicles/rx3Fif6by6wFqx0Q5qX9i2XaSU9EyiB41tUUu8RZ.png'),
  'xMdQDyl7U5ufeq67RLT7mwhwLpAUJe9R1q11IFIk.jpg': require('../../assets/images/vehicles/xMdQDyl7U5ufeq67RLT7mwhwLpAUJe9R1q11IFIk.png'),
  'tWmDWdkNaBRRlK3UVR0svtY9zTkYXYFhfOp2PZeg.jpg': require('../../assets/images/vehicles/tWmDWdkNaBRRlK3UVR0svtY9zTkYXYFhfOp2PZeg.png'),
  'iT1vQLlJWNhEQFyprIL3rMMkzzV0HjN8jzuJTkao.jpg': require('../../assets/images/vehicles/iT1vQLlJWNhEQFyprIL3rMMkzzV0HjN8jzuJTkao.png'),
  'gR11RlHpJx4DsKNB8HFeHUQGg69k7gJG1EgOAlOJ.jpg': require('../../assets/images/vehicles/gR11RlHpJx4DsKNB8HFeHUQGg69k7gJG1EgOAlOJ.png'),
  'NlE1rpoXz8FhMgLOiKbGxOLF6MnvefttPau4Od8t.jpg': require('../../assets/images/vehicles/NlE1rpoXz8FhMgLOiKbGxOLF6MnvefttPau4Od8t.png'),
  'fnedG8ej535HriTpfe8PhjvyguHne9aVRVVOXQF7.jpg': require('../../assets/images/vehicles/fnedG8ej535HriTpfe8PhjvyguHne9aVRVVOXQF7.png'),
  '6fRO17BcrPqfnp07uaeZvfC42cZhPjtCn8jxfcCA.jpg': require('../../assets/images/vehicles/6fRO17BcrPqfnp07uaeZvfC42cZhPjtCn8jxfcCA.png'),
};

export function getVehicleImageSource(uri?: string | null): ImageSourcePropType | undefined {
  if (!uri) return undefined;

  const path = uri.split(/[?#]/, 1)[0];
  const filename = path.match(/(?:^|\/)vehicles\/([^/]+)$/)?.[1];
  return (filename && transparentVehicleImages[filename]) || { uri };
}
