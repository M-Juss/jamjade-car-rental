# BerryPanel capstone deployment

Prepared 2026-11-12. Target: `jamjadecarrental.tech`, DNS managed in Hostinger.
The existing GitHub repository and its `main` branch are the selected source.
This is deployment preparation, not evidence of a successful hosted deployment.

## Project configuration

Use BerryPanel's **Node + Laravel Hosting** project type:

| Setting | Value |
| --- | --- |
| Repository | `https://github.com/M-Juss/jamjade-car-rental` |
| Branch | `main` (automatically selected by the combined-project form) |
| Backend folder | `/backend` |
| Frontend folder | `/web-frontend` |
| Laravel public directory | `/backend/public` |
| Frontend build | `npm run build` |
| Frontend production command | `npm run start` |

The Android app is built separately and calls the hosted Laravel API. It is not
another server process in this hosting project. The current APK must be rebuilt
with the final reachable HTTPS API URL before phone acceptance testing.

The manifest permits PHP 8.3, but the current production Composer lock includes
packages requiring PHP 8.4. Confirm PHP **8.4** and run
`composer check-platform-reqs --no-dev` on the server. The installed Next.js
16.2.4 package requires Node >=20.9; local deployment checks used Node 24.
Use MySQL, and confirm the host can build with the existing lockfiles.

## Environment and routing

Add secrets privately through the panel's environment editor. Keep
`APP_ENV=production`, `APP_DEBUG=false`, and both handover/early-start test flags
false. Keep `SESSION_DRIVER=database`, `CACHE_STORE=database`, and
`QUEUE_CONNECTION=database`; these tables are covered by migrations.
Set `INITIAL_OWNER_PASSWORD` to a private value of at least 12 characters before
the initial owner seed on a new database. Production seeding preserves an
existing owner's password. Use the seeder only for initial setup: it retains
legacy account reconciliation and is not a general deployment command.

The web API client already supports same-origin requests, and Next.js rewrites
forward API, CSRF, selected management requests, public storage, and PayPal paths
to `BACKEND_URL`. Confirm BerryPanel's actual backend URL and routing before
setting this variable: its current fallback is a local development server.
Use `NEXT_PUBLIC_BACKEND_API_TUNNEL=same-origin` for this existing same-origin
flow and set `NEXT_PUBLIC_BACKEND_API` as well, because the HTTP module requires
it at build time. The `NEXT_PUBLIC_*` values must exist when building the web app.

Set Laravel's `APP_URL` to its actual externally reachable HTTPS origin;
configure `SANCTUM_STATEFUL_DOMAINS`, secure session cookies and allowed origins
for the final website host. The exact values depend on whether BerryPanel exposes
Laravel through Next.js, a separate API hostname, or both. Do not assume that
`api.jamjadecarrental.tech` has already been provisioned. Use the existing HTTP
service and cookie/CSRF flow; test login, logout and authenticated mutations.
Set mail credentials, map keys/restrictions, and PayPal sandbox return/cancel
origins for those final URLs. Verify password/registration/owner-code emails.

To include RC Research, Model Explorer and rental RC motion, set:

```dotenv
TELEMATICS_CALIBRATION_PROFILE=rc_demo
TELEMATICS_HOSTED_RC_DEMO=true
```

This explicit hosted-demo switch does not enable rental-release test bypasses.
The [central telematics guide](telematics-master-plan.md#hosted-rc-demo-deployment--2026-11-12)
owns the implementation, model/data dependencies and remaining RC limitations.

## Initial deployment and data

The combined-project form requires a public GitHub repository. Prepare and review
the current working tree before committing/pushing to `main` and changing source
visibility. Existing local uncommitted files are not part of a GitHub deployment.
Ignore local `.env` files and runtime private storage; publish source assets only.

After the first build, configure the database and environment, then run
`php artisan optimize:clear` and `php artisan migrate --force`. For a fresh empty
demo database, initialize roles/owner with `php artisan db:seed --force` only after
the initial owner password is configured. If transferring the existing database,
preserve its account IDs, records and encrypted-data key instead of reseeding it.
Run `php artisan storage:link` for public vehicle assets.

Git does not carry the current database, uploaded vehicle files, receipts,
verification documents, research originals/labels/prepared signals or private
model. Transferring existing encrypted files and database fields also requires
the matching Laravel application key (or a separately designed re-encryption
step). Never regenerate that key after importing existing encrypted data.
Agree a private file/database transfer with the server owner; do not put the key
or research storage in the public repository. Keep server storage across redeploys.

Enable the scheduler. Configure queue workers to consume **both** `default` and
`fleet-monitoring` queues; for one worker the command can use
`--queue=fleet-monitoring,default`. `FleetMonitoringChanged` specifically uses
`fleet-monitoring`, so a default-only worker will miss those broadcasts.
Enable Reverb with reachable WSS routing and matching browser/backend settings.
If the panel's service controls do not expose these settings, use the server
owner's configuration access rather than assuming they were provisioned.

## Domain and verification

Add `jamjadecarrental.tech` in BerryPanel, then copy its generated verification
and routing records into Hostinger DNS. Use the displayed records; the guide's
CNAME example does not establish apex-domain support or authorize guessing an IP.
Preserve unrelated mail/DNS records. Verify and attach the hostname, then check
HTTPS before finalizing application URLs and rebuilding the Android app.

Check public pages, web login/logout, a permitted Admin mutation, mobile login,
registration email, booking/payment callbacks, images/PDFs, native chunk uploads,
Model Explorer's owner-bound records, RC inference and live Fleet Monitoring.
Verify the actual server body/time limits allow the existing chunk requests.
Outside local mode, per-owner upload budgets remain 100 recordings and 256 MiB;
the hosted-demo switch deliberately does not raise those budgets.

## Local verification — 2026-11-12

- Web lint, TypeScript in the completed production build, and `npm run build`
  passed after correcting Fleet Monitoring's click handlers. Node 24 was used;
  the default Node 25 binary cannot load its Homebrew simdjson dependency.
- Standalone web TypeScript, mobile lint and mobile TypeScript passed. Local
  `composer check-platform-reqs --no-dev` passed; the server still needs its own
  platform check.
- The focused backend suite passed 173 tests / 1,049 assertions, covering hosted
  opt-in/off behavior, Admin research-token scope, Model Explorer ownership,
  missing-model 503, calibration/release boundaries and initial owner passwords.
- `composer test` completed: 1,254 tests, 1,221 passed, 31 failures and 2 errors.
  The pre-change baseline had the same 31 failures and 2 errors, around location
  alert expectations, registration/password validation, booking/time formatting
  and fleet response expectations. This is not a clean whole-suite result.
- Scoped Pint passed. Full Pint's baseline failed in `VehicleRequest.php`,
  `OwnerProtectedActionsTest.php`, and `tests/Pest.php`; those unrelated files
  were not reformatted by the deployment changes.
- A limited historical credential-pattern scan checked 3,884 text blobs and
  found no matches. It is not a comprehensive credential or privacy audit.
- DNS address lookup returned no address for the target apex, `www`, or `api`
  hostname. Public-server, DNS/HTTPS, mail, payment, upload and physical Android
  checks remain pending. No public deployment is implied by local checks.

## Provider references

- [Combined Node + Laravel hosting](https://capstoneprototype.online/hosting-guide/node-laravel)
- [Environment variables](https://capstoneprototype.online/hosting-guide/environment-variables)
- [Databases](https://capstoneprototype.online/hosting-guide/databases)
- [Domains and HTTPS](https://capstoneprototype.online/hosting-guide/domains)
- [Background services](https://capstoneprototype.online/hosting-guide/background-services)
- [Restricted site terminal](https://capstoneprototype.online/hosting-guide/site-terminal)

The guide does not confirm installed runtimes, effective account quotas,
private-file transfer tools, build-time frontend environment support, exact
combined-project routing or the active plan's Reverb availability. The reported
server memory/disk capacity alone does not establish those capabilities.
