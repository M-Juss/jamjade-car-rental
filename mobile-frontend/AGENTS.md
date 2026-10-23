# JamJade Mobile Agent Guide

This guide applies to `mobile-frontend/` together with the repository-root
`AGENTS.md`. The app is an Expo SDK 54 customer application with a small
assigned-Driver surface that talks to the Laravel API. Read the exact
[Expo SDK 54 documentation](https://docs.expo.dev/versions/v54.0.0/) before
writing any code. For Expo configuration or native-facing APIs, consult the
same exact versioned documentation before making the change.
For telematics work, also read `../docs/telematics-architecture.md`,
`../docs/telematics-handover-lifecycle.md`, and
`../docs/telematics-device-location.md` before writing code.

## Architecture And Ownership

- `app/` contains Expo Router entries and route groups. Keep route files small;
  substantial screen modules belong in `screens/<domain>/`; reusable
  presentation belongs in `components/`, form behavior in `forms/`, and
  domain/network behavior in hooks or services.
- `components/common/` owns reusable fields, screen frames, and shared layout;
  `components/ui/` owns reusable controls; domain presentation belongs in the
  nearest `components/<domain>/` folder.
- Customer and Driver navigation reuse the floating tab bar and header contract:
  `components/navigation/FloatingBottomTabBar.tsx`,
  `components/navigation/CustomerBottomTabBar.tsx`,
  `components/customer/CustomerTabScreen.tsx`,
  `components/customer/CustomerTabHeader.tsx`, and
  `components/auth/LogoutHeaderButton.tsx`. Keep route-group layouts as tab
  configuration and role gates rather than duplicating these shells.
- `forms/<domain>/` owns data-submitting forms. Their Zod schemas live in
  `validation/<domain>/`; use React Hook Form with `zodResolver` and map
  Laravel `422` errors back to fields.
- `services/http/` owns API base-URL selection, request/response handling,
  API errors, bearer-token injection, and SecureStore-backed token persistence.
  `services/api/` owns domain endpoints, request mapping, and response types.
  Screens and visual components must not call `fetch` or construct backend URLs.
- `providers/AuthProvider.tsx` owns session restoration, current-user state,
  sign-in, sign-out, and account credential transitions. Customer API routes use
  Sanctum bearer tokens; never move the token to general-purpose storage.
- `lib/` owns domain helpers and local state adapters. Keep booking totals,
  payment callback parsing, profile/document mapping, and telematics setup
  ordering there rather than in route components.

The backend remains authoritative for authorization, document state, booking
availability, delivery quotes, telematics eligibility, and all persisted data.
Mobile validation improves feedback but does not replace Laravel Form Requests.
Read `../docs/project-status-and-roadmap.md` and the domain documents linked in
the root guide before changing a cross-application contract.

## Authentication, Account Forms, And Callbacks

- Public mobile auth is `POST /mobile/register` and `POST /mobile/login`;
  authenticated requests use `auth:sanctum`, `active_user`, and the mobile API
  throttle. Keep mapping in `services/api/auth.service.ts` and forms in
  `forms/auth/`.
- Account credentials are separate from personal profile/onboarding saves.
  `forms/account/ChangeEmailForm.tsx` uses
  `validation/account/schemas.ts` and `services/api/account.service.ts` for
  `PUT /mobile/account/email` (new email plus current password). The password
  form uses the same layers for `PUT /mobile/account/password` (current
  password, new password, and confirmation). A successful password change
  revokes mobile tokens, clears the local session, and routes the customer to
  sign in again. Preserve server error mapping and the existing sign-out flow.
- PayPal return and cancellation URLs are built in
  `lib/payments/paypal-callbacks.ts`. `app/+native-intent.ts` consumes the
  `mobilefrontend://paypal/...` callbacks so a pending WebBrowser session can
  resume the payment screen without navigating to a callback route. Keep the
  callback paths and the scheme in `app.json` synchronized; never put
  authentication credentials or Sanctum tokens in a public URL. Provider order
  references may appear in the allowlisted callback URL because the payment
  screen validates the pending checkout with Laravel before capture.

## Phase 3 Telematics Setup

Telematics setup is a readiness workflow for Self Drive and With Assigned Driver handover. The owning Customer operates Self Drive; the currently assigned Driver operates With Assigned Driver. Device readiness remains separate from the subsequent, explicitly consented calibration stage. Released-rental GPS collection is a distinct, consented flow described in the foreground/background sharing guides; setup and calibration do not start rental GPS collection.
The six mobile checks run in this order:

1. `device_check`
2. `motion_permission`
3. `location_permission`
4. `background_location`
5. `gps_check`
6. `phone_mount`

`services/telematics/` is the only native abstraction for these checks:

- `device-readiness.ts` checks accelerometer, gyroscope, and location-service
  availability.
- `motion-readiness.ts` and `location-readiness.ts` request/check permission
  state; `background-location.ts` checks background readiness and defines an
  inert task without registering updates.
- `location-readiness.ts` obtains one fresh GPS fix for setup. Setup coordinates
  are typed evidence for Laravel evaluation and are not route history.
- `network-readiness.ts` prevents a check from starting while offline.
- `setup-readiness.ts` maps each check to typed native evidence, and
  `setup-workflow.ts` re-reads server state before every step and submits the
  evidence through `services/api/telematics.service.ts`.

The server response from `/mobile/telematics/setup` or
`/mobile/bookings/{booking}/telematics-setup` is the eligibility authority.
Render the returned state and `eligibility.canWorkSetup`; do not unlock a screen
or checks from cached profile, booking, or document state. The booking selector
is only a navigation filter. In standard mode, Laravel rechecks ownership,
the applicable rental type and current operator assignment, verified Customer documents for Self Drive, confirmation, server time within the reserved
`[rental_start_at, rental_end_at)` interval, and the staff-started `in_progress` handover on every setup
mutation. Local/testing handover test mode intentionally relaxes the business
gates described in `../docs/telematics-handover-lifecycle.md`, while still
requiring real evidence where the native check is available and never allowing
the client to bypass ownership or the no-tracking setup boundary.

The existing staff `Start Rental` action is the only release action. A mobile
setup screen must not simulate results, subscribe to sensors, start active
location updates, upload active-trip telemetry or create trips. The approved Phase 4 calibration
exception uses only bounded, explicitly consented foreground DeviceMotion
captures through `services/telematics/calibration-capture.ts`; read
`../docs/telematics-calibration.md` before changing that flow.
Read `../docs/telematics-architecture.md`,
`../docs/telematics-handover-lifecycle.md`, and
`../docs/telematics-device-location.md` before changing this area.

## Native Configuration And Builds

Approved 2026-10-19 exception: `../docs/telematics-mobile-dashboard.md` permits an explicit, one-use GPS preparation during device setup. The dedicated Telematics screen may consume it only while foregrounded/focused after fresh server-confirmed release and monitoring eligibility, then use the existing native collector. The accepted sharing mode may be stored securely per Customer and consent version; do not persist GPS data, session tokens or the one-use preparation instruction. It does not collect before release, start on a cold runtime, or automatically resume after Stop/interruption. Retain account/booking/handover/profile/version binding, visible cancellation, current permission checks and explicit recovery. This supersedes only the separate post-release sharing-action restriction in the older paragraphs below.

Approved 2026-10-19 resume exception: the same dashboard guide permits one explicitly started, bounded foreground Stationary motion check before resuming an existing released trip. Reuse the native capture abstraction and projected Stationary settings; abort on cancellation, navigation, backgrounding or account change. The local pass is short-lived and single-use, and GPS still requires fresh server eligibility and native permissions. Never submit this check as setup evidence, modify released calibration, persist/upload motion or a new baseline, or claim to prove a secure mount. Continuous rental monitoring remains GPS only.

The approved Phase 5 released-rental flow is documented in
`../docs/telematics-foreground-location.md`. It uses a separately consented
app-wide foreground Location watch, an in-memory session and encrypted
latest-only backend updates. Do not start it from setup/calibration, persist a
route queue, add motion/classification, register background work or resume it
automatically. Stop on non-active AppState and sign-out/account change. Future
background collection and route/dataset work need separate approved increments.

The approved background permission preparation increment is documented in
`../docs/telematics-background-permissions.md`. It reads/reuses native access and
requests permission only after its disclosure and eligibility read. It does not
register background updates, persist GPS or session data, or change foreground
pause/resume; actual background collection remains a separate increment.

The approved background-sharing follow-up is documented in
`../docs/telematics-background-sharing.md` and supersedes the foreground-only
collection restriction above for explicit foreground_background consent only.
Use the separate native rental task, current consent mode/version, visible
notification/indicator and in-memory receiver. Do not persist collection tokens
or auto-resume after runtime loss. Preserve foreground-only mode, setup task
isolation, latest-only uploads and cleanup on stop, sign-out and eligibility loss.

- `app.json` owns the Expo Router, image picker, splash, SecureStore, location,
  sensors, and development-client plugins, along with Android edge-to-edge and
  permission declarations. `app.config.ts` injects the Android and iOS Google
  Maps SDK keys from `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` and
  `EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY`. These are client configuration values,
  not server secrets; restrict them to the app identifiers and build signing
  configuration.
- `.env.example` documents the supported public variables: optional
  `EXPO_PUBLIC_BACKEND_API`, `EXPO_PUBLIC_BACKEND_TUNNEL_API`, fallback timeout,
  and the two Maps SDK keys. Never commit `.env.local`, tokens, or unrestricted
  provider keys. LAN development derives the backend host from Expo; tunnel and
  installed builds need a reachable API URL ending in `/api`.
- The `development` EAS profile uses a development client and internal
  distribution for native debugging and live Metro updates. The `preview`
  profile creates an internal Android APK with JavaScript/assets bundled and no
  development client. Use the profile that matches the task; native plugin,
  permission, Maps-key, splash, icon, and bundled-asset changes need a new
  native build.

## Typography, Layout, And Safe Areas

Apply the root guide's **Interface And User-Facing Copy** rules to every future
screen and scoped UI change within the current JamJade identity. Preserve the
established screen frames, typography, card shapes, icons, and interactions.
The refinement targets gradients and unnecessary copy; do not replace the
visual identity with a generic minimal design. Existing gradient assets and
verbose introductions are not patterns to extend.
Use solid `themeColors.primary` or the NativeWind `primary` token for blue
branding and primary actions. Shared logo, splash, and icon updates must use
the existing branding sync workflow and the native-build verification above.

Use one clear screen title, direct action labels, and descriptions only when
they explain a necessary rule or next step. Keep field guidance, record status,
and action consequences beside the relevant content. Preserve consent,
permission explanations, payment consequences, validation, and recovery steps.
Public welcome, sign-in, and registration screens retain their existing headings
and informational descriptions unless the user explicitly requests copy changes.
The solid-branding and timezone display rules still apply to those screens.
Do not add reminders, explanation panels, extra labels, or tooltips merely
because a feature is new. Show brief guidance only where and when it is needed
for the current task. Preserve established card and icon treatments; remove
redundant text and extra containers introduced by the change before reducing
text or touch-target sizes. Keep navigation and actions predictable without
forcing desktop layouts onto phone screens.

Urbanist is bundled under `assets/fonts/urbanist/` and loaded by
`expo-font` in `app/_layout.tsx`. The static faces and aliases in
`constants/font-families.json` and `constants/fonts.ts` back the `font-sans`
and existing NativeWind weight utilities. Do not add runtime font downloads or
component-local font families. Keep the license and font asset README beside
the files.

Shared spacing, control heights, radii, and text sizes live in
`constants/layout.json`, are exposed through `constants/layout.ts`, and feed
`tailwind.config.js`. Reuse `px-screen`, `p-card`, `rounded-card`,
`rounded-field`, and the existing `text-title`, `text-section`, `text-body`,
`text-caption`, and `text-button` roles where they fit. Keep validation text in
normal layout flow, use scrollable content, and apply safe-area insets at screen
or navigation/footer boundaries. Do not replace insets with fixed top or bottom
padding, and account for Android edge-to-edge behavior on sheets, keyboards, and
bottom actions.

## Verification

From `mobile-frontend/`, use the installed scripts and Expo tooling:

```bash
npm run lint
npx tsc --noEmit
npx expo-doctor
npm start
```

Run the focused flow on both iOS and Android when a change touches native
permissions, maps, callbacks, safe areas, or edge-to-edge behavior. The mobile
test foundation is not configured yet; establish it in a dedicated task before
adding Jest or React Native Testing Library tests. Do not run dependency or
native-schema mutation commands as part of documentation-only work.
