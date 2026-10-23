# Telematics architecture

Geofence follow-up — 2026-10-19: consent version 3 now evaluates frozen booking zones from accepted latest-GPS fixes and saves named Customer in-app entry/exit alerts. This supersedes earlier exclusions of geofence evaluation below. Latest-only coordinate storage, native collection modes and route-history exclusion are preserved; each sharing start establishes a fresh membership baseline. See [geofence monitoring](geofence-monitoring.md). Physical Android/iOS crossing checks remain pending.

Mobile update — 2026-10-19: [the drawer contract](telematics-mobile-dashboard.md) adds a dedicated three-tab screen and explicit preparation for one automatic GPS start after server-confirmed release. This supersedes the earlier requirement for a separate sharing action only when the Customer agreed during device setup and the same prepared screen/runtime is still active. Collection remains latest GPS only; active motion/classification and automatic restart after Stop/runtime loss are unchanged exclusions. Setup/calibration never collect rental GPS before release.

With Assigned Driver adaptation — 2026-10-19: the self-drive lifecycle is now reused for With Driver bookings. The Customer remains the operator for self-drive; the active assigned Driver is the operator for With Driver. The Driver opens the selected rental from Services. Device setup and calibration remain staff-gated and required before release. The Driver must explicitly agree before location sharing; the Customer and JamJade staff can see the latest vehicle location. Physical Android/iOS validation for Driver accounts remains pending.

## Purpose and boundary

JamJade telematics is a smartphone-assisted rental workflow for Self Drive and With Assigned Driver bookings. The Customer operates a self-drive booking; the active assigned Driver operates a With Driver booking. It is not an anti-theft system, driver scoring system, or covert monitoring feature. A supported booking has a pre-release setup session and, after authorized release, at most one actual trip.

AI driving-event classification is a main capstone goal, planned after physical validation of device readiness/calibration, active-trip collection, and a labeled dataset. No trained classifier or automated driving-event detection is implemented today. Classification is separate from driver scoring; see the [project roadmap](project-status-and-roadmap.md) for phase status.

Video recording, sending/uploads, auditing, and dashcam offerings are outside project scope. GPS, geofencing, accelerometer/gyroscope readiness, phone mounting, and calibration remain in scope. Sensor events are observations, not confirmed fault or automatic penalties; financial responsibility remains a staff decision.

The web Fleet Tracker now reads real ongoing bookings and saved trip/location freshness states with server search, filtering and pagination. It includes overdue rentals and rentals without trips. Its latest-point map now uses authorized encrypted-location reads and empty private Reverb notices; background collection and behavior classification remain separate increments. See [Fleet Tracker](fleet-tracker.md).

Laravel selects and explains only bookings the authenticated operator may operate: the Customer's Self Drive bookings or the Driver's assigned With Driver bookings. Customers enter through the Telematics tab; Drivers open a selected booking from Services. The screen is locked when no applicable rental or handover prerequisite exists. Navigation visibility, read access, staff Start Handover eligibility, operator setup mutation, Start Rental, and active monitoring are separate server decisions.

This document is the canonical domain guide. Operational API sequencing is in [telematics-handover-lifecycle.md](telematics-handover-lifecycle.md).

The defense motion testbed is an RC car carrying the smartphone. The local/testing
`rc_demo` profile records its identity and resolved settings in bounded calibration
evidence; it cannot be selected by a mobile payload or enabled in production.
Profile/settings changes invalidate unreleased calibration progress and release
readiness while retaining prior evidence; released history keeps its saved profile.
RC revision 5 keeps Stationary checks and retains the first Forward sample at
or above 3 m/s² through later fluctuations, with evidence-based completion and bounded
maximum timeouts for steps 2–5. These are not data-based driving
limits or full-size vehicle validation.
See [RC demonstration and validation](telematics-rc-demonstration.md).

## Lifecycle

The primary web preparation action combines signed Outgoing Inspection and the existing staff handover transition atomically. Self Drive follows Outgoing Inspection, Setup and Release; With Assigned Driver also includes Driver assignment before inspection. Internal `setup_required -> in_progress` remains staff-controlled. Existing saved inspections can continue to Setup without a new signature. This does not release the rental or start sensor work.

```text
confirmed supported booking
  -> finalized outgoing inspection with personnel + Customer (Self Drive) or assigned Driver (With Driver) signatures
  -> setup_required
  -> staff starts handover
  -> in_progress
  -> ready_for_release
  -> staff Start Rental
  -> booking ongoing + vehicle rented + session released
  -> one actual trip may start
```

`Start Rental` is the only release action. There is no separate “release telematics” control, and renter clients cannot start the booking.

For handover timing, Laravel checks current server time against the stored `[rental_start_at, rental_end_at)` interval. Staff may arrange collection on any booked day within that interval; future intervals and elapsed intervals remain blocked. The renter phone clock is not authoritative. Local/testing handover test mode additionally permits an early start on the same rental start date in Asia/Manila. It still blocks future-date and expired bookings, preserves the agreed timestamps, and rechecks timing on setup mutations and release.

`telematics_setup_sessions.status` uses `locked`, `setup_required`, `in_progress`, `ready_for_release`, and `released`. `locked` is an internal precondition state; `setup_required` means finalized outgoing created the workflow; checks can be recorded only while staff handover is `in_progress`; in standard mode, `ready_for_release` means every latest required step, including the five calibration types, has passed; and `released` is written transactionally when the booking becomes `ongoing`. Local/testing handover test mode is an explicit exception: a real passing `phone_mount` attempt supplies the release-readiness projection while all other recorded results remain truthful and calibration evidence remains absent.

## Setup records and snapshots

One supported booking may have one `telematics_setup_session`. Each required check is append-only in `telematics_setup_steps`; retries create a higher `attempt_number`, and readiness uses the latest passing attempt by the current operator for every type. Reassignment preserves prior attempts but makes them ineligible for the new Driver's release readiness. The exact current types are `device_check`, `motion_permission`, `location_permission`, `background_location`, `gps_check`, `phone_mount`, `stationary_calibration`, `forward_calibration`, `braking_calibration`, `left_turn_calibration`, and `right_turn_calibration`. Step statuses are `pending`, `in_progress`, `passed`, and `failed`.

Reusable circles and polygons in `geofences` are default monitoring zones. Active defaults apply automatically to every supported rental. Admin may add optional booking-specific zones before release; Staff can view zones but cannot manage them. No zone assignment, containment, or zone configuration is a handover or release requirement.

At Start Rental, Laravel copies active defaults into `booking_geofences` and freezes those settings together with the booking's custom zones. Geometry and entry/exit alert preferences remain unchanged throughout the released rental. Library edits, deactivation, and soft deletion affect future rentals only. See [geofence monitoring](geofence-monitoring.md).

## Data handling

Phase 3 evaluates a fresh setup fix only for GPS quality. Exact setup coordinates are neither retained in step evidence nor returned by the handover API. Zone membership is independent of readiness and is not evaluated by setup. See [telematics-device-location.md](telematics-device-location.md).

The existing active-trip location ingestion path now evaluates released monitoring zones server-side and records confirmed entry/exit events. It rejects client-claimed crossings and ignores duplicate or out-of-order points for transition decisions. First reliable membership is an initial state, not a crossing. Uncertain accuracy and proximity to an edge reset transition candidates. This backend capability and the website activity list do not implement continuous mobile collection, realtime notifications, or the live Fleet Tracker.

When active-trip capture is separately approved, individual location points are received with a device `captured_at` and server `received_at`; they belong in `telematics_location_points`. The current coordinate fields on `telematics_trips` are only the latest-state cache. Significant lifecycle or safety occurrences belong in `telematics_events`.

The handover resource additionally projects calibration protocol version, bounded capture durations, an opaque context and a normalized mount reference (Stationary establishes gravity; Forward learns horizontal direction), accepted parked-noise statistics, and server-configured Stationary/Forward feedback limits, without exposing raw evidence or database identifiers. The [computation and sensor-fusion reference](telematics-calibration-computation.md) defines the equations, native conventions and provisional threshold provenance. Calibration consumes platform-processed motion and combines gravity, acceleration and rotation geometrically; it does not implement a custom continuous fusion estimator.

The mobile handover resource includes a `canStartTrip` read flag for a released ongoing booking when no trip is currently active. It is a capability projection, not a second-trip allowance: the trip service still enforces the one-trip-per-booking invariant even after an earlier trip has ended, and the current mobile setup flow does not start trips.

The initial released-rental dashboard displayed vehicle details, release/return
timing and an explicit Not recording state. Its foreground UI clock does not
measure driving time or activate telemetry. Saved trip status is displayed as a
record only in that increment. Foreground latest-location sharing is now implemented as described below; the [latest-point map and Reverb integration](fleet-monitoring-realtime.md) are now implemented. The web rental list is connected independently of collection. See the
[released screen contract](telematics-handover-lifecycle.md#released-rental-screen--2026-10-18).

Raw accelerometer and gyroscope streams are never stored or uploaded. Explicit foreground calibration reduces motion readings to bounded quality, mount-reference and direction summaries. Behavior scoring, incident attribution, and automated penalties are not stored or inferred in this system. Parking or parked-mode detection is future work and must remain within the single released trip, not become a separate booking lifecycle.

## Mobile and privacy constraints

Foreground GPS update — 2026-10-18: the released rental dashboard now offers
separately consented latest-location sharing through the app-wide foreground
session. This supersedes the initial Not recording-only dashboard described
above. The new flow keeps one encrypted `latest_location` value on the existing
trip, with consent/version and a session-token hash; it never writes location
history or numeric start/current/end coordinates. `last_location_at` remains
the fleet timestamp cache. Physical receipt clears the new point and ends this
trip, with a scheduled expiry fallback. It does not evaluate geofence crossings
or motion/driving events. Legacy historical ingestion is separate and unchanged.
See [foreground sharing](telematics-foreground-location.md) before changing
collection, storage, consent, session validity, expiry or fleet map reads.

Phase 3 implements device capability checks, motion/location permission requests, inert background-task readiness, a fresh foreground GPS check, and renter phone-mount confirmation. These checks do not subscribe to sensors or start tracking. Phase 4 now provides explicitly consented foreground motion captures for the five calibration checks, with staff supervision in a controlled area; see [calibration](telematics-calibration.md). Captures stop on cancellation, navigation, backgrounding or timeout. No route history, raw streams, active trips or background updates are created. Standard release requires all eleven effective results; physical validation is separate from code completion. Local/testing handover test mode retains its documented mount-only readiness exception.

Do not expose inspection signatures, check evidence, staff-only readiness details, another renter’s booking, or generic step-pass endpoints to mobile clients.

Policy update — 2026-10-16: standard handover and mobile setup mutations now require current server time inside `[rental_start_at, rental_end_at)`, allowing collection on later booked days. This replaces the earlier same-calendar-date rule. Other payment, inspection, document and real-readiness requirements remain unchanged.

Customer concurrency — 2026-10-16: new overlapping self-drive reservations are rejected per Customer. Only one self-drive handover or ongoing rental can be operated at a time; existing records are preserved for staff review. With Driver and adjacent reservations are unaffected.

## Explicit background-sharing follow-up — 2026-10-18

The customer can now agree to foreground-and-background latest GPS sharing,
using a separate visible native rental task and the same latest-only backend.
Foreground-only sharing remains available. Consent version 2 records the chosen
mode in the existing audit; collection tokens stay in memory, cold task callbacks
without a receiver stop, and login/reopen never start collection. This supersedes
the foreground-only active collection boundary above. See
[background sharing](telematics-background-sharing.md) for lifecycle, native
limits, permission and physical validation requirements.
