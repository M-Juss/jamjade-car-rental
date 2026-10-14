# JamJade Web Management Portal

`web-frontend/` is the Next.js App Router application for JamJade marketing
pages and the authenticated Admin/Staff management portals. It uses the
Laravel backend for sessions, authorization, domain data, and mutations.

## Stack

- Next.js 16.2 with React 19.2 and TypeScript 5
- App Router under `src/app/`
- Tailwind CSS 4 with shadcn/ui and Radix primitives
- React Hook Form 7 with Zod 4 through `@hookform/resolvers`
- `@googlemaps/js-api-loader` for delivery, geofence, and fleet maps
- Recharts, React Big Calendar, Lucide, Sonner, and the existing installed UI
  dependencies listed in `package.json`

## Local setup

Install dependencies from this directory:

```bash
npm install
```

There is currently no tracked `web-frontend/.env.example`. Create the ignored
`.env.local` file locally with placeholder or environment-specific values for
the names consumed by `src/services/http/config.ts`, `next.config.ts`, and the
map components:

```dotenv
NEXT_PUBLIC_BACKEND_API=http://localhost:8000
NEXT_PUBLIC_BACKEND_API_TUNNEL=https://your-backend-tunnel.example.com
BACKEND_URL=http://127.0.0.1:8000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_browser_restricted_maps_key
```

The web client uses the local API when the browser is on a loopback address and
the tunnel URL for a non-loopback browser. Backend web routes are under `/admin`
and use the stateful Laravel session/cookie/CSRF flow; do not append `/api` to
the web API base URL. The browser Maps key is public application configuration,
but should still be restricted by origin and enabled APIs. Never commit real
keys, session values, or user data.

## Run and build

Start the development server from `web-frontend/`:

```bash
npm run dev
```

Other installed scripts are:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run start
npm run branding:sync
```

`branding:sync` copies the website logo exports used by the mobile and backend
assets. Native icon/splash consumers need a rebuild after an asset change.

## Authentication and portal boundaries

`src/services/http/` owns the centralized browser client, CSRF/session handling,
response envelopes, API errors, and asset URL mapping. `src/services/auth/`
loads `/admin/me`, logs in/out, and resolves the user's role and permissions.
`src/modules/management/shell/` provides the authenticated shell and access
guard. Routes under `/admin` are for the Admin role; routes under `/staff` are
filtered by the module permission registry and never replace backend checks.

The management registry in
`src/modules/management/shell/config/module-registry.ts` is the discovery map:

- `src/modules/management/dashboard/` owns dashboard summaries and calendar.
- `src/modules/management/bookings/` owns booking lists, status navigation,
  extracted workflow pieces, inspections, additional charges, and monitoring
  zone display.
- `src/modules/management/delivery/` owns pricing, route previews, and quote
  requests; `src/modules/management/geofences/`, `maintenance/`,
  `vehicles/`, `fleet-tracker/`, `verification/`, `reports/`, and `personnel/`
  own the corresponding management areas.
- `src/forms/<domain>/` owns submitting forms, `src/validations/<domain>/`
  owns Zod schemas, and `src/services/<domain>/` owns API calls, types, and
  camelCase-to-snake_case mapping.
- `src/components/ui/` contains shadcn primitives; `src/components/common/`
  contains reusable application controls and dialog/table shells.

Booking action order is centralized in
`src/modules/management/bookings/booking-next-action.ts` and
`booking-workflow.ts`. New booking workflow forms belong in
`src/forms/booking/`, and route entries should compose the module rather than
own workflow rules.

## Delivery, geofences, and verification

Delivery pricing is admin-only: the garage point, minimum fee, included distance,
and per-kilometre rate are maintained in Management → Delivery Pricing. Staff
with `manage bookings` can review a customer-selected route when it needs toll
review, approve a toll amount, or reject with a note. Quote expiry, route
revalidation, and booking consistency remain Laravel rules. See
[`docs/delivery-pricing.md`](../docs/delivery-pricing.md).

The geofence library's active circles/polygons and optional booking-specific
zones can be edited before release. `Start Rental` copies and freezes every
booking zone and alert setting; do not make zone configuration or containment a
setup/release gate. See [`docs/geofence-monitoring.md`](../docs/geofence-monitoring.md).

Self-drive verification currently shows a driver's license and UI “Proof of
Address” requirement. The backend document key is `proof_of_billing`. Passport
records may remain visible for legacy customers, but new uploads must not add a
passport option. Keep the mapping in `src/services/verification/` aligned with
the Laravel and mobile contracts.

Delivery route previews and geofence map editors use the shared
`src/lib/google-maps.ts` loader. New map consumers should call its
`loadGoogleMaps` singleton with `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` rather than
adding a component-level loader. The existing fleet map still has local loader
setup; avoid adding another copy and converge it only within a scoped fleet-map
change.

The marketing `DrivingInsights` content is presentation copy and does not prove
that a backend classifier or AI model is available. Treat the capstone's AI
classification work as planned unless the backend contract and implementation
are present.

## Verification and domain references

Run lint and TypeScript checks for every web application change. Run the
production build when routes, configuration, dependencies, or production
behavior change; documentation-only changes use `git diff --check`. A web test
foundation is not configured yet; establish it in a separate task before adding
Vitest or Testing Library tests.

Useful domain references:

- [`docs/README.md`](../docs/README.md)
- [`docs/project-status-and-roadmap.md`](../docs/project-status-and-roadmap.md)
- [`docs/user-roles-and-access.md`](../docs/user-roles-and-access.md)
- [`docs/booking-rental-lifecycle.md`](../docs/booking-rental-lifecycle.md)
- [`docs/delivery-pricing.md`](../docs/delivery-pricing.md)
- [`docs/geofence-monitoring.md`](../docs/geofence-monitoring.md)
- [`docs/vehicle-condition-architecture.md`](../docs/vehicle-condition-architecture.md)
- [`docs/maintenance-architecture.md`](../docs/maintenance-architecture.md)
