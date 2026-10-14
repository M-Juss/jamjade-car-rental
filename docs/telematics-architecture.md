# Telematics architecture

## Purpose and boundary

Jamjade telematics is a smartphone-assisted, self-drive rental workflow. It is not a GPS tracker, anti-theft system, driver scoring system, or covert monitoring feature. A booking has a pre-release setup session and, after the authorized rental release, at most one actual driving trip.

AI driving-event classification is a main capstone goal, planned after physical device readiness, real calibration, active-trip collection, and a labeled dataset. No trained classifier or automated driving-event detection is implemented today. Classification is separate from driver scoring; see the [project roadmap](project-status-and-roadmap.md) for phase status.

Video recording, sending/uploads, auditing, and dashcam offerings are outside project scope. GPS, geofencing, accelerometer/gyroscope readiness, phone mounting, and calibration remain in scope. Sensor events are observations, not confirmed fault or automatic penalties; financial responsibility remains a staff decision.

The web Fleet Tracker still uses mock fleet and behavior data. Its footage panels have been removed. Connecting retained metrics to active-trip data is a separate implementation phase.

Telematics navigation is always available to signed-in renters, but it is not a generic mobile feature. Laravel selects and explains the renter's relevant self-drive booking; the screen is locked when no applicable rental or handover prerequisite exists. Navigation visibility, telematics read access, staff Start Handover eligibility, renter setup mutation, Start Rental, and an active trip are separate decisions.

This document is the canonical domain guide. Operational API sequencing is in [telematics-handover-lifecycle.md](telematics-handover-lifecycle.md).

## Lifecycle

```text
confirmed self-drive booking
  -> finalized outgoing inspection with personnel + renter signatures
  -> setup_required
  -> staff starts handover
  -> in_progress
  -> ready_for_release
  -> staff Start Rental
  -> booking ongoing + vehicle rented + session released
  -> one actual trip may start
```

`Start Rental` is the only release action. There is no separate “release telematics” control, and renter clients cannot start the booking.

For handover timing, the stored `bookings.rental_start_at` date is authoritative. In standard mode, Laravel evaluates it in Jamjade's established `Asia/Manila` business timezone and does not trust the renter phone clock; Staff may start handover only when the booking is scheduled on the current Manila calendar date, so tomorrow's bookings remain blocked. Local/testing handover test mode explicitly relaxes this date gate for flow testing.

`telematics_setup_sessions.status` uses `locked`, `setup_required`, `in_progress`, `ready_for_release`, and `released`. `locked` is an internal precondition state; `setup_required` means finalized outgoing created the workflow; checks can be recorded only while staff handover is `in_progress`; in standard mode, `ready_for_release` means every latest required step, including the five calibration types, has passed; and `released` is written transactionally when the booking becomes `ongoing`. Local/testing handover test mode is an explicit exception: a real passing `phone_mount` attempt supplies the release-readiness projection while all other recorded results remain truthful and calibration evidence remains absent.

## Setup records and snapshots

One self-drive booking may have one `telematics_setup_session`. Each required check is append-only in `telematics_setup_steps`; retries create a higher `attempt_number`, and readiness uses the latest attempt for every type. The exact current types are `device_check`, `motion_permission`, `location_permission`, `background_location`, `gps_check`, `phone_mount`, `stationary_calibration`, `forward_calibration`, `braking_calibration`, `left_turn_calibration`, and `right_turn_calibration`. Step statuses are `pending`, `in_progress`, `passed`, and `failed`.

Reusable circles and polygons in `geofences` are default monitoring zones. Active defaults apply automatically to every eligible self-drive rental. Admin may add optional booking-specific zones before release; Staff can view zones but cannot manage them. No zone assignment, containment, or zone configuration is a handover or release requirement.

At Start Rental, Laravel copies active defaults into `booking_geofences` and freezes those settings together with the booking's custom zones. Geometry and entry/exit alert preferences remain unchanged throughout the released rental. Library edits, deactivation, and soft deletion affect future rentals only. See [geofence monitoring](geofence-monitoring.md).

## Data handling

Phase 3 evaluates a fresh setup fix only for GPS quality. Exact setup coordinates are neither retained in step evidence nor returned by the handover API. Zone membership is independent of readiness and is not evaluated by setup. See [telematics-device-location.md](telematics-device-location.md).

The existing active-trip location ingestion path now evaluates released monitoring zones server-side and records confirmed entry/exit events. It rejects client-claimed crossings and ignores duplicate or out-of-order points for transition decisions. First reliable membership is an initial state, not a crossing. Uncertain accuracy and proximity to an edge reset transition candidates. This backend capability and the website activity list do not implement continuous mobile collection, realtime notifications, or the live Fleet Tracker.

When active-trip capture is separately approved, individual location points are received with a device `captured_at` and server `received_at`; they belong in `telematics_location_points`. The current coordinate fields on `telematics_trips` are only the latest-state cache. Significant lifecycle or safety occurrences belong in `telematics_events`.

The mobile handover resource includes a `canStartTrip` read flag for a released ongoing booking when no trip is currently active. It is a capability projection, not a second-trip allowance: the trip service still enforces the one-trip-per-booking invariant even after an earlier trip has ended, and the current mobile setup flow does not start trips.

Raw accelerometer and gyroscope streams, opaque sensor payloads, behavior scoring, incident attribution, and automated penalties are not stored or inferred in this system. Parking or parked-mode detection is future work and must remain within the single released trip, not become a separate booking lifecycle.

## Mobile and privacy constraints

Phase 3 implements actual device capability checks, motion and location permission requests, inert background-task readiness, a fresh foreground GPS check, and renter phone-mount confirmation. It does not subscribe to sensors, register location updates, create trips, upload telemetry, simulate results, or implement calibration. In standard mode the final five calibration checks remain unavailable until a separately approved Phase 4; local/testing handover test mode may exercise release after a real mount pass without fabricating those checks.

Do not expose inspection signatures, check evidence, staff-only readiness details, another renter’s booking, or generic step-pass endpoints to mobile clients.
