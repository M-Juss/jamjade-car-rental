> **Historical archive — 2026-10-24.** This is a superseded working-copy snapshot, not current coding guidance. Read the [central implementation guide](../../telematics-master-plan.md). Historical plans, exclusions, platform targets, and verification statements below retain their original dates; relative Markdown links were rebased for this archive.

# Fleet Monitoring map and realtime updates

## Implemented increment — 2026-10-18

Consented foreground mobile GPS still reaches Laravel through the existing
latest-only HTTP endpoints, at most once per five seconds. This increment adds
an authorized latest-point map and Reverb notices to the management website.
It does not change mobile collection, consent, background behavior, staff
release, route retention, geofence evaluation or motion/classification.

Flow: mobile HTTP upload → encrypted latest point committed → queued empty
`fleet.changed` notice → private Reverb channel → authorized HTTP fleet read →
Google Maps marker updated. Reverb is the server-to-web notification transport;
it does not keep a mobile GPS watcher running in the background.

## Map read contract

`GET /admin/fleet-tracker` retains its stateful session, active Admin/Staff,
`view fleet tracker` permission, bounded pagination and `Cache-Control: no-store`.
Its existing `tracking` object adds nullable `location`:

```text
{ latitude: number, longitude: number, accuracy: number, expiresAt: ISO8601 }
```

`FleetTrackerService` returns a point only for an ongoing Self Drive or With
Assigned Driver rental with a released setup session, no physical receipt, a consented latest-only trip,
non-ended status and an unexpired encrypted latest value. Paused and stale
points may remain as the last known location, with the existing saved status and
last-location timestamp. The expiry boundary is inclusive: a point whose expiry
is now is withheld, even if scheduled deletion has not run. Unreleased, legacy
numeric-coordinate-only, missing, corrupt and expired values produce null.
Legacy current/start/end coordinates, routes, sensor streams,
session tokens, consent records and driving scores are not projected.

The map represents the current filtered list page (default 15 records), not an
unbounded fleet query. When there are multiple pages, its footer identifies the
page represented. Records without locations remain in the rental list.
The existing Fleet Monitoring cards, filters, heading and details sheet are the
visual precedents. The former demo map's fake geofence and traffic controls are
removed from its implementation. No zone overlays or route lines are added.

`FleetGoogleMap` uses the shared `loadGoogleMaps` singleton and Google's advanced
markers. It fits the first set of located rentals, updates existing marker
positions without recreating the map, supports centering, and opens the existing
detail sheet by click or keyboard. Marker labels include the plate/reference;
accessible titles include status, last shared time and GPS accuracy. Recent
points use the semantic primary token; paused/stale points use muted styling
and retain explicit status text. Expired points are removed by a client timer.
Read failures clear the data and unmount the map. Loading, empty, map failure,
permission denial and retry states are explicit.

## Reverb and authorization

`FleetMonitoringChanged` broadcasts on **private-fleet-monitoring**, as
**fleet.changed**, using the dedicated **fleet-monitoring** queue. Its payload is
empty, and its serialized event has no model, booking identifier, coordinates,
customer information or collection token. Queued or delayed events therefore
cannot replay a retained coordinate after expiry or receipt. A receiver always
reads current state through Laravel again.

`FleetMonitoringObserver` notices Booking creation/deletion/restoration and
status/vehicle/type/schedule updates, and TelematicsTrip creation/deletion and
status/latest-point changes. `FleetMonitoringPublisher` dispatches only after
commit, discards rollback callbacks and isolates enqueue failure from the
accepted business operation. Bulk expiry deletion does not emit an event; the
client expiry timer and periodic reconciliation cover it.

`POST /admin/broadcasting/auth` keeps the web cookie/CSRF middleware and the same
active-personnel/fleet permission boundary as the read endpoint. It uses
`AuthorizeFleetChannelRequest`, mirrored by `fleetChannelSchema`, to accept only
a bounded numeric-dot-numeric socket ID and the exact private channel; JSONP is
prohibited. Its response wraps the Reverb signature in the existing `data.auth`
envelope. `routes/channels.php` repeats the active Admin/Staff and permission
check with the web guard. A mobile bearer token cannot substitute for a web
session. The signature stays inside the socket client's authorization flow.

The web service uses Laravel Echo and Pusher's Reverb-compatible protocol, with
its custom authorization handler calling the existing centralized HTTP client.
Only an authorized successful initial fleet read opens the subscription.
Subscription success/reconnection schedules a fresh read; subscription errors
retry after ten seconds. Notices are coalesced for 750 ms and requests never
overlap: one pending follow-up replaces a backlog. Reads time out after ten
seconds and obsolete query responses are ignored. A 30-second visible-tab read,
visibility restoration, network restoration and manual Refresh reconcile missed
notices, status aging, expiry and permission/session changes. On denial the
points are cleared and the subscription is disconnected. An already-subscribed
revoked account could receive only empty notices until the next read; every
location read checks current authorization independently. No coordinates are
persisted in browser storage or application logs.

## Local setup and deployment

Reverb 1.12, Laravel Echo and pusher-js are installed and locked. No native mobile
package or rebuild is required for this increment. See `backend/.env.example`
and `web-frontend/.env.example` for all names. Generate unique server-side
`REVERB_APP_ID`, `REVERB_APP_KEY` and `REVERB_APP_SECRET`; keep the secret only in
Laravel's ignored environment/secret configuration. Set `BROADCAST_CONNECTION`
to `reverb`. The web's `NEXT_PUBLIC_REVERB_APP_KEY` must match the public app key.
It must never contain the signing secret.

For the local Mac website, server and browser host/port are `127.0.0.1:8080`,
with `REVERB_SCHEME=http` and `NEXT_PUBLIC_REVERB_SCHEME=http`. Set
`REVERB_ALLOWED_ORIGINS=localhost,127.0.0.1`; these are hostname patterns, not URLs.
Client events are disabled. Refresh Laravel configuration and restart Next.js
after changing its public build configuration. Run from `backend/`:

```bash
php artisan config:clear
php artisan reverb:start --host=127.0.0.1 --port=8080
php artisan queue:work --queue=fleet-monitoring --sleep=1 --tries=1 --timeout=10
```

The worker is restricted to notifications and does not process unrelated mail
or scheduled work. The existing latest-point deletion scheduler still needs to
run as documented in [foreground sharing](telematics-foreground-location.md).
Reverb and the worker must remain running; production needs a process manager.
Restart long-running workers/Reverb after code or configuration changes.

An HTTPS/public-tunnel website needs its own reachable TLS WebSocket endpoint,
`NEXT_PUBLIC_REVERB_SCHEME=https`, the browser-facing host/port and an explicit
allowed origin. Backend `REVERB_HOST/PORT/SCHEME` describe its publishing endpoint;
`REVERB_SERVER_HOST/PORT` describe the listening socket. Do not expose the local
server publicly with wildcard origins or put a backend signing secret in Next.js.
This increment configures the local Mac connection only. The client rejects
mixed-content socket configuration and continues its 30-second authorized reads.

Maps uses the existing browser-restricted `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` optionally overrides `DEMO_MAP_ID` for local
advanced-marker testing; use a project-owned Map ID for production. Google Maps
receives the map viewport through its normal provider requests; treat it as a
map service provider in deployment/privacy review. This increment does not add a
server geocoding request or send coordinates in Reverb payloads.

## Verification

Backend coverage checks the minimal point contract, paused/overdue visibility,
release/receipt/consent/type/expiry gates, legacy exclusion and corrupt ciphertext,
private-channel signatures, validation, role/account/permission denial, web vs
mobile authentication, post-commit delivery, rollback, observer changes and
transport failure isolation. A local private WebSocket smoke test received a
queued Laravel invalidation through the real Reverb server with an empty payload.

Browser verification uses synthetic rentals and mocked HTTP/socket messages with
the actual module, hook, services, Google Maps provider and shared controls. It
checks marker updates, keyboard details, expiry removal, small-screen layout,
permission failures and retry. It is separate from a physical phone-to-authenticated
web-map test; that end-to-end check remains to be completed on the customer's
consented active rental. No customer coordinates or credentials are included in
fixtures, logs or screenshots. Temporary verification routes are removed.

References: [Laravel 13 broadcasting](https://laravel.com/framework/docs/broadcasting),
[Reverb](https://laravel.com/framework/docs/reverb), and
[Google advanced marker migration](https://developers.google.com/maps/documentation/javascript/advanced-markers/migration).

Completed checks: full backend suite (812 tests, 4704 assertions) plus the
subsequent focused mobile-token/session regression (11 realtime tests, 41
assertions); PHP formatting, web lint, TypeScript and production build. Browser
checks covered 320/768/1280 px, actual Google Maps markers with synthetic locations,
notice-driven updates, pause styling, expiry, search, empty/error/retry states,
keyboard details and focus restoration. The dedicated local Reverb server and
worker were started; physical phone-to-authorized-web-map validation remains pending.
