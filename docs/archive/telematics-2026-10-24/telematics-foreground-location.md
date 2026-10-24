> **Historical archive — 2026-10-24.** This is a superseded working-copy snapshot, not current coding guidance. Read the [central implementation guide](../../telematics-master-plan.md). Historical plans, exclusions, platform targets, and verification statements below retain their original dates; relative Markdown links were rebased for this archive.

# Foreground latest-location sharing

Android-only scope — 2026-10-24: `mobile-frontend` now targets Android only; iOS and mobile-browser support are retired. Earlier dated multi-platform descriptions and results below are historical. Shared Laravel contracts, saved records and the separate Next.js website are unchanged. Current physical verification is required on Android. See [Android-only mobile scope](../../android-only-mobile.md).

With Assigned Driver adaptation — 2026-10-19: the same released-rental sharing
contract now applies to both rental types. The owning Customer operates Self
Drive; the currently assigned Driver operates With Assigned Driver. JamJade
staff can see the latest location on both, and the booking Customer can also see
the latest location on With Assigned Driver rentals. The mobile disclosure names
these recipients and the Driver gives separate in-app GPS consent. Physical
Android/iOS checks with Driver accounts remain pending.

Geofence follow-up — 2026-10-19: consent version 3 now evaluates frozen booking zones from accepted latest-GPS fixes and saves named Customer in-app entry/exit alerts. This supersedes earlier exclusions of geofence evaluation below. Latest-only coordinate storage, native collection modes and route-history exclusion are preserved; each sharing start establishes a fresh membership baseline. See [geofence monitoring](../../geofence-monitoring.md). Physical Android/iOS crossing checks remain pending.

Prepared-start follow-up — 2026-10-19: [Mobile Telematics drawer](telematics-mobile-dashboard.md) allows explicit agreement during device setup to prepare one start after staff release. It supersedes the separate post-release sharing-button requirement for that one foreground, server-rechecked transition. Stop/interruption/runtime-loss recovery stays explicit, and existing latest-only storage and background-mode boundaries remain. The pause request now accepts optional `reason: manual | interrupted` for in-app activity.

Current follow-up: [background latest-location sharing](telematics-background-sharing.md)
adds explicit foreground/background mode selection and consent version 2. The
foreground-only behavior described below remains available; the initial
foreground-only consent/start contract is superseded by that follow-up.

## Approved increment — 2026-10-18

The customer can choose **Share location** from the staff-released rental
dashboard. A disclosure explains the purpose, authorized staff access,
foreground-only behavior, retained latest location and stop control. **Agree
and share location** is the consent action; closing the dialog starts nothing.
No native watch or trip starts automatically when signing in, passing setup,
opening the rental or returning to the app.

The approved data scope is **latest location only**. This feature never writes
`telematics_location_points`, stores raw motion, infers movement/driving events,
or invokes the existing history-ingestion/geofence-crossing workflow. The subsequent [fleet map increment](fleet-monitoring-realtime.md) now adds
authorized latest-point reads and empty Reverb notices without changing this
mobile collection boundary.

This is a separate Phase 5 flow. The six pre-release checks and five calibration
exercises, staff release and frozen booking zones are unchanged.

## Collection and interruption

The installed Expo SDK 54 `expo-location` foreground `watchPositionAsync`
supplies coordinates, horizontal accuracy and capture time. Speed, heading,
accelerometer and gyroscope values are not collected by this flow. Android
requests a five-second interval with High accuracy and zero distance threshold;
iOS controls delivery timing. The app independently caps uploads to at most
one per five seconds and requires fresh, accurate native evidence captured after
the explicit sharing action; cached fixes from before it are discarded. It does not
invent movement or coordinates when stationary or when GPS cannot provide a fix.

The session lives in memory independently of the rental component, so it can
continue through other sections of the signed-in app while foregrounded.
`useLocationMonitoringLifecycle` stops on any non-active AppState and account
change/unmount. Sign-out stops before attempting remote logout. Returning to
the app does not resume collection: the customer explicitly agrees again.
The globally defined Phase 3 background task remains inert. The subsequent
[Stationary resume check](telematics-mobile-dashboard.md#stationary-check-before-resume)
uses one explicitly started foreground motion capture before resuming an existing
trip. Its local readiness result is discarded, and setup calibration is unchanged.

The Monitoring card distinguishes Not sharing, Starting, Waiting for GPS,
Sharing location, Paused, Offline and Interrupted. Last shared includes seconds;
GPS accuracy appears during collection, without displaying precise coordinates.
The stop action remains usable during read/network activity. Denied location
permission offers device Settings; no unnecessary background permission is
requested by this phase.

The first accurate fix starts/reuses the booking's one trip. A later resume
stays in that trip. A response must confirm the first upload before the UI says
Sharing location. There is at most one pending point, replaced by newer readings;
no disk cache or offline route buffer exists. Network failures stop the watch
and discard the pending point rather than silently collecting offline. Requests
time out after ten seconds. No initial usable fix within 30 seconds, or no
fresh usable reading for the configured maximum age, stops sharing. These are
operational defaults requiring physical verification.

Local stop removes the watch and cancels pending work immediately. A separate,
bounded best-effort pause updates the server. Offline/app termination can leave
the saved trip status as started, so saved status and location recency never
prove that a phone is currently connected. A start response lost during an
interruption can leave the single trip created; a later explicit start reuses
it. A response arriving after cancellation cannot reactivate the native watcher.

## API and authorization

All paths are under `/api/mobile/bookings/{bookingCode}/location-monitoring`
and retain Sanctum, active-user and mobile throttling. Laravel authorizes the
owning Customer for Self Drive or the current assigned Driver for With Assigned
Driver on every read and mutation. Other users cannot access the booking's
monitoring state or mutate its trip.
Customer and Driver requests for bookings outside their operator scope return
`404`; accounts without either role receive `403`.

| Method/path | Contract |
| --- | --- |
| GET base path | Minimal monitoring state; no coordinates or collection token |
| POST `/start` | `StartLocationMonitoringRequest`: location fix, explicit accepted consent and current consent version |
| POST `/location` | `LatestLocationRequest`: location fix and current 64-character session token |
| POST `/pause` | `PauseLocationMonitoringRequest`: current session token; pauses sharing without ending the booking |

A fix contains numeric `latitude` (-90..90), `longitude` (-180..180), required
`accuracy` (0..configured maximum), and required `captured_at` date. Speed,
heading, samples and client-claimed zones are prohibited. Laravel validates
each request, and `LocationMonitoringService` checks capture freshness under
the booking/trip transaction. The server's current time is authoritative.

Every start/update rechecks ongoing booking status, released setup and no
recorded physical receipt or ended trip. Crossing the scheduled return deadline
does not stop an overdue ongoing rental. Every mutation locks booking then trip.
Repeated starts reuse the existing trip; they never create a second trip.
Each consented start rotates an ephemeral collection token. Only its SHA-256
hash is retained; old sessions cannot upload or pause a newly started session.
The token stays in mobile memory and is returned only by `/start`, never by GET.
Existing legacy trip mutation endpoints reject trips using this consented flow,
so they cannot bypass its latest-only scope or append driving events/history.

`LocationMonitoringResource` returns `bookingCode`, `canMonitor`, `tripStatus`,
`lastLocationAt` and server `policy`; `/start` additionally returns `sessionToken`.
Responses use `Cache-Control: no-store` and omit booking profiles, coordinates,
event collections and inspection evidence. API calls and snake-case payloads
belong to `services/api/location-monitoring.service.ts`, never components.

Mobile validation is defined in `validation/telematics/location-monitoring.ts`:
`startLocationMonitoringSchema`, `updateLatestLocationSchema`,
`pauseLocationMonitoringSchema` and version-specific `locationConsentSchemaFor`.
They match the three Form Requests' fields, numeric/length/version limits and
accepted consent values (`true`, `1`, `"1"`); the consent button submits true.
Native dates are transported as ISO 8601. Client time/quality checks provide
feedback; ownership, release and capture-time validity remain server-authoritative.
Client consent/version errors appear in the consent form. Server consent/version,
session and automatic fix/upload failures receive specific safe recovery beside
Monitoring because there are no editable GPS fields and the disclosure has closed.

## Storage, privacy and lifetime

Migration `2026_10_18_000001_add_latest_location_monitoring_to_telematics_trips`
adds nullable `latest_location`, `location_consent_at`,
`location_consent_version` and `location_session_hash`. It neither replaces
legacy data nor changes the one-trip unique constraint. `latest_location` is a
single Laravel-encrypted JSON value containing latitude, longitude and accuracy;
it is not a stream. The existing numeric start/current/end coordinate columns
cannot hold Laravel ciphertext, so this flow leaves them unused rather than
duplicating the new point in plaintext. Authorized fleet-map reads now
use the encrypted latest value for these trips and apply its expiry policy.
`last_location_at` remains the intentional timestamp cache used by the fleet
list. Duplicate/older captured seconds cannot overwrite the latest point.
No location is copied into lifecycle events or activity logs. Consent auditing
contains actor/trip attribution, mode and version only, without coordinates,
tokens or request payloads. Existing legacy location history is unchanged.

The last shared point remains while paused. Physical receipt clears the new
encrypted point, invalidates the session and ends its trip in the receipt
transaction; return/completion also close it defensively. Ordinary consent and
trip metadata remain for accountability without retaining the precise point.
`config('telematics.foreground_location')` currently sets a 24-hour lifetime
after the last point. `telematics:purge-latest-locations` runs hourly, so the
disclosure states an upper bound of 25 hours. **The existing Laravel scheduler
must be running for this cleanup guarantee**; check deployment scheduling before
collecting outside controlled testing. The purge clears only this encrypted
field, preserving trip records and unrelated legacy data. The encryption key
must be managed through the existing Laravel secret configuration; production
transport must use HTTPS and database/backups require operational access controls.

The design review considered the Philippine NPC's
[transparency, legitimate-purpose and proportionality principles](https://privacy.gov.ph/data-privacy-act-/)
and [right to be informed](https://privacy.gov.ph/the-right-to-be-informed/).
This records the engineering choices, not a legal-compliance certification.
Background capture, route retention, geofence activity, production privacy
review and AI/dataset collection require their own increments.

## Verification and device test

18 focused backend tests cover consent, ownership, release/receipt gates,
one-trip reuse, encrypted overwrite, no route/event-coordinate writes, token
rotation, timestamp ordering, expiry and legacy-endpoint rejection. The full
backend suite passed 791 tests (4633 assertions); PHP formatting and diff checks
passed. 38 focused mobile checks passed across the new session, native adapter,
API/Zod contracts and existing setup/dashboard behavior. Mobile lint and
TypeScript passed; Android/iOS bundle exports and Expo Doctor's 18 checks passed.
No dependency or native configuration changed. The additive migration was
applied to the local development database.

Synthetic browser rendering uses the actual Monitoring/disclosure/shared-card
components with HTML adapters and placeholder icons. It reviewed 320/390 px
phone and 768 px tablet layouts, including idle, sharing, waiting, paused,
offline, permission-denied, disabled/unavailable and loading states. Consent
body scrolling preserved visible actions on the smallest layout. It reviews layout and
states, not native permission prompts, safe areas or a physical GPS feed.
Physical Android/iOS checks remain pending. On each platform:

1. Open an owning released ongoing rental; opening alone must not collect.
2. Open Share location, cancel, and verify no sharing starts.
3. Agree while safely parked with the phone mounted; allow foreground location
   if requested. Check Waiting for GPS, then Sharing location and Last shared.
4. Keep the app open and check that Last shared advances. Refresh web Fleet
   Monitoring to confirm its saved status/timestamp and marker. Reverb notices
   update the local web view automatically when its server and worker run.
5. Navigate to another app section, then return; sharing should remain active.
6. Minimize/lock, return and verify Paused with no automatic resume. Explicitly
   resume; test Stop sharing, connection loss, denied permission and sign-out.
7. Have staff receive the vehicle; the trip must end, latest point clear and
   further starts/updates be rejected. No route-history points should be created.

Native API references were checked against the exact SDK 54
[Location documentation source](https://github.com/expo/expo/blob/sdk-54/docs/pages/versions/v54.0.0/sdk/location.mdx)
and [foreground watch implementation](https://github.com/expo/expo/blob/sdk-54/packages/expo-location/src/Location.ts).
The public v54 documentation URL currently redirects to latest, so the versioned
source was used together with installed package types.

## Background permission follow-up — 2026-10-18

The inactive Monitoring card now offers background permission preparation. This
adds a separate disclosure and permission-only flow without changing collection,
consent, storage or foreground interruption behavior. See
[background permission preparation](telematics-background-permissions.md).
