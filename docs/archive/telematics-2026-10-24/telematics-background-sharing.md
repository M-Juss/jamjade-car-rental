> **Historical archive — 2026-10-24.** This is a superseded working-copy snapshot, not current coding guidance. Read the [central implementation guide](../../telematics-master-plan.md). Historical plans, exclusions, platform targets, and verification statements below retain their original dates; relative Markdown links were rebased for this archive.

# Background latest-location sharing

Android-only scope — 2026-10-24: `mobile-frontend` now targets Android only; iOS and mobile-browser support are retired. Earlier dated multi-platform descriptions and results below are historical. Shared Laravel contracts, saved records and the separate Next.js website are unchanged. Current physical verification is required on Android. See [Android-only mobile scope](../../android-only-mobile.md).

Geofence follow-up — 2026-10-19: consent version 3 now evaluates frozen booking zones from accepted latest-GPS fixes and saves named Customer in-app entry/exit alerts. This supersedes earlier exclusions of geofence evaluation below. Latest-only coordinate storage, native collection modes and route-history exclusion are preserved; each sharing start establishes a fresh membership baseline. See [geofence monitoring](../../geofence-monitoring.md). Physical Android/iOS crossing checks remain pending.

Prepared-start follow-up — 2026-10-19: [Mobile Telematics drawer](telematics-mobile-dashboard.md) can hold one explicitly accepted sharing mode during device setup and consume it after a fresh staff-release/monitoring read while this screen is foregrounded. The accepted mode is stored securely per Customer and consent version to avoid repeating the disclosure across rentals; it contains no GPS data or session token. Opening the page or granting permissions alone starts nothing. No cold start is added and a consumed instruction cannot restart after Stop or an interruption. Native collection options and latest-only storage below are unchanged.

## Approved increment — 2026-10-18

The released rental can now explicitly choose foreground-and-background GPS
sharing. The foreground-only option remains available. This changes native
collection and consent, not the latest-location storage boundary, staff release,
map authorization, Reverb transport, retention or geofence behavior. Motion
readings, driving classification and route history remain excluded.

## Customer flow and permission

Share location / Resume sharing opens the existing disclosure with two explicit
consent actions: **Agree and share in background** and **Share while app is
open**. No checkbox, automatic fallback or automatic start is added. The disclosure
explains authorized staff access, latest-only retention, battery use, platform
notification/indicator, background/foreground differences, closing/force-stopping
and manual recovery. It remains scrollable with fixed actions and safe-area
insets. Stop sharing remains available in Monitoring. An active session shows
**Sharing mode: Including background** or **App open only**.

Background access must already be allowed through setup or the separate
permission-preparation flow. A background start with missing access fails safely
and offers Settings recovery; it never silently starts foreground collection.
The customer may instead choose the foreground-only consent action. Android
requires foreground and background location permissions; iOS requires Always.
Expo Go is excluded. No permission is requested by mounting the screen or by a
background callback. The preparation disclosure now points to the sharing action
instead of claiming background collection is unavailable.

## Native collection and lifecycle

`services/telematics/background-location-collector.ts` defines the distinct
`jamjade-rental-latest-location` TaskManager task at module scope. The original
setup readiness task stays inert and is never repurposed. Only explicit accepted
background-sharing consent calls `Location.startLocationUpdatesAsync`, from the
foreground, after a fresh backend eligibility read and permission check.

Options use High accuracy, zero distance threshold, requested five-second
interval, five-second deferred interval and no automatic iOS pausing. Android
uses a foreground-service notification saying location is shared and directing
the customer to Telematics to stop; killServiceOnDestroy is enabled. iOS enables
the background location indicator and AutomotiveNavigation activity type. These
options request behavior from the OS; they do not guarantee a five-second
background delivery cadence, particularly under power saving or vendor limits.

Foreground-and-background mode replaces the foreground watcher with the native
task; it does not run both collectors. One module-owned receiver forwards only
the newest timestamp in a native batch, excluding speed, heading and motion.
The task awaits the session's processing/upload work before completing. It uses
the same API layer and current in-memory authentication as the foreground flow.
There is no additional direct fetch, disk queue, route cache, raw sample log,
coordinate audit or plaintext location copy.

The existing LocationMonitoringSession remains the single upload/session owner:
one pending latest point, no concurrent uploads, server policy/freshness/accuracy
checks, upload cap and timeout, periodic eligibility checks and explicit manual
recovery on network/permission/session errors. A background task callback can
run the upload pump while AppState is non-active only after native registration
has completed for explicit background consent. Foreground-only and interrupted
startup still stop when the app leaves the foreground. Returning active requests
a session check without automatically starting collection.

A task-delivered point is validated before upload, including capture after this
sharing start, freshness and quality. If the OS batches old readings, only the
newest candidate is considered; old values are rejected rather than replayed as
a route. Eligibility is rechecked in the client and on every backend update.
Staff receipt clears the point and invalidates the token transactionally; the
next mobile check/update stops and unregisters collection. A remote receipt or
connection loss is observed at the next executing callback/check, not by an
instant native push. If the OS suspends callbacks entirely, immediate remote
cleanup cannot be guaranteed; the backend still refuses further updates.

## Stop, account changes and app termination

Stop invalidates the local generation and token, aborts requests, discards the
pending point, detaches the receiver and unregisters native updates. Native
start/stop operations are serialized, so an old remove cannot unregister a newer
watcher and a cancelled startup is cleaned up after native registration returns.
Task errors, network failure, expired consent or invalid eligibility use the same
cleanup. Native unregister failure never restores a receiver or permits further
uploads; the UI gives safe recovery if a system location indicator remains.
Sign-out awaits native cleanup before removing/revoking account authentication.
Account change and UI-root disposal reset the session. The server pause remains
bounded best effort; loss of connectivity can leave saved started status until
freshness ages, without implying that collection is still active.

**The session, consent and collection token remain in memory.** No background
credential is persisted to SecureStore, AsyncStorage, files or task options.
Normal minimizing/locking can preserve this running runtime/session. Closing or
force-stopping the app, native/JS runtime loss or a development reload can stop
it. A cold/headless task without its explicit in-memory receiver unregisters
itself and sends nothing; it never restores account credentials or consent.
Login, app reopen, permission grant and network restoration do not restart it.
The customer must open the rental and agree again. This conservative limitation
is intentional; unattended restart would require a separate secure persistent
session/consent design and native verification.

## API contract and audit

The existing `telematics.foreground_location.consent_version` becomes **2**.
`StartLocationMonitoringRequest` adds required `sharing_mode`, exactly
`foreground` or `foreground_background`; `locationConsentSchema` and the
React Hook Form consent actions mirror it. No new endpoint or migration is
needed. `LocationMonitoringService` records mode and version in the existing
consent activity audit without GPS data. The sharing mode remains in the mobile
session; it does not alter the accepted latest-location payload or store a
telemetry stream. Existing cached points/legacy data are preserved.

New starts require current terms. Updates also reject a token from a trip whose
consent version is outdated; the pause endpoint still permits that token to stop.
The mobile specific-error handling asks the customer to refresh and agree again.
This intentionally changes the development request contract together with the
single affected mobile service/schema/form; the web map resource is unchanged.
Server ownership, release, ongoing/receipt gates, token rotation/hash, encrypted
latest overwrite, 24-hour point expiry and cleanup scheduler are unchanged.

## Configuration and verification

Existing Expo SDK 54 packages, development-build plugins, Android foreground
service/background permissions and iOS location background mode already cover
this increment. No package or native configuration is changed. A JavaScript
reload is sufficient only if the installed development build includes that
existing native configuration; rebuild a stale binary if native support is
missing. Android and iOS OS behavior must be physically verified separately.

Focused tests cover both native adapters, latest-batch selection, visibility
options, no receiver/cold start, awaited native errors, cancelled registration,
old-remove/new-watch races, background session uploads, manual stop, network loss,
receipt, foreground isolation, explicit-mode validation/audit and old-consent
rejection with pause recovery. Synthetic tests use no customer locations.

Safely parked physical checklist:

1. Reload the development app. Prepare background access if not already allowed.
2. Open Share location, cancel, and verify no notification or collection starts.
3. Agree and share in background; wait for Sharing location and Including
   background. Verify Android notification or iOS location indicator.
4. Minimize/lock for 30–60 seconds. Check new web Last location update timestamps
   without reopening the phone. A stationary marker may stay in the same place.
5. Return and verify the same session continues. Stop sharing and confirm native
   indicator/notification stops and server timestamps stop advancing.
6. Repeat with foreground-only sharing; minimizing must still pause.
7. Test connection loss, permission revocation and sign-out. None may resume
   automatically. Test staff receipt: point clears and future updates are denied.
8. Force-stop/reopen; verify no automatic collection and require fresh consent.
9. Repeat on physical iOS, including Always/Allow Once, screen lock and OS limits.

References: exact Expo SDK 54
[Location guide](https://github.com/expo/expo/blob/sdk-54/docs/pages/versions/v54.0.0/sdk/location.mdx),
[Location task options](https://github.com/expo/expo/blob/sdk-54/packages/expo-location/src/Location.types.ts),
and [TaskManager guide](https://github.com/expo/expo/blob/sdk-54/docs/pages/versions/v54.0.0/sdk/task-manager.mdx).

Completed verification: 816 backend tests (4730 assertions), 39 focused mobile
checks, mobile lint and TypeScript, Android/iOS Hermes exports, Expo Doctor
18/18, PHP formatting and diff checks. Browser rendering of the actual disclosure
and consent form with synthetic native adapters checked Android/iOS copy and
fixed visible actions/scrolling body at 320/390 px. Native indicator/notification,
permission behavior and physical background GPS delivery remain unverified.
