# Android-only mobile scope

Decision date: 2026-10-24. `mobile-frontend` supports Android only, using the
existing Expo SDK 54 / React Native 0.81.5 application. iOS and mobile-browser
support are retired. The separate Next.js management website and Laravel API
remain supported.

Telematics and RC pipeline decisions are maintained only in the
[central implementation guide](telematics-master-plan.md). This document records
platform configuration and dated build verification, not an alternate AI roadmap.

## Google Play internal test preparation — 2026-11-12

Update — 2026-11-12: version 1.0.1 (code 2) was built with the existing EAS
upload key and published to the active internal track. It includes the current
mobile checkout and the new Customer email-code password recovery flow; see the
[account guide](user-roles-and-access.md#mobile-registration-email-verification).
The corresponding Laravel migration was applied to the local test database, and
the request-validation endpoint returned 422 locally and through the tunnel when
using public DNS. Real email delivery and the installed Android reset flow have
not yet been verified. The computer's normal DNS failed for the tunnel hostname
while public DNS resolved it; device connectivity still requires testing.

The `play-internal` EAS profile in `mobile-frontend/eas.json` produces an Android
App Bundle for Google Play and uses the EAS `production` environment. That
environment is temporarily configured with the existing HTTPS tunnel to the
local Laravel API and the Android Maps key. Replace its backend configuration
before any later production build; this is an internal-test setup, not a hosted
production backend. Keep the local database, Laravel, Next.js proxy and tunnel
running during testing. Changing the API hostname requires a new native build.

The Play app retains `com.anonymous.jamjadecarrental`. EAS has an existing
release upload keystore; its certificate differs from the debug certificate on
the locally installed test APK. Do not uninstall that APK or clear its data to
install a Play build while its encrypted research recordings must be preserved.
Use another Android device for independent testing;
the Play-signed certificate and Android Maps key restriction must also be checked.

The original Play Console app and version 1.0.0 (code 1) internal release were created
and published. At that checkpoint the track had no selected tester list; it has since
been activated with a tester list. Google displayed a warning that no
deobfuscation file was attached. Lint,
TypeScript, Expo Doctor (18/18), and Android JavaScript export passed. The EAS
bundle build completed, and ZIP integrity and upload-signature verification passed.
The mobile Node suite had 302 passes and one failure: the existing vehicle-image
test expects 7 catalog entries while the current uncommitted catalog has 42.
Tester access, Maps, physical customer/driver flows, background location and RC
motion remain to be verified. Existing uncommitted application work was included
in the build input.

## App-only backend DNS fallback — 2026-11-06

The user authorized Google encrypted DNS fallback inside JamJade after declining
phone-wide Private DNS changes and a mobile-data test. The existing ngrok
endpoint and Laravel/Next.js services were healthy, but the Wi-Fi resolver returned
NXDOMAIN for that endpoint on both Mac and Redmi. Public resolvers returned valid
records; an HTTPS check with correct DNS reached Laravel. A direct Redmi-to-Mac
LAN probe timed out even though the devices shared a subnet.

`mobile-frontend/modules/backend-network` uses Expo's application lifecycle hook
to configure React Native's existing OkHttp transport before app requests. The
Android-only config plugin derives an exact hostname allowlist from the existing
configured HTTPS API URLs and writes generated manifest metadata. System DNS is
always tried first. Only a failed lookup for an allowlisted backend uses Google's
DNS-over-HTTPS JSON service, through a separate credential-free client with no
app cookies/interceptors, no redirects, a 2.5-second call limit and a bounded
response. `edns_client_subnet=0.0.0.0/0` avoids forwarding a client subnet to
authoritative DNS. Google still receives the queried hostname and network IP.

The fallback accepts public IPv4 answers only, rejects failed/malformed queries,
private addresses and oversized responses, and caches positive results in memory
up to the shortest answer/CNAME TTL with a five-minute cap. Failed lookups are not
cached. API authorization, request mapping, TLS certificate/hostname checks and
recording storage/upload contracts are unchanged. No phone network settings,
new tunnel, public download link or hardcoded backend IP were introduced. Other
network stacks that do not use React Native's OkHttp provider are not covered by
this implementation; it is not a device-wide DNS replacement.

Verification: mobile lint and TypeScript, 280 Node checks (including plugin
allowlist/idempotence tests), 10 new native DNS regressions, 29 existing native
recorder tests, Expo Doctor 18/18 and the ARM64 standalone release build passed.
The APK signature matched the installed app; update installation and launch
succeeded without uninstalling or clearing data. The read-only vehicle browser
then generated a new mobile vehicle API request through the existing ngrok
inspector with **200 OK** over Wi-Fi. Protected sign-in/research/upload flows are
separate from this unauthenticated connectivity check. RC sensor accuracy and
background reliability were not evaluated by this network change.

The local internal APK is `builds/jamjade-wifi-dns-fallback.apk` in the external
JamJade documents directory, with the normal ignored build output under
`mobile-frontend/android/app/build/outputs/apk/release/`. Rebuild after changing
configured API hostnames; do not edit generated allowlists manually. See the
[mobile networking notes](../mobile-frontend/README.md) and
[Google DoH specification](https://developers.google.com/speed/public-dns/docs/doh/json).

## Standalone Redmi test APK — 2026-11-04

Update — 2026-11-11: rebuilt the ARM64 standalone release with the current
mobile sources and bundled assets, then installed it on the connected Redmi
using `adb install -r`. The new APK certificate matched the installed app.
Installation succeeded without uninstalling or clearing app data. The birthdate
picker in `components/ui/DatePickerInput.tsx` now lays out explicit seven-cell
week rows rather than relying on percentage-width wrapping. The APK remains at
`mobile-frontend/android/app/build/outputs/apk/release/app-release.apk`.
The release build passed; additional automated and visual checks were omitted
at the user's request, so calendar appearance remains for manual review.

A local `:app:assembleRelease -PreactNativeArchitectures=arm64-v8a` build completed
using the existing generated Android project, Node 24.22.1 and Java 17. No native
configuration, permissions, dependencies or sensor algorithms were changed.
The 59.7 MiB APK is at
`mobile-frontend/android/app/build/outputs/apk/release/app-release.apk` (ignored).
It contains the bundled JavaScript/assets and the verified existing HTTPS API
configuration. It is non-debuggable, targets ARM64, and retains package
`com.anonymous.jamjadecarrental`, version code 1 / version 1.0.0. Its existing
local debug certificate is suitable for this internal update, not store release.

The signing certificate matched the installed development APK before installation.
An idle recorder-service check found no active RC service. An aggregate inventory
of 253 encrypted research files was recorded before the update without decrypting
or copying their contents. `adb install -r` completed successfully; no uninstall,
clear-data or recording migration was performed. Old Metro USB port forwarding
was removed before launching `mobilefrontend://rc-research`. The new app process
was running with no fatal startup/uncaught-native-module error markers in the
bounded check. The device disconnected from ADB during the remaining launch wait.
The user subsequently confirmed that the app opens without the QR/development
screen and the old recordings are visible. The temporary pulled development APK
was removed after that confirmation. A new unplugged capture/upload smoke check
remains pending; launch and record visibility do not establish collection accuracy,
successful decryption/export of every original, or background reliability.

The configured API currently uses the existing website HTTPS tunnel and Next.js
`/api` proxy to Laravel, not the separate Metro tunnel. Unauthenticated access
checks returned Laravel's expected 401 through both the local API and that
existing HTTPS route. No new public endpoint was opened. For online research
access/login/uploads, keep Laravel, Next.js and its tunnel running; neither Metro
nor USB is needed by this APK. Originals remain local until an explicit upload.
Changing the embedded API address or mobile code requires a replacement APK;
website/backend-only edits do not. Do not replace this certificate or uninstall
the app while local encrypted originals must be retained.

Mobile lint and TypeScript passed, as did all 22 focused native recorder/upload
adapter regressions. Expo dependency validation used the installed SDK 54 local
map and reported dependencies up to date, with online-version validation unavailable
under the network sandbox. The APK build passed. The build log was sanitized of
configured environment values; no APK/source/recording was uploaded to a new service.
See the [local standalone workflow](../mobile-frontend/README.md#standalone-android-demonstrations).

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
