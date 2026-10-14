# Geofence monitoring

## Purpose and management

Geofences provide entry/exit information for self-drive rentals. They do not define an allowed driving area and never stop GPS, device setup, handover, rental release, or an active trip. No configured zones means no geofence events, not an invalid rental.

Admin manages default circle/polygon zones in the website Geofence Library. Every active default applies automatically. Admin may create, edit, or remove additional custom zones from a pending/confirmed booking's details before release. Defaults cannot be removed or replaced per booking. Staff can view library and booking zones/activity, while all zone mutations require the Admin role on Laravel. Mobile has no geofence-management or assignment API. Admin represents existing owner authority; no Owner role is introduced.

## Release and history

`geofences` holds editable defaults with `notify_on_enter` and `notify_on_exit`. `booking_geofences` holds custom pre-release definitions and default copies. Each row has `scope` (`default`/`custom`) and `frozen_at`. Pre-release website reads combine active defaults with custom zones without persisting default copies.

The existing authorized Start Rental transaction copies the current active defaults and freezes every booking zone. Editing, deactivating, or soft-deleting a default later affects future rentals only. All released booking zones are immutable, including their alert preferences. This version does not support active-rental zone changes. There is no single geofence reference on a setup session and no `geofence_check` step.

The forward migration preserves existing local zone geometry, treats prior booking boundaries as custom zones, freezes existing released rows using session release timestamps, and removes obsolete geofence readiness attempts. It can resume the partially applied MySQL schema change encountered during local development. Rolling back to a single-zone schema refuses to discard multiple booking zones.

## Crossing evaluation

The existing authorized started-trip location endpoint evaluates each frozen zone independently in its ingestion transaction under a trip lock. Zones may overlap. First reliable membership establishes a baseline and creates no entry/exit event. Remaining in the same state creates no repeated crossing event. A confirmed change creates a server-owned `geofence_enter` or `geofence_exit` significant event containing the saved zone identity/name, scope, and whether a website alert was requested. Ordinary location points remain route history.

Client-selected `current_zone` and client-claimed geofence events are rejected. Repeated captured timestamps are idempotent; older points may remain route history but cannot overwrite the latest-location cache or change zone state. Implausibly future timestamps are rejected. `telematics_geofence_states` stores independent confirmed/candidate membership and the last processed timestamp per trip/zone.

Development defaults in `config/telematics.php` require accuracy no worse than 50 m and a fix no older than 60 seconds, with the existing 10-second future skew allowance. A point within its accuracy plus a 10 m buffer of a circle/polygon boundary is uncertain. Uncertain observations retain the last confirmed membership and reset transition candidates. A change needs at least two reliable observations over at least 10 seconds. These are configurable operational defaults requiring physical verification, not a guarantee of exact crossing time.

## Website information and current limits

Booking details show default/custom zones, saved status, alert preferences, and the latest 30 confirmed crossings. Selected entry/exit directions show an Alert badge; unselected directions remain recorded activity. Open ongoing booking details refresh periodically. Reports show persisted booking zones; defaults are saved at release. Zone/activity details are omitted from booking lists to keep that path lightweight. This is website activity, not email, mobile push, realtime delivery, or an implemented global notification bell.

Continuous mobile trip collection, the live Fleet Tracker, calibration capture, background operation, offline delivery, consent and retention implementation remain their own phases. Existing mobile setup performs six readiness checks and never creates trips or starts tracking. Backend ingestion tests use explicit synthetic test coordinates and do not constitute physical iOS/Android verification.
