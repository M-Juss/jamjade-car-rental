# User roles and access: Staff and Driver

## Scope

This guide defines the implemented Staff/Driver separation and Personnel. Admin/Owner separation is deferred: the existing Admin role retains its current authority, and no separate Owner role or portal is introduced.

Accounts remain in `users`, with role membership in the existing Spatie tables. Staff and Driver are fixed, separate roles; neither role name nor its module permissions can be edited through Personnel. Customers continue using their existing mobile workflows.

## Access responsibilities

Local RC Research exception — 2026-10-17: an existing active Admin uses the normal
mobile sign-in when Laravel's local/testing `rc_demo` profile is enabled and goes
directly to an empty RC Research screen with sign-out. The server chooses an
eight-hour research-only bearer token; it cannot access other authenticated
mobile features. Admin mobile sign-in remains denied outside local/testing RC
mode, including mixed-role accounts. Customer/Driver destinations and web
authentication are unchanged. See [the entry contract](telematics-rc-demonstration.md#mobile-admin-entry).

| Function | Staff | Driver |
| --- | --- | --- |
| Main interface | Web Staff portal | Mobile Driver section |
| Booking access | Operational bookings | Assigned services only |
| Customer verification | Authorized document review | No access |
| Driver assignment | Assign eligible Drivers | Receive assignments |
| Inspections | Record/finalize authorized outgoing and incoming inspections | Participate/sign when required on the personnel device |
| Rental release and completion | Authorized Staff-controlled workflow | Cannot start, cancel, return, or complete rentals |
| Additional charges | Authorized creation and responsibility decisions | View/pay their own obligations |
| Personnel | No access | No access |
| Custom roles/module access editing | Unavailable | Unavailable |

Staff's seeded web modules remain Dashboard, Booking Management, Vehicle Management, Self-Drive Verification, Fleet Monitoring, Geofence Library, Maintenance Management, and Reports & Analytics. Pricing Settings (Delivery Pricing and Late Returns) is an Admin-only management area; Staff may review delivery toll requests through Booking Management but cannot edit pricing. The migration preserves the existing Staff permission assignments; the seeder uses the centrally defined `staff_accessible` modules in `backend/config/staff_modules.php`. This guide does not change reporting or deferred Admin/Owner authority.

Driver mobile remains Services, Notifications, and Logout, with settlement through the existing Driver charge-payment flow. Driver-facing service endpoints require the Driver role and constrain records to the authenticated account's assignment. Customer booking/document/payment-creation routes require the Customer role. Driver access to shared notifications and payment capture remains governed by ownership and existing payment authorization.

Manual booking cancellation is a web Admin/Staff action requiring `manage bookings`. Customer mobile has no cancellation control or endpoint; customers can still view saved cancellation and refund outcomes. Automatic payment-deadline cancellation is unchanged.

## Management navigation counts

`GET /admin/navigation-counts` is a stateful management read. It returns only aggregate counts, with `null` for modules the user cannot access. Booking requires `manage bookings`; Self-Drive Verification requires `review documents`. Accounts with neither permission, inactive accounts, and non-management roles cannot read the endpoint.

The Booking sidebar count combines unexpired toll requests awaiting review with confirmed bookings that have not started, whose rental start date is today or earlier in Asia/Manila and whose rental end is still in the future. Today's later scheduled pickups count; future-date, expired, pending-payment, ongoing, and terminal bookings do not. Earlier pickups remain counted while their reserved interval is open. The separate Toll Reviews button continues to count only its own pending requests.

Self-Drive Verification counts individual pending driver's license and proof-of-address documents owned by Customers. Front/back files do not increment the count separately; approved, rejected, deleted, and legacy document types do not count. The web customer review label is Pending for `pending_review`. For `documents_required`, it is No documents when every required document is missing and Incomplete when some have been submitted. Existing correction and age statuses retain their priority; eligibility and API status keys are unchanged.

Both sidebar items use the shared yellow circular corner counter, hidden at zero and capped visually at 99+ while accessible text retains the full number. Expanded, collapsed, and mobile navigation share the same counts. Counts refresh every 30 seconds while visible, on focus/visibility return and navigation, and after relevant successful booking, document, and toll-review actions. Loading and failed reads show indicators rather than a fabricated zero.

## Customer account information

The mobile Customer Profile separates personal details from sign-in credentials. Customer-only, authenticated `PUT /api/mobile/account/email` and `PUT /api/mobile/account/password` endpoints require the current password and share a five-attempt-per-minute limit per account. Personal profile update endpoints prohibit email changes; onboarding and personal editors submit no email field.

Email changes are immediate after format, uniqueness, and current-password validation. They clear any prior `email_verified_at`; verification emails/OTPs are deliberately deferred for this phase. Password changes require a different replacement with confirmation, follow the current eight-character minimum and a 72 UTF-8 byte bcrypt limit, revoke mobile tokens, and rotate the remember token. The current phone returns to sign-in. These actions do not require profile completion and do not modify roles or account activation.

## Personnel

The existing Admin controls the web page `/admin/personnel` and these cookie/CSRF-protected endpoints:

- `GET /admin/personnel`: paginated Staff/Driver account list, summary, and fixed role choices.
- `POST /admin/personnel/users`: create a Staff or Driver account.
- `PUT /admin/personnel/users/{user}`: edit account details, credentials, role, or active status.

Personnel uses one table with an All Personnel, Staff, or Driver filter in the search card and a shared account form. All Personnel is the default view; each row shows its role. The backend response supplies the authoritative `category`, `personnelId`, and role. `PER-` identifiers are display values derived from the existing user ID, not a new identity table or persisted identifier.

Names, email, optional phone, role, password, and account status are validated by `StorePersonnelRequest` / `UpdatePersonnelRequest`. The web form uses the corresponding `createPersonnelAccountSchema`. Camel-case form values are mapped to snake-case payload fields in the personnel service. Modules and permissions cannot be supplied as account fields.

There are no account deletion or custom-role mutation endpoints. Account removal uses deactivation, preserving Driver assignment attribution, charges, payments, inspection signatures, and other rental history.

## Account status and role changes

- Ordinary contact updates remain available during an assigned service.
- A pending, confirmed, or ongoing Driver assignment blocks deactivation and Staff/Driver conversion. Reassign pre-release services or finish ongoing services first.
- An outstanding Driver-responsible charge blocks deactivation and conversion until settled. Debt alone does not disable login, notifications, settlement, or an existing service.
- An unassigned account with no outstanding Driver obligations may change between Staff and Driver.
- Admin, Customer, and mixed-role accounts cannot be edited through Personnel.
- Deactivation, role conversion, and password changes revoke mobile tokens and rotate the remember token. Inactive accounts are denied on authenticated mobile and management web requests. Driver roles are denied on management web requests, including stale sessions and direct permission grants.
- Role conversion removes direct permission grants so the destination role cannot inherit previous custom privileges.

## Migration

`2026_09_29_000002_fix_personnel_roles` removes legacy Driver role/direct permissions, retires unused custom web roles, and renames the existing personnel-administration permission to `manage personnel`. It preserves account and rental records and existing Staff grants.

Assigned custom roles or mixed Driver roles cause the migration to stop with an explicit mapping requirement. It does not silently convert their accounts. Owner is excluded from custom-role retirement because the Admin/Owner design is deferred. Retired permissions cannot be reconstructed by rollback; use a pre-migration backup if restoration is necessary.

## Vehicle configuration

Vehicle Management → Configure and its mutation endpoints are Admin-only. Staff with vehicle, booking, or maintenance permissions may read active options for their operational forms. The vehicle-management permission does not grant shared configuration management. See [vehicle configuration](vehicle-configuration.md).

## Geofence management

Admin manages default monitoring zones and custom booking zones on the website. Staff can read the library and booking zone/activity information, but Laravel denies all default-zone and custom-zone mutations to Staff, including direct calls with existing permissions. Geofence management remains separate from authorized Staff Start Handover and Start Rental. There is no separate Owner role.

## Telematics boundary and future work

Self Drive telematics is operated by the owning Customer; With Assigned Driver telematics is operated by the current assigned Driver. Driver Services provides entry to the assigned rental's setup and activity screens, while Laravel checks assignment and setup eligibility on every read and mutation. Staff retains inspection and rental release authority. Video recording, sending, auditing, and dashcam offerings remain outside scope.

Fleet Monitoring reads real ongoing bookings and saved tracking states for active Admin/Staff accounts with `view fleet tracker`. Its minimal resource excludes precise coordinates, route history and driving scores; the map remains unavailable. Module access does not imply live tracking or physically verified calibration. See [Fleet Monitoring](fleet-tracker.md). The Customer Self Drive and assigned Driver flows use explicitly consented pre-release setup/calibration and post-release latest-location sharing; see [calibration](telematics-calibration.md). See [telematics architecture](telematics-architecture.md), [booking rental lifecycle](booking-rental-lifecycle.md), and [vehicle condition architecture](vehicle-condition-architecture.md).

## Verification

Navigation count update verified on 2026-10-16: all 424 backend tests passed with a 512 MB PHP memory limit, PHP formatting passed, and web lint, TypeScript and the production build passed. Isolated browser fixtures exercised expanded/collapsed desktop and 390 px mobile navigation, zero/99+/unavailable states, the three verification labels, and immediate counter refresh after simulated start/cancel, document approval/rejection and toll review. The preview and scoped worker were removed. These checks did not alter live bookings, documents, or toll requests.

Backend regression coverage includes fixed-role validation, Admin-only account administration, removal of role/deletion endpoints, Driver web denial, assigned-service scoping, customer-route denial, active-assignment and charge safeguards, token revocation, and migration preservation/explicit mapping requirements. Web and mobile authentication mechanisms remain cookie/CSRF and Sanctum bearer tokens respectively.
