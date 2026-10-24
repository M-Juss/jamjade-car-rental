# Android-only mobile scope

Decision date: 2026-10-24. `mobile-frontend` supports Android only, using the
existing Expo SDK 54 / React Native 0.81.5 application. iOS and mobile-browser
support are retired. The separate Next.js management website and Laravel API
remain supported.

Telematics and RC pipeline decisions are maintained only in the
[central implementation guide](telematics-master-plan.md). This document records
platform configuration and dated build verification, not an alternate AI roadmap.

## Baseline and boundaries

The prior cross-platform checkpoint is commit `f1ef1e4`, tagged
`checkpoint/pre-android-only-2026-10-23`. Dated iOS/browser evidence in older
guides is historical; it is not a requirement to restore those mobile targets.

Customer, assigned Driver and local/testing Admin RC Research flows remain.
Booking/payment rules, request/response contracts, authorization, saved records,
staff release, calibration thresholds and consent versions are unchanged.
Research read types still accept historical `ios` metadata from the shared API.
No database migration or platform-based backend rejection is introduced.

## Maintained implementation

- Expo explicitly declares `platforms: ["android"]`; the root layout rejects
  unsupported runtimes before session restoration. Build scripts explicitly
  select Android and retain the current package identity and signing setup.
- Only `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` is configured by the mobile
  project. Restrict it to the Android package and signing SHA-1. Existing remote
  iOS environment variables or credentials are not deleted by this refactor.
- Native plugins retain Android foreground/background location permissions,
  photo saving, secure storage and development-client support. The iOS-only
  sensor permission plugin is removed, while `expo-sensors` remains installed.
- Keyboard handling uses the resized Android viewport, `keyboardDidShow` /
  `keyboardDidHide`, safe-area insets and the existing scroll spacer. Modal
  continuation keeps the existing Android scheduling, without iOS dismissal
  callbacks. System Back remains supported.
- Calibration and RC Research keep Android gyroscope x/y/z mapped to
  alpha/beta/gamma, native timestamps, delivered sample gaps and existing units.
  Removing the iOS adapter does not validate sensor axes or numerical limits
  physically.
- Authentication and consent use existing SecureStore keys. Native PayPal
  callbacks and Android Expo Go callbacks remain; mobile-browser callbacks,
  browser storage, browser image picking and browser receipt export are removed.
- Receipt saving retains the 1080-pixel JPEG, gallery permissions and private
  cache cleanup. The shared branding script retains website favicon/Apple touch
  icons, and no longer exports a mobile-browser favicon.
- Apple symbols, iOS-only haptics, `html2canvas`, direct `react-dom` and direct
  `react-native-web` dependencies are removed. Third-party packages may retain
  their own platform files or optional dependencies; do not edit vendored code.

## Verification

Run from `mobile-frontend`:

```bash
npm run lint
npx tsc --noEmit
node --test $(rg --files lib services components -g '*.test.mjs')
npx expo-doctor
npx expo export --platform android
```

Native configuration/dependency changes require a new APK. To synchronize an
existing generated Android project, use
`npx expo prebuild --platform android --no-install`; do not clean or uninstall
an existing app as a routine step. Expo SDK 54 prebuild adds an `ios` launch
script even when generating Android only. After native generation, run
`npm pkg delete scripts.ios scripts.web` and review `package.json` before committing;
keep the declared platforms and maintained scripts Android-only.
Use `npm run build:development` for a
development client or `npm run build:preview` for a standalone internal APK.
An update must use the same signing certificate to preserve installed data.

Physical verification remains an explicit evidence gate. Test small-screen and
large-text forms, keyboards, Back navigation, permission denial and Settings
recovery, document uploads, delivery maps, PayPal return/cancel, receipt saving,
Customer/Driver handover and release, foreground/background sharing, Stop,
sign-out, and RC manual recording. Include cancellation, navigation,
backgrounding, network loss and runtime loss. No location or motion collection
may start without the existing explicit consent and server eligibility.

Background-location verification requires an Android development/installed
build, not Expo Go. Check a recent Android release as well as the older test
phone: Android 11+ background access uses Settings; permission behavior and
battery restrictions vary by OS and vendor. A bundle export or native build
alone does not establish physical GPS, calibration or background reliability.

## Verification record — 2026-10-24

- Mobile lint and TypeScript passed; all 232 Node regressions passed, including
  secure-token persistence, Customer/Driver payment callbacks, recording cleanup,
  and unsupported-runtime collection rejection. The three checkpoint test
  failures were corrected in the test harness/expectations without changing
  production validation.
- Expo Doctor passed 18/18 checks. Android bundle export and native prebuild
  passed. Resolved config/manifest checks verified the Android-only platform,
  preserved package and scheme, a configured native Maps key (value not logged),
  location permissions and `adjustResize`.
- Local `./gradlew :app:assembleDebug --offline` passed for the configured Android
  architectures. The development APK is at
  `mobile-frontend/android/app/build/outputs/apk/debug/app-debug.apk`; it requires
  Metro. No cloud build or application installation was performed.
- The shared branding script passed its syntax check and web lint passed.
  `git diff --check` passed. Laravel and website application code were unchanged.
- No Android device or emulator was connected. Native launch, visual/keyboard
  checks, real payment/upload flows, permissions, sensor axes, moving calibration
  and foreground/background GPS still require the physical checks above.
