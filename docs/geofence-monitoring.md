# Geofence monitoring

## Purpose and management

Geofences provide entry/exit information for Self Drive and With Assigned Driver rentals. They do not define an allowed driving area and never stop GPS, device setup, handover, rental release, or an active trip. No configured zones means no geofence events, not an invalid rental.

Admin manages default circle/polygon zones in the website Geofence Library. Every active default applies automatically. Admin may create, edit, or remove additional custom zones from a pending/confirmed booking's details before release. Defaults cannot be removed or replaced per booking. Staff can view library and booking zones/activity, while all zone mutations require the Admin role on Laravel. Mobile has no geofence-management or assignment API. Admin represents existing owner authority; no Owner role is introduced.

## Release and history

`geofences` holds editable defaults with `notify_on_enter` and `notify_on_exit`. The website zone editor automatically sends both flags as `true` when creating or saving default or custom zones; alert-direction controls are not shown. Existing zones retain their saved settings until edited, and frozen rental snapshots remain unchanged. `booking_geofences` holds custom pre-release definitions and default copies. Each row has `scope` (`default`/`custom`) and `frozen_at`. Pre-release website reads combine active defaults with custom zones without persisting default copies.

The existing authorized Start Rental transaction copies the current active defaults and freezes every booking zone. Editing, deactivating, or soft-deleting a default later affects future rentals only. All released booking zones are immutable, including their alert preferences. This version does not support active-rental zone changes. There is no single geofence reference on a setup session and no `geofence_check` step.

The forward migration preserves existing local zone geometry, treats prior booking boundaries as custom zones, freezes existing released rows using session release timestamps, and removes obsolete geofence readiness attempts. It can resume the partially applied MySQL schema change encountered during local development. Rolling back to a single-zone schema refuses to discard multiple booking zones.

## Crossing evaluation

Both the authorized started-trip history endpoint and the consented latest-location start/update flow evaluate each frozen zone independently in their ingestion transaction under a trip lock. Latest-location sharing evaluates the fix directly without creating route-history points. Zones may overlap. First reliable membership establishes a baseline and creates no entry/exit event. If it is inside a zone with entry notifications enabled, the Customer and assigned Driver receive an “Inside zone” activity notification. Remaining in the same state creates no repeated crossing event. A confirmed change creates a server-owned `geofence_enter` or `geofence_exit` significant event containing the saved zone identity/name, scope, and whether an in-app alert was requested. Ordinary location points remain route history.

Client-selected `current_zone` and client-claimed geofence events are rejected. Repeated captured timestamps are idempotent; older points may remain route history but cannot overwrite the latest-location cache or change zone state. Implausibly future timestamps are rejected. `telematics_geofence_states` stores independent confirmed/candidate membership and the last processed timestamp per trip/zone.

Development defaults in `config/telematics.php` require accuracy no worse than 50 m and a fix no older than 60 seconds, with the existing 10-second future skew allowance. A point within its reported accuracy of a circle/polygon boundary is uncertain. The additional boundary buffer is set to 0 m. Uncertain observations retain the last confirmed membership and reset transition candidates. A change needs at least two reliable observations over at least 5 seconds. These are configurable operational defaults requiring physical verification, not a guarantee of exact crossing time.

## Website information and current limits

Polygon point-count update — 2026-10-17: library and custom booking polygons require at least three boundary points and have no application-level maximum. Coordinate ranges, adjacent-point uniqueness, non-crossing edges, and nonzero area remain validated on the website and Laravel. All supplied points are preserved; there is no automatic simplification. Validation compares pairs of edges (quadratic work), while membership/boundary evaluation scans the edges (linear work per zone and location). Large polygons increase map-marker rendering, request sizes, storage, release snapshots, and processing time; server request-size, execution-time, and browser-memory limits still apply.

Booking details show default/custom zones, saved status, alert preferences, and the latest 30 confirmed crossings. Enabled entry/exit directions create an in-app notification per confirmed crossing for the Customer and, on With Assigned Driver rentals, the current assigned Driver; disabled directions remain website activity only. Notifications use “Zone entered” or “Zone exited” with “Entered [saved zone name].” or “Exited [saved zone name].” and open that rental’s Activity tab. Overlapping zones generate independent records. Open ongoing booking details refresh periodically. Reports show persisted booking zones; defaults are saved at release. Zone/activity details are omitted from booking lists to keep that path lightweight. Notifications appear in each recipient's booking-filtered mobile Activity feed. Activity checks for new records every 15 seconds while focused; this is polling, with no email, phone push, or global staff notification bell.

The foreground and background latest-location flows now evaluate crossings after consent version 3; see the [central collection contract](telematics-master-plan.md#existing-released-gps-and-mobile-activity). The disclosure explains saved zone activity, and earlier saved choices/sessions require fresh consent before uploading. Each new sharing start/resume resets membership and transition candidates while preserving timestamp ordering; its first reliable fix establishes a baseline, so unobserved crossings during a stop are not inferred. No coordinates or geometry are copied into crossing events or notification data. Default/custom release snapshots, setup and collection permissions are unchanged. Existing mobile setup never creates trips or starts tracking before release. Backend ingestion tests use explicit synthetic test coordinates and do not constitute physical iOS/Android verification.

## Latest-GPS connection — 2026-10-19

Implemented in code: existing GPS uploads feed the server detector, and enabled directions save Customer notifications in the same transaction as the latest point, membership state and event. Failed transactions roll back all four. No API payload/response fields, route-history collection, native watchers or dependencies were added. Regression coverage includes circle/polygon overlap, frozen names/preferences, both sharing modes, long names, disabled directions, confirmation timing, duplicate/older/invalid fixes, boundary uncertainty, resume baselines, private notification reads and transaction rollback. Physical Android/iOS crossing and foreground/background delivery checks remain pending.

Verification: full `composer test` passed 857 tests (5,164 assertions) with a temporary CLI-only 512 MB memory setting for the existing PDF tests. PHP formatting, mobile/web lint and TypeScript, 26 focused mobile API/session/consent/preparation checks, web production build and diff checks passed. The web build needed network access to download its configured Google font. Synthetic HTML rendering of the actual disclosure/form controls checked 320×568 Android wording, 390×844 iOS wording and a 768×1024 tablet layout; content scrolls and actions remain visible. This does not verify native permissions, safe areas or physical crossings. Reviewed `StartLocationMonitoringRequest` / `LatestLocationRequest` against `startLocationMonitoringSchema` / `updateLatestLocationSchema` and `locationConsentSchemaFor`: field contracts and mapping are unchanged; the server policy now requires consent version 3.

On 2026-11-11 the extra boundary buffer was set to zero for the capstone's
small-zone testing. The reported GPS accuracy still defines the uncertain area.
The focused foundation and geofence suite passed 23 tests with 122 assertions,
including a synthetic crossing five metres from the boundary with two-metre
accuracy. Physical crossing verification remains pending.

On 2026-11-11, first reliable inside membership began creating an “Inside zone”
notice when entry alerts are enabled. It uses the recorded fix time and occurs
again on a fresh GPS resume baseline. It does not create an entry crossing event.
The focused telematics, geofence, motion and notification suites passed 60 tests
with 416 assertions and scoped PHP formatting passed. Physical verification remains
pending.

On 2026-11-11, the crossing confirmation interval changed from ten seconds to
five seconds while retaining the two-reliable-reading requirement. The focused
foundation and geofence tests passed 25 tests with 128 assertions, including the
four-second rejection and five-second confirmation cases. Physical verification
remains pending.
