# User roles and access: Staff and Driver

## Scope

This guide defines the implemented Staff/Driver separation and Personnel. Admin/Owner separation is deferred: the existing Admin role retains its current authority, and no separate Owner role or portal is introduced.

Accounts remain in `users`, with role membership in the existing Spatie tables. Staff and Driver are fixed, separate roles; neither role name nor its module permissions can be edited through Personnel. Customers continue using their existing mobile workflows.

## Access responsibilities

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

Staff's seeded web modules remain Dashboard, Booking Management, Vehicle Management, Self-Drive Verification, Fleet Tracker, Geofence Library, Maintenance Management, and Reports & Analytics. Delivery Pricing is an Admin-only management area; Staff may review delivery toll requests through Booking Management but cannot edit pricing. The migration preserves the existing Staff permission assignments; the seeder uses the centrally defined `staff_accessible` modules in `backend/config/staff_modules.php`. This guide does not change reporting or deferred Admin/Owner authority.

Driver mobile remains Services, Notifications, and Logout, with settlement through the existing Driver charge-payment flow. Driver-facing service endpoints require the Driver role and constrain records to the authenticated account's assignment. Customer booking/document/payment-creation routes require the Customer role. Driver access to shared notifications and payment capture remains governed by ownership and existing payment authorization.

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

## Geofence management

Admin manages default monitoring zones and custom booking zones on the website. Staff can read the library and booking zone/activity information, but Laravel denies all default-zone and custom-zone mutations to Staff, including direct calls with existing permissions. Geofence management remains separate from authorized Staff Start Handover and Start Rental. There is no separate Owner role.

## Telematics boundary and future work

Driver-assisted rentals do not use the current telematics setup/trip workflow. Telematics remains self-drive-only; Driver GPS streaming, accelerometer/gyroscope collection, calibration, and trip-status controls are future work requiring a separately approved design. Video recording, sending, auditing, and dashcam offerings remain outside scope.

Fleet Tracker currently uses mock fleet/activity data. Module access does not imply that live tracking or calibration is implemented. See [telematics architecture](telematics-architecture.md), [booking rental lifecycle](booking-rental-lifecycle.md), and [vehicle condition architecture](vehicle-condition-architecture.md).

## Verification

Backend regression coverage includes fixed-role validation, Admin-only account administration, removal of role/deletion endpoints, Driver web denial, assigned-service scoping, customer-route denial, active-assignment and charge safeguards, token revocation, and migration preservation/explicit mapping requirements. Web and mobile authentication mechanisms remain cookie/CSRF and Sanctum bearer tokens respectively.
