# JamJade Mobile

Android-only Expo application for Customers and assigned Drivers using the JamJade Laravel API. iOS and mobile-browser targets are retired; the separate Next.js management website remains supported. See [Android-only mobile scope](../docs/android-only-mobile.md).

Use the repository [documentation map](../docs/README.md) to locate the current
booking, delivery, verification, geofence, and telematics contracts before
changing a cross-application flow.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example`.

   Home/LAN mode derives the API host from Expo and uses port `8000`. For defense/demo use, set `EXPO_PUBLIC_BACKEND_TUNNEL_API` to the separate HTTPS tunnel exposing Laravel. Custom API URLs must end with `/api`.

3. Start Laravel so the phone can reach it:

   ```bash
   cd ../backend
   composer run serve-mobile
   ```

   This uses the repository PHP upload configuration: up to 5 MB per
   image and up to 12 MB for a request containing front and back images.

4. Start Expo:

   ```bash
   npm start
   ```

   Use `npm start -- --tunnel` when the phone cannot directly reach the computer running Expo. Expo's tunnel exposes Metro only, so Laravel still needs its own tunnel URL in `EXPO_PUBLIC_BACKEND_TUNNEL_API`.

The API client prefers LAN at home and the configured backend tunnel when Expo is in tunnel mode. If the preferred endpoint cannot connect, it tries the other endpoint and remembers the working one for later requests.

### Android development over USB

If the Expo tunnel fails, connect the phone by USB with debugging enabled and
authorize the Mac on the phone. With Laravel running on port `8000`, run:

```bash
adb reverse tcp:8000 tcp:8000
npx expo start --dev-client --localhost --clear --android
```

Expo opens the installed development client and forwards Metro's port `8081`
over USB. Laravel's separate forwarding lets the derived local API URL reach
the Mac too. Keep the cable connected and Metro running; the phone and Mac do
not need to share Wi-Fi for these forwarded ports. This requires an installed
development build, and JavaScript-only fixes can be loaded without rebuilding it.

## Defense Tunnel

1. Keep Laravel running with `composer run serve-mobile`.
2. Install and authenticate a current ngrok agent once, then expose Laravel:

   ```bash
   ngrok config add-authtoken YOUR_PRIVATE_TOKEN
   ngrok http 8000
   ```

   The `@expo/ngrok` dependency is used internally by Expo's Metro tunnel.
   Do not use its bundled `node_modules/.bin/ngrok` executable for the
   Laravel tunnel because that legacy agent may no longer be accepted by
   ngrok.
3. Put the HTTPS forwarding URL in `.env.local`, appending `/api`:

   ```bash
   EXPO_PUBLIC_BACKEND_TUNNEL_API=https://your-ngrok-domain.ngrok-free.app/api
   ```

4. Restart Expo with `npm start -- --tunnel --clear`.

## Standalone Android Demonstrations

The `preview` EAS profile produces a release APK with the JavaScript and assets
bundled inside it. After installation, it opens from the phone's app icon without
USB, Expo Go, or a running Metro server. The `development` profile remains the
profile for coding with live updates.

For a native development client, use the `development` profile and then start
Metro for that client:

Configure the existing restricted `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` in the project's EAS **development**
environment before building. Use Sensitive visibility. The ignored `.env.local`
file supplies local builds and Metro, but is not uploaded to EAS. A key available
to JavaScript does not prove that an installed app contains its native Maps key.

```bash
npx eas-cli build --platform android --profile development
npx expo start --dev-client
```

Use `preview` for the standalone internal APK described below. Native plugins,
permissions, Maps SDK keys, splash, icons, and bundled assets require a new
build; Metro reloads only update a development client.

If selecting a delivery address fails with Android's `API key not found` error,
rebuild with the configured native Maps key and install the resulting APK. Use
the same signing certificate as the installed app to preserve its data. A local
debug APK and an EAS-signed APK may use different certificates; Android rejects
an update between them. Do not uninstall the existing app as a routine fix.

1. Keep Laravel and its HTTPS tunnel running, or use a hosted Laravel API.
2. In the project's EAS **preview** environment, configure
   `EXPO_PUBLIC_BACKEND_API` with the reachable HTTPS API URL ending in `/api`,
   plus `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` with the existing restricted SDK key.
   Use Sensitive visibility to avoid printing their values in build logs.
   These are client configuration values embedded in the app, not server secrets.
   The ignored `.env.local` file is not uploaded to EAS Build.
3. From `mobile-frontend`, run:

   ```bash
   npx eas-cli build --platform android --profile preview
   ```

4. Open the completed build's installation link in the phone's browser, download
   the APK, and install it. Launch **JamJade Car Rental** from the app drawer.
   Choose No if EAS asks to install on an emulator and the target is a real phone.

The welcome screen can open without the backend, but login, vehicle browsing,
bookings, uploads, and payments still require internet access to Laravel. A tunnel
does not host Laravel: the computer running it must stay online. If the API tunnel
URL changes, update the EAS preview variable and build a new APK. Code and bundled
asset changes also require a new preview APK; Metro reloads do not update it.

If the mobile API uses the management website’s tunnel and Next.js proxies `/api` to Laravel, also set backend `PAYPAL_CALLBACK_ORIGIN` to that public origin (without `/api`). Set the mobile `EXPO_PUBLIC_BACKEND_TUNNEL_API` to the same origin with `/api` appended. The explicit callback origin keeps PayPal return/cancel and Android fallback links reachable when the proxy sends Laravel a loopback Host. Refresh Laravel configuration and start a new checkout after changing it; existing PayPal orders retain their original return URLs. Keep both values synchronized when a temporary tunnel changes.

Laravel recognizes the HTTPS protocol forwarded by a tunnel connecting through
`127.0.0.1` or `::1`, so generated photo links use HTTPS too. Direct HTTP/LAN
requests retain HTTP links. A hosted backend behind a different reverse proxy
must configure that proxy's trusted addresses explicitly; do not trust all
incoming forwarded headers. Correcting server-generated photo links does not
require rebuilding the APK. Reopen the vehicle list to fetch the corrected links.

## Typography

Urbanist is bundled in `assets/fonts/urbanist` and loaded through the installed `expo-font` library at startup. It works in Expo Go and development builds without a new native font plugin or runtime font downloads. The font license and source are included beside the assets.

Use `font-sans` for base text and existing NativeWind weight classes for emphasis. Each weight resolves to its corresponding static font face. StyleSheet and navigation text use `fontFamilies` from `constants/fonts.ts`. Keep the font aliases aligned with `constants/font-families.json`.

## Mobile Layout

The mobile UI uses the existing JamJade light palette with compact white surfaces, pill actions, and Urbanist typography. `constants/layout.json` defines shared spacing, control heights, radii, and text sizes. NativeWind consumes these tokens through `tailwind.config.js`; calculated navigation styles use `mobileLayout` from `constants/layout.ts`.

Use `px-screen`, `p-card`, `rounded-card`, `rounded-field`, and the `text-title`, `text-section`, `text-body`, `text-caption`, and `text-button` utilities when their roles fit. Keep screen content scrollable, leave validation messages in normal layout flow, and apply safe-area insets at screen or footer boundaries. Shared controls live in `components/common` and `components/ui`.

The splash plugin uses the same solid-blue JamJade logo as the website header on the light background. Configuration changes require a new native build. Verify the final splash on Android release builds; Expo Go and development builds do not fully represent the release splash.

## Branding

`web-frontend/public/JamJadeLogo-solid.png` is the branding source. Website headers, login, footer, mobile headers, and booking PDFs use that artwork. Run `npm run branding:sync` from `web-frontend/` after updating it to copy the mobile and backend PDF logos and export the browser favicon, Apple touch icon, opaque app icon, and Android adaptive/themed icon layers. It uses the image tooling already installed with Next.js, applies the web primary color, and preserves the artwork's silhouette, transparency, and proportions.

`app.json` references the mobile icon and splash exports. Android uses a white background and a transparent foreground with padding for launcher masks; the launcher determines the outer icon shape. The monochrome layer preserves the same silhouette for themed icons. The shared sync command still creates website favicon and Apple touch-icon assets for the separate Next.js website. Native icon and splash changes require rebuilding the Android app. If a generated `android/` project exists, synchronize it with `npx expo prebuild --platform android --no-install` before the next native build; do not use a destructive clean as routine maintenance. Expo SDK 54 can recreate an iOS launch script during generation; run `npm pkg delete scripts.ios scripts.web` afterward and review the package diff.

## Settlement Payments

Customer and Driver settlement screens share a compact amount card. Customer payments distinguish the remaining rental balance, unpaid additional charges, and a combined balance. Each charge shows its staff-entered description and the API's `outstandingAmount`, which accounts for completed payment allocations; fully paid and other-responsibility charges are excluded. Exact Philippine-peso amounts are shown, including centavos.

The pickup-deadline warning appears only for a pending/confirmed booking with a partially paid rental balance, a down payment, and a saved deadline. Return charges do not show that warning. Payment results re-read the booking before showing deadline wording, and an order whose amount changed must be reviewed before PayPal opens.

## Form Keyboard Handling

Android uses native `adjustResize` at the screen or modal boundary. Do not add a second JavaScript keyboard-resizing wrapper. Preserve safe-area insets and keep footer actions inside the resized boundary.

Use `KeyboardFormScrollView` for editable form content and `KeyboardAwareField`
around custom inputs. `InputWithLabel`, `FormInput`, and location search already
register their field blocks. Focus, keyboard changes, viewport changes, and
validation layout changes remeasure the field and scroll only when it is outside
the visible area. The measured area includes labels and validation messages,
with 12 points of clearance. Fixed footer actions stay outside the scroll view
and inside the keyboard-resizing boundary. Keep validation messages in layout
flow and avoid nested keyboard-avoidance boundaries.

Render helper/error rows only when they have a message; do not leave empty rows
mounted with NativeWind `hidden` (`display: none`). React Native 0.81.5's Yoga
layout can abort with a node-owner assertion after keyboard resizing followed by
typing when hidden descendants remain in the form. This native assertion was
observed in the Android development-client crash log on 2026-10-14; conditional
message rows avoid the trigger without changing the native build. See the
[upstream Yoga fix](https://github.com/react/react-native/commit/6fa330693fba313a2fe1121545c1efd558b60983).

After reloading the corrected bundle over USB on 2026-10-14, the user confirmed
that typing in both login fields, switching fields, and scrolling with the
keyboard open kept the Redmi Note 8 Pro (Android 11) development client open.
The app process stayed running and the latest native crash remained the earlier
pre-fix record. This verifies the reported login crash; other form flows remained pending at that time. iOS was retired on 2026-10-24.

When the keyboard opens, the scroll content also gains a temporary spacer equal
to its reported height. This extra scroll space lets the final fields and actions
move farther above the keyboard. The spacer updates when the keyboard changes
size and disappears when it closes; it does not resize the screen a second time.
On Android, scrolling keeps the keyboard open (`keyboardDismissMode="none"`),
so dragging through the form does not immediately remove the temporary spacer.
The system Back control can dismiss the keyboard when the user is finished.

The standalone scroll-geometry regression checks use Node 22.18 or newer:

```bash
node --test lib/keyboard/scroll-offset.test.mjs
```

Native smoke checks must cover login/registration, onboarding, personal and
emergency-contact sheets, credential sheets, booking delivery fields, and price
filters. On Android, focus the last field, switch backward/forward,
show validation errors, enter multiline text, and reach the submit action with
the keyboard open. Repeat with a small screen, larger text, and phone/decimal
keypads. Verify keyboard dismissal restores the normal layout. Browser viewport
checks and native exports do not confirm real software-keyboard behavior.

## Account Information

Customer setup resumes from persisted profile data after sign-in and session
restoration. Authenticated Customers cannot open customer tabs, vehicle browsing,
bookings, or profile routes until Basic Info, the saved/skipped Emergency Contact
step, and Driving Preference are complete. Public guest browsing and Driver
navigation remain available. Document review is separate from account setup.
Failed progress reads show a retry screen rather than guessing the next step.
Onboarding saves refresh the profile before navigating forward.

The standalone onboarding routing checks use Node 22.18 or newer:

```bash
node --test lib/customer/onboarding.test.mjs
```

The Customer Profile separates Personal Information from Account Information. Personal/onboarding saves contain no email or password fields. Account forms use `validation/account/schemas.ts` and `services/api/account.service.ts`:

- `PUT /mobile/account/email`: new email and current password. Laravel normalizes and checks uniqueness, changes the sign-in email immediately, and clears any previous email verification timestamp. No verification email or OTP is sent in this phase.
- `PUT /mobile/account/password`: current password, new password, and confirmation. Laravel verifies the current password, hashes the replacement, rotates the remember token, and revokes existing mobile tokens. The app clears its session and shows a sign-in notice after success.

These endpoints require an active Customer account and allow five combined attempts per minute per account. New passwords follow the current minimum of eight characters, must differ from the current password, and are limited to 72 UTF-8 bytes for bcrypt. Password inputs are not trimmed, persisted in the customer store, or logged. Changing an account does not require a completed personal profile.

## Telematics and RC research

Read the [central implementation guide](../docs/telematics-master-plan.md) for
current contracts, agreed pipeline, data/inspection UI, sequencing, and evidence.
It replaces the previous separate telematics/calibration/research guides.

Existing Customer Self Drive and assigned-Driver setup use Laravel eligibility,
six readiness checks, five explicitly consented foreground calibration captures,
and staff-controlled release. Released latest-GPS sharing has separate consent
and foreground/background modes. The readiness task is inert; the rental location
task is distinct. Neither collects continuous rental motion.

The separate Admin RC Research screen's Collect tab now uses
`modules/rc-recorder`: independent original Android sensor streams, a visible
foreground service and native Stop notification, encrypted local checkpoints,
interrupted-record recovery and explicit deletion. Local records are unlabeled;
the phone shows per-channel counts, delivered rate and gaps. No resampling,
filtering, vehicle alignment or AI occurs during this capture. Start/unlock needs
online research access verification; an authorized recording can continue offline
until its bounded lease expires. The new flow needs a rebuilt Android client.

Adapter 1.1.0 adds create/select collection groups with durable UUIDs and automatic
recording numbering. The `MN-82S roof mount` preset locks the RC model and phone
orientation. The Collect form also fixes the mount method to **Adjustable screw**
for the confirmed phone holder, using the existing native text field;
this form/validation change only needs Metro reload with adapter 1.1.0 installed.
Groups fill editable surface, slope and purpose defaults. Each recording saves
its own snapshot. New group names are generated as `Tiles - Level - Group 01`
from the selected surface/slope, with an unused number and no typing. Existing
groups keep their names. Manual angle and RC battery inputs are removed and
remain unmeasured in new files. Phone battery/charging/Battery Saver
are read automatically, with recording power snapshots under consent version 3.
Older APKs need updating for the new group APIs. Group IDs are local/owner-bound;
they are distinct from runtime `collection_session_id` and do not establish valid
calibration or independently split training data.

Adapter **1.2.0** adds verified bounded chunk exports and explicit upload/retry from
Saved on this phone. The separate encrypted transfer receipt survives restarts;
an interrupted upload needs an explicit retry. Server acknowledgment requires the
complete verified inventory. Local originals remain after upload; Delete local
recording does not remove a server copy. Automatic background upload and remote
v2 deletion management are not implemented. Install this compatible APK as an update.

Data shows historical uploaded v1 trials. The Admin website defaults to native v2
recordings and provides bounded original channel charts plus interval statistics.
Earlier trials (v1) remain separately readable. Local-only originals
are lost on uninstall/app-data clearing or Keystore loss; update using compatible
signing rather than uninstalling. Retention, quotas, framing and authorization
are defined in the central guide. Processing/export, ML, scoring and report-ready
notifications remain targets. Redmi foreground and short screen-lock capture
summaries have been checked, including a reported 60-second unplugged/locked
interval. Raw noise/axes, longer-duration background and interruption recovery
remain unverified; see the central guide for the exact evidence and limits.

For local native verification, from `mobile-frontend/android/`:

```bash
./gradlew :jamjade-rc-recorder:testDebugUnitTest :app:assembleDebug --offline
```

The development APK is `android/app/build/outputs/apk/debug/app-debug.apk` and
needs Metro (`npx expo start --dev-client` from `mobile-frontend/`). Use the
existing preview profile when a bundled standalone APK is required. Local module
sources and its manifest survive Android regeneration through Expo autolinking;
do not copy them into the disposable generated app project. Expo Go/older clients
show an explicit build requirement and cannot fall back to v1 capture.

## API Structure

- `services/http`: base URL, bearer-token injection, SecureStore persistence, response parsing, and API errors.
- `services/api`: domain-specific API payloads and calls.
- `providers/AuthProvider.tsx`: session restoration and current authenticated user.
- `components/auth/AuthenticatedOnly.tsx`: protection for customer-only route groups.

`forms/account/ChangeEmailForm.tsx` and `ChangePasswordForm.tsx` use
React Hook Form and `validation/account/schemas.ts`; their request mapping stays
in `services/api/account.service.ts`. Personal profile and onboarding forms use
the profile schemas and service separately. Keep Laravel field names in the
service boundary and map server `422` errors to the corresponding mobile field.

PayPal callbacks are owned by `lib/payments/paypal-callbacks.ts`, while
`app/+native-intent.ts` consumes the registered `mobilefrontend://paypal/return`
and `cancel` paths for installed builds. Keep those paths synchronized with the
scheme in `app.json`; Android Expo Go callbacks use Expo's generated URL.

`app.json` owns native plugins, permissions, splash, edge-to-edge behavior, and
the `mobilefrontend` scheme. `app.config.ts` supplies the Android Maps SDK
key from the environment variables documented in `.env.example`. Native
permission, plugin, Maps-key, splash, icon, or bundled-asset changes require a
new development or preview build.

## Verification

From `mobile-frontend/`, run the installed checks as appropriate:

```bash
npm run lint
npx tsc --noEmit
npx expo-doctor
node --test $(rg --files lib services components -g '*.test.mjs')
npx expo export --platform android
```

The mobile test foundation is not configured yet. Establish it in a dedicated
task before adding Jest or React Native Testing Library tests. Smoke-test
permission, map, callback, safe-area, and edge-to-edge changes on Android when devices or development builds are available.

Web admin authentication remains cookie/CSRF based. Mobile authentication uses Sanctum bearer tokens stored with Expo SecureStore.

### Delivery maps

Delivery uses the SDK 54-compatible `react-native-maps` package with Google rendering. Configure the restricted Android SDK key from `.env.example` and rebuild a development client after native key changes. Places/Routes REST calls go through Laravel using its server-only key. Pricing Settings edits delivery rates and preserves the garage point configured in Laravel. No device location permission is requested by delivery pin selection. See [delivery pricing](../docs/delivery-pricing.md) for automatic delivery confirmation, quote expiry, deferred actual tolls, interrupted requests and verification limits.

## Payment receipts

Successful Customer checkout opens the receipt for its exact PayPal order.
Booking Details → Receipts reopens individual saved receipts, ten at a time.
Receipt data comes from the authenticated Laravel receipt API;
older receipt amounts do not change after later payments. A download failure
retries only receipt access, never payment capture. Driver checkout is unchanged.
See [the receipt contract](../docs/booking-financial-documents.md#customer-mobile-receipt-access).

Save receipt exports the displayed receipt, including its balance and deadline,
at 1080 pixels wide without the header, navigation, or action buttons. Native
saving uses SDK 54 compatible `react-native-view-shot`, `expo-file-system`, and
`expo-media-library`. It does not
download or rename the PDF. Retained PDF documents and email attachments remain
unchanged. Rebuild an existing custom development client after installing the
native modules. If the installed APK lacks capture, gallery, or filesystem
support, saving asks for an app update before capturing private content. A Metro reload
cannot add a missing native module; install an APK signed with the same
certificate to preserve app data.
Native saving writes directly to the system photo library and shows confirmation
only after the write succeeds. Save-only permission is checked/requested on the
button press; denied access stops capture, and permanently denied access directs
the user to phone settings. No existing photo assets are read. Android 13+ needs
no read-media permission for saving; older Android versions may require storage
access. Temporary private cache files are
removed after success or failure. No token-bearing URL is used.

Standalone receipt/HTTP regression checks (Node 22.18 or newer):

```bash
node --test lib/payments/receipt.test.mjs services/http/client.test.mjs services/receipts/save-receipt.test.mjs
```
