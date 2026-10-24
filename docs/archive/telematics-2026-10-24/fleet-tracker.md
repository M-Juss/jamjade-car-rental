> **Historical archive — 2026-10-24.** This is a superseded working-copy snapshot, not current coding guidance. Read the [central implementation guide](../../telematics-master-plan.md). Historical plans, exclusions, platform targets, and verification statements below retain their original dates; relative Markdown links were rebased for this archive.

# Fleet Monitoring

With Assigned Driver tracking — 2026-10-19: authorized latest-point reads and
map markers now include both rental types after staff release and operator GPS
consent. This supersedes the earlier self-drive-only tracking boundary below.
The fleet list continues to show all eligible ongoing bookings, including those
without a trip or current point.

Navigation update — 2026-10-18: Fleet Monitoring is a main sidebar entry outside
the Management group in both Admin and Staff portals, including the collapsed
sidebar and mobile menu. It reuses the existing main-link renderer. The module
ID, `/admin/fleet` and `/staff/fleet` pages, API route and `view fleet tracker`
permission retain their internal names; access rules and data contracts are
unchanged.

Navigation verification: isolated browser review with synthetic accounts
confirmed main-link placement while Management is closed, expanded/collapsed
desktop navigation, the 390 px Staff menu and hiding the link for Staff without
the existing fleet permission. The temporary preview was removed. No form or
API validation contract changed in this navigation update.

## Initial list increment — 2026-10-18

The management Fleet Monitoring reads real **ongoing bookings**, including overdue
rentals and rentals without a trip record. A returned/completed/cancelled booking
is excluded by booking status, not by its scheduled return time. Both rental
types appear, but tracking applies only to Self-Drive. Existing staff release,
setup/calibration, trip creation and collection behavior are unchanged.

The existing map/list layout, rental cards and detail sheet remain. Search,
filters and pagination reuse the shared management controls and Personnel's
debounced loading/error pattern. The detail sheet shows booking reference,
vehicle/plate, customer, rental type, scheduled start/return, tracking state and
last-location timestamp. Dates display in Asia/Manila without a visible timezone
suffix. Refresh explicitly reloads the list; there is no automatic polling yet.

The map shows an unavailable state. This screen no longer consumes the mock
fleet, scores, driving events or locations. Continuous mobile collection,
background collection, map markers, route history and AI classification are
not implemented by this increment. Retained unused demo components are not
connected to the management screen.

## Map and realtime follow-up — 2026-10-18

The map now uses authorized encrypted latest-point reads and private Reverb
invalidations. This supersedes the initial unavailable-map/manual-refresh
boundary above. The current filtered page supplies map markers; no routes or
behavior scores are added. See [the full map, auth and runtime contract](fleet-monitoring-realtime.md).

## Web API contract

`GET /admin/fleet-tracker` uses the existing stateful session flow and requires
an active Admin/Staff account with `view fleet tracker`. It is a read-only
endpoint and returns `Cache-Control: no-store`. The previously unused trip-list
response is replaced by the booking-based contract below; the production web
module and its new fleet service use this contract together.

`ListFleetRentalsRequest` is authoritative. The web `fleetQuerySchema` mirrors
client-verifiable filters; numeric pagination values become query strings in
the service boundary. Authorization and current booking/trip state remain
server-only rules. Search is trimmed and empty search is treated as absent.

| Query | Accepted values |
| --- | --- |
| `search` | Optional/null string, maximum 160 characters; booking code, customer name, vehicle name or plate |
| `status` | Optional tracking state from the table below |
| `rental_type` | Optional `self_drive` or `owners_driver` |
| `page` | Optional integer, minimum 1 |
| `per_page` | Optional integer, 1–100; default 15 |

Search and filters run before pagination. Ordering is scheduled return time,
then booking ID, so overdue rentals remain visible first. The envelope contains
`data` and `meta.current_page`, `last_page`, `per_page`, `total` (filtered count)
and `total_ongoing` (all ongoing bookings before search/type/status filters).

Each item exposes only `id`, `bookingCode`, `customerName`, `rentalType`,
`rentalStartAt`, `rentalEndAt`, `vehicle: {id, name, plateNumber}` or null,
and `tracking: {status, tripStatus, lastLocationAt, location}`. Timestamps use ISO 8601.
The added nullable location projects only a consented, released, unexpired latest
point as documented in the follow-up guide. The fleet resource does not return
routes, sensor readings,
financials, verification documents or inspection records. Related customer,
vehicle and trip fields are eagerly loaded with bounded selected columns.
One booking has at most one trip under the existing database constraint.

## Tracking projection

Foreground mobile sharing now updates the saved trip state and timestamp through
its separate latest-only endpoint. The existing Refresh and the new Reverb-triggered authorized reads show those changes, including map markers. See
[foreground sharing](telematics-foreground-location.md) for the encrypted point,
consent, expiry and future map-read contract.

These states describe saved records at request time. They do not establish
that a device is connected, background collection works or a vehicle is moving.

| API state | Display | Rule |
| --- | --- | --- |
| `not_started` | Not started | Supported rental without a trip |
| `awaiting_location` | Awaiting location | Started trip without `last_location_at` |
| `recent_location` | Recent location | Started trip whose last saved location timestamp is at or after the freshness cutoff |
| `no_recent_updates` | No recent updates | Started trip whose timestamp is before the cutoff |
| `paused` | Paused | Saved trip status is paused, regardless of location age |
| `ended` | Ended | Saved trip status is ended while the booking remains ongoing |
| `unavailable` | Unavailable | Telematics setup has not been released for this rental |

`config('telematics.fleet_location_recent_seconds')` currently sets the cutoff
to **120 seconds** before server time. This is a display freshness window,
not a validated sampling interval or a diagnosis of permission, GPS or network
failure. The server applies the same cutoff to returned states and filters.

## Verification

`tests/Feature/Web/Admin/FleetTrackerTest.php` covers lifecycle inclusion,
overdue/no-trip rentals, the minimal resource contract, all tracking states and
the exact freshness boundary, search/type/status filtering (including a literal
zero search), pagination totals, invalid queries, guests, inactive accounts,
role boundaries and permission denial.

Browser review used the real fleet module, hook, service and shared primitives
in a temporary isolated route with synthetic fetch responses, not live customer
records. Checked 320/768/1280-pixel layouts, search resetting pagination, page
navigation, combined filters, filtered/unfiltered empty states, pending/disabled
states, retry, 403/422/server errors, detail-sheet layout and keyboard open/close
with focus restored to its rental card. The preview route was removed afterward.
This verifies presentation and client handling separately from the backend
feature tests; authenticated browser-to-Laravel and physical device-to-map
testing remain separate checks. No mutation form or submission toast was added.

Completed checks on 2026-10-18: 15 targeted fleet tests (133 assertions),
full `composer test` (773 tests, 4518 assertions), `vendor/bin/pint --test`,
web `npm run lint`, `npx tsc --noEmit`, `npm run build` and `git diff --check`.
The final build required network access to fetch the existing Poppins font.
