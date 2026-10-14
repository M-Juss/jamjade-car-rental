# JamJade Mobile

Expo customer application for the JamJade Laravel API.

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

```bash
npx eas-cli build --platform android --profile development
npx expo start --dev-client
```

Use `preview` for the standalone internal APK described below. Native plugins,
permissions, Maps SDK keys, splash, icons, and bundled assets require a new
build; Metro reloads only update a development client.

1. Keep Laravel and its HTTPS tunnel running, or use a hosted Laravel API.
2. In the project's EAS **preview** environment, configure
   `EXPO_PUBLIC_BACKEND_API` with the reachable HTTPS API URL ending in `/api`,
   plus `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` and
   `EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY` with the existing restricted SDK keys.
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

The splash plugin uses the same gradient JamJade logo as the website header on the light background. Configuration changes require a new native build. Verify the final splash on Android and iOS release builds; Expo Go and development builds do not fully represent the release splash.

## Branding

`web-frontend/public/JamJadeLogo-gradient.png` is the branding source. Website headers, login, footer, mobile headers, and booking PDFs use that artwork. Run `npm run branding:sync` from `web-frontend/` after updating it to copy the mobile and backend PDF logos and export the browser favicon, Apple touch icon, opaque app icon, and Android adaptive/themed icon layers. It uses the image tooling already installed with Next.js and preserves the artwork's proportions.

`app.json` references these exports. Browser favicons use a white tile with a small corner radius. Android uses a white background and a transparent foreground with padding for launcher masks; the phone's launcher determines the outer icon shape. The monochrome layer uses the same silhouette for Android themed icons. Apple app and touch icons retain opaque white backgrounds so the platform can apply its own mask. Native app icons and splash assets require rebuilding and reinstalling the app; reloading Expo Go does not update an installed APK. If a generated `android/` or `ios/` project already exists, synchronize it with Expo prebuild before the next native build.

## Settlement Payments

Customer and Driver settlement screens share a compact amount card. Customer payments distinguish the remaining rental balance, unpaid additional charges, and a combined balance. Each charge shows its staff-entered description and the API's `outstandingAmount`, which accounts for completed payment allocations; fully paid and other-responsibility charges are excluded. Exact Philippine-peso amounts are shown, including centavos.

The pickup-deadline warning appears only for a pending/confirmed booking with a partially paid rental balance, a down payment, and a saved deadline. Return charges do not show that warning. Payment results re-read the booking before showing deadline wording, and an order whose amount changed must be reviewed before PayPal opens.

## Account Information

The Customer Profile separates Personal Information from Account Information. Personal/onboarding saves contain no email or password fields. Account forms use `validation/account/schemas.ts` and `services/api/account.service.ts`:

- `PUT /mobile/account/email`: new email and current password. Laravel normalizes and checks uniqueness, changes the sign-in email immediately, and clears any previous email verification timestamp. No verification email or OTP is sent in this phase.
- `PUT /mobile/account/password`: current password, new password, and confirmation. Laravel verifies the current password, hashes the replacement, rotates the remember token, and revokes existing mobile tokens. The app clears its session and shows a sign-in notice after success.

These endpoints require an active Customer account and allow five combined attempts per minute per account. New passwords follow the current minimum of eight characters, must differ from the current password, and are limited to 72 UTF-8 bytes for bcrypt. Password inputs are not trimmed, persisted in the customer store, or logged. Changing an account does not require a completed personal profile.

## Phase 3 self-drive setup

The self-drive Telematics tab is a server-gated handover readiness workflow.
The six available checks run through `services/telematics` and
`services/telematics/setup-workflow.ts` in this order:

1. device capability check
2. motion permission
3. foreground location permission
4. background location readiness
5. one fresh GPS fix
6. explicit phone-mount confirmation

`setup-readiness.ts` collects typed evidence from the native adapters and the
workflow re-reads the handover before each step before submitting it through
`services/api/telematics.service.ts`. The app does not start active tracking,
subscribe to sensors, upload route points, create trips, or perform calibration
during setup. The background task definition is intentionally inert.

The authoritative state comes from `/mobile/telematics/setup` or
`/mobile/bookings/{booking}/telematics-setup`. Render the returned
`eligibility` and only show setup actions when `canWorkSetup` is true. A booking
selector is a navigation filter. In standard mode, Laravel still rechecks
ownership, self-drive type, approved documents, confirmation, the current
Philippine rental date, and staff-started handover for every mutation. The
local/testing handover test mode intentionally relaxes those business gates as
described in the handover lifecycle guide, while native evidence and the
no-tracking setup boundary remain in force.
Staff's existing **Start Rental** action performs the only release transition.
See [telematics architecture](../docs/telematics-architecture.md),
[handover lifecycle](../docs/telematics-handover-lifecycle.md), and
[device/location policy](../docs/telematics-device-location.md).

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
scheme in `app.json`; Expo Go/web callbacks use Expo's generated URL.

`app.json` owns native plugins, permissions, splash, edge-to-edge behavior, and
the `mobilefrontend` scheme. `app.config.ts` supplies the iOS and Android Maps
SDK keys from the environment variables documented in `.env.example`. Native
permission, plugin, Maps-key, splash, icon, or bundled-asset changes require a
new development or preview build.

## Verification

From `mobile-frontend/`, run the installed checks as appropriate:

```bash
npm run lint
npx tsc --noEmit
npx expo-doctor
```

The mobile test foundation is not configured yet. Establish it in a dedicated
task before adding Jest or React Native Testing Library tests. Smoke-test
permission, map, callback, safe-area, and edge-to-edge changes on both iOS and
Android when devices or development builds are available.

Web admin authentication remains cookie/CSRF based. Mobile authentication uses Sanctum bearer tokens stored with Expo SecureStore.

### Delivery maps

Delivery uses the SDK 54-compatible `react-native-maps` package with Google rendering. Configure the restricted Android/iOS SDK keys from `.env.example` and rebuild a development client after native key changes. Places/Routes REST calls go through Laravel using its server-only key. Configure the garage point in Management → Delivery Pricing. No device location permission is requested by delivery pin selection. See [delivery pricing](../docs/delivery-pricing.md) for quote expiry, toll review, interrupted requests, and the live verification checklist.
