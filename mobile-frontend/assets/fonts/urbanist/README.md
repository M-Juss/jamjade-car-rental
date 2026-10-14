# Urbanist

Static font files from [Corey Hu's Urbanist repository](https://github.com/coreyhu/Urbanist), commit `549716453f76335ccc5a9e537cbe0da03d6fed34`. The included `OFL.txt` covers all six files.

The mobile app loads these local assets through `expo-font` before rendering. Regular, Medium, SemiBold, Bold, ExtraBold, and Black use separate family aliases to support Expo SDK 54, Expo Go, Android, iOS, and web without relying on variable-font support.

Family aliases are defined in `constants/font-families.json`. NativeWind weight utilities and navigation/StyleSheet text use the same aliases. Use `font-sans` for ordinary text and the existing `font-medium`, `font-semibold`, `font-bold`, `font-extrabold`, or `font-black` utilities for emphasis. Nested text can inherit its parent's face.
