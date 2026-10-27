# JamJade Mobile Agent Guide

This guide applies to `mobile-frontend/` together with the repository-root
`AGENTS.md`. The app is an Android-only Expo SDK 54 customer application with a small
assigned-Driver surface that talks to the Laravel API. Read the exact
[Expo SDK 54 documentation](https://docs.expo.dev/versions/v54.0.0/) before
writing any code. For Expo configuration or native-facing APIs, consult the
same exact versioned documentation before making the change.
For telematics and RC research, read `../docs/telematics-master-plan.md` before
writing code. It is the single active domain guide; archived documents are
historical evidence, not coding instructions.

iOS and mobile-browser targets are retired. Keep the separate Next.js website and shared Laravel contracts intact. Do not remove historical platform values from API read types or stored research records. See `../docs/android-only-mobile.md` for the scope and verification gates.

Expo SDK 54 native generation can recreate an iOS launch script even with
`--platform android`. Run `npm pkg delete scripts.ios scripts.web` afterward;
review package changes and preserve `platforms: ["android"]`.

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

## Telematics And RC Research

The central guide owns exact current boundaries and the agreed target pipeline.
Keep the native abstraction behind `services/telematics/` and any Android-only
local module; presentation components must not own sensors or network calls.

- Current Self Drive and With Assigned Driver setup remains server-gated through
  the handover read model. Preserve the six readiness checks, five consented
  foreground calibration exercises, attempt history, operator/assignment checks,
  server-time gates, and Staff Start Rental authority. Research trials do not
  require customer bookings or rental-release exceptions.
- Current calibration submits bounded summaries only. Current post-release GPS
  uses a separately consented app-wide foreground or explicit background collector;
  the readiness task stays inert. Prepared one-use startup and local Stationary
  resume checks do not imply cold start or automatic recovery after Stop/runtime loss.
- Current Admin Collect uses the local Kotlin v2 recorder with encrypted durable
  checkpoints, unlabeled saves, recovery and metadata review. Adapter 1.2.0 adds
  verified bounded exports, explicit resumable upload and encrypted transfer receipts.
  The web inspector reads v2 original channel windows and historical v1; mobile Data
  still reads historical v1. Automatic background upload, preprocessing/dataset export,
  AI, reports and scores remain pending. Short Redmi smoke checks do not establish
  long-duration or interruption reliability.
- Implement native collection/storage/processing independently of screen JS when
  adding lock-screen recording. Preserve explicit consent, visible recording state,
  stop/recovery, account cleanup, and protocol/source/unit provenance. Do not
  reinterpret existing Expo readings as direct Android measurements.
- Automatic direction handling is required in operation. Observer direction and
  maneuver annotations are for training/evaluation only. Do not require a live
  Forward/Reverse selector or label uncertain data normal to hide failures.
- Preserve current Customer/Driver bearer-token and restricted Admin research-token
  scopes. Raw data stays out of setup evidence, ordinary logs and public storage.
  Update Laravel contracts and matching Zod/types/services together.
- Consult the central guide's verification section and exact SDK 54 docs before
  native changes. A build/export or synthetic sensor test is not physical RC,
  background reliability or model-accuracy evidence.

## Native Configuration And Builds

- `app.json` owns the Expo Router, image picker, splash, SecureStore, location,
  media-library and development-client plugins, along with Android edge-to-edge and
  permission declarations. `app.config.ts` injects the Android Google Maps SDK
  key from `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`. This is public client
  configuration; restrict it to the Android package and signing SHA-1. Motion
  sensor support remains installed; its former iOS permission plugin is removed.
- `.env.example` documents the supported public variables: optional
  `EXPO_PUBLIC_BACKEND_API`, `EXPO_PUBLIC_BACKEND_TUNNEL_API`, fallback timeout,
  and the Android Maps SDK key. Never commit `.env.local`, tokens, or unrestricted
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

Constrain variable text beside controls with native flex sizing and allow rows
to grow vertically. Show complete values in detail views; cap preview lines only
when the full value can be opened or expanded. Keep field errors in normal flow.

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
node --test $(rg --files lib services components -g '*.test.mjs')
npx expo export --platform android
npm start
```

Run the focused flow on Android when a change touches native
permissions, maps, callbacks, safe areas, or edge-to-edge behavior. The mobile
test foundation is not configured yet; establish it in a dedicated task before
adding Jest or React Native Testing Library tests. Do not run dependency or
native-schema mutation commands as part of documentation-only work.
