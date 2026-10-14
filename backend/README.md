# JamJade Car Rental API

`backend/` is the Laravel API and shared domain layer for the JamJade web
management portal and Expo mobile app. It owns persistence, validation,
authorization, booking and payment workflows, document review, delivery quotes,
vehicle operations, and the telematics handover boundary.

## Stack

- PHP 8.3 or newer with Laravel 13.9.0 (the installed lockfile release)
- MySQL by default for local development, with Laravel database sessions,
  queues, and cache configured through `.env`
- Laravel Sanctum 4.3.2 for mobile bearer tokens
- Spatie Permission 7.4.1 and Activitylog 5.0.0 for personnel access and audit trails
- Dompdf 3.1.2 for booking/report PDFs and Intervention Image 4.1.2 for image work
- Vite 8, Tailwind CSS 4, and the Laravel Vite plugin for backend assets
- Pest 4 with the Laravel plugin and Laravel Pint for verification

## Local setup

From this directory, create `.env` from `.env.example`, fill in local database
and integration values, then run the repository setup script:

```bash
composer run setup
```

The script installs Composer and npm dependencies, generates `APP_KEY`, runs
migrations, and builds Vite assets. Use it for a fresh local install. On an
already initialized clone, do not rerun the key-generation step: rotating
`APP_KEY` can make encrypted delivery data unreadable. Install dependencies and
run only the migrations or asset build that the change requires. The example
configuration uses the following
local connection and browser/mobile integration names:

```dotenv
APP_URL=http://localhost
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=backend
DB_USERNAME=your_local_user
DB_PASSWORD=your_local_password
SESSION_DRIVER=database
SANCTUM_STATEFUL_DOMAINS=localhost:3000,127.0.0.1:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
GOOGLE_MAPS_SERVER_KEY=your_server_only_key
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
```

Mail, object storage, PayPal return/cancel URLs, and queue behavior are also
configured in `.env.example`. Keep real credentials in the ignored `.env` only;
the server-only Maps key must never be exposed through a `NEXT_PUBLIC_` or
`EXPO_PUBLIC_` variable.

## Run the API

Use the Laravel server on port 8000 for web and device development:

```bash
composer run serve-mobile
```

For the normal local stack, `composer run dev` starts the API, queue listener,
Pail logs, and Vite together. The API is available under `/api`; web routes for
PayPal redirects and the management session remain under the web route group.

## Authentication and route contracts

- Web management requests use stateful Laravel sessions, cookies, and CSRF.
  Login and management endpoints are under `/admin`; middleware checks
  `auth`, `active_admin`, roles, and permissions. Admin and staff portals are
  separate UI shells over the same authorized web routes.
- Mobile customers and assigned Drivers use Sanctum bearer tokens under
  `/api/mobile`. Public login/register and vehicle reads are throttled; the
  authenticated group uses `auth:sanctum`, `active_user`, and mobile throttles.
  Tokens are issued and persisted by the mobile client through SecureStore.
- Laravel Form Requests under `app/Http/Requests/` define accepted input and
  normalization. API Resources under `app/Http/Resources/` define response
  shapes. Keep frontend Zod schemas, request types, and mappings synchronized
  when either contract changes.

The current high-value mobile endpoints include `/mobile/profile`,
`/mobile/documents`, `/mobile/bookings`, `/mobile/delivery`,
`/mobile/account/email`, `/mobile/account/password`, payment/PayPal routes,
notifications, and telematics setup/trip routes. Web management routes cover
bookings and inspections, delivery quote review, delivery pricing, vehicles,
maintenance, reports, personnel, verification, geofences, and fleet tracking.

## Domain ownership

- `app/Http/Controllers/` authorizes and dispatches; it should stay thin.
- `app/Services/` owns reusable workflows such as `BookingService`,
  `DeliveryQuoteService`, `DeliveryPricingService`, `DocumentVerificationService`,
  `VehicleInspectionService`, and the telematics services.
- `app/Models/`, `app/Enums/`, and `database/` own persistence and state
  vocabulary. Use migrations for schema changes and factories/seeders for test
  data.
- `app/Policies/` and Spatie permissions own authorization. Frontend guards are
  navigation aids and do not replace these checks.
- `app/Http/Resources/` is the only public model projection boundary. Do not
  return internal model columns or finalized inspection details through public
  vehicle/mobile resources.

Delivery pricing is administrator-only. Staff with `manage bookings` can review
customer route offers where a toll needs an amount decision; customer booking
creation accepts only a valid complete quote. Self-drive monitoring defaults and
optional booking zones are mutable before release, then copied and frozen at
`Start Rental`; zone configuration and containment do not gate setup or release.
Self-drive verification requires a driver's license and `proof_of_billing` (the
mobile UI label is “Proof of Address”); passport rows are legacy-readable only.

## Verification

Run checks from `backend/`:

```bash
composer test
vendor/bin/pint --test
npm run build
```

Use focused Pest files while iterating, for example the API feature tests under
`tests/Feature/Api/Mobile/`, the web feature tests under
`tests/Feature/Web/Admin/`, and the domain tests near
the changed service. `npm run build` is required when backend Vite assets change.
Documentation-only edits use `git diff --check` and do not require an asset
build.

## Domain documentation

- [Documentation map](../docs/README.md)
- [Project status and roadmap](../docs/project-status-and-roadmap.md)
- [User roles and access](../docs/user-roles-and-access.md)
- [Booking and rental lifecycle](../docs/booking-rental-lifecycle.md)
- [Delivery pricing and toll review](../docs/delivery-pricing.md)
- [Geofence monitoring](../docs/geofence-monitoring.md)
- [Telematics architecture](../docs/telematics-architecture.md)
- [Telematics handover lifecycle](../docs/telematics-handover-lifecycle.md)
- [Device and location readiness](../docs/telematics-device-location.md)
- [Vehicle condition architecture](../docs/vehicle-condition-architecture.md)
- [Maintenance architecture](../docs/maintenance-architecture.md)
- [ERD relationships](../docs/ERD-relationships.md)
