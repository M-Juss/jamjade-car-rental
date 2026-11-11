# User roles and access: Staff and Driver

## Scope

This guide defines the implemented Staff/Driver separation and Personnel. The identified JamJade account has Owner membership alongside Admin membership. Owner membership grants Admin account creation and revocation controls in Personnel. The Owner uses the existing Admin portal.

Accounts remain in `users`, with role membership in the existing Spatie tables. Staff and Driver are fixed, separate roles; neither role name nor its module permissions can be edited through Personnel. Customers continue using their existing mobile workflows.

## Access responsibilities

Admin RC Research: an existing active Admin uses normal mobile sign-in when
Laravel's local/testing `rc_demo` profile is enabled. The implemented destination
has Data / Collect / Logout and explicit local native v2 recording. Its
eight-hour research-only bearer token cannot access ordinary mobile features;
web session authentication remains separate. Access outside local/testing RC mode
is not implemented. The Admin website now has separate read-only, owner-scoped
recording list/sample endpoints under `/admin/rc-research/trials`, using its normal
web session and the same active RC-mode restriction. These do not authorize web
cookies on mobile research routes or mobile tokens on web routes. See
[the central access contract](telematics-master-plan.md#existing-rc-research-v1).

| Function | Staff | Driver |
| --- | --- | --- |
| Main interface | Web Staff portal | Mobile Driver section |
| Booking access | Operational bookings | Assigned services only |
| Customer verification | Authorized document review | No access |
| Driver assignment | Assign eligible Drivers | Receive assignments |
| Inspections | Record/finalize authorized outgoing and incoming inspections | Participate/sign when required on the personnel device |
| Rental release and completion | Authorized Staff-controlled workflow | Cannot start, cancel, return, or complete rentals |
| Additional charges | Authorized creation and responsibility decisions | View/pay their own obligations |
| Personnel | View Staff and Driver accounts; create, edit, and delete Drivers | No access |
| Custom roles/module access editing | Unavailable | Unavailable |

Staff's seeded web modules remain Dashboard, Booking Management, Vehicle Management, Self-Drive Verification, Fleet Monitoring, Geofence Library, Maintenance Management, and Reports and Analytics. Pricing Settings (Delivery Pricing and Late Returns) is an Admin-only management area; Staff may review delivery toll requests through Booking Management but cannot edit pricing. The migration preserves the existing Staff permission assignments; the seeder uses the centrally defined `staff_accessible` modules in `backend/config/staff_modules.php`. Existing reporting and module permissions remain unchanged.

Driver mobile remains Services, Notifications, and Logout, with settlement through the existing Driver charge-payment flow. Driver-facing service endpoints require the Driver role and constrain records to the authenticated account's assignment. Customer booking/document/payment-creation routes require the Customer role. Driver access to shared notifications and payment capture remains governed by ownership and existing payment authorization.

Manual booking cancellation is a web Admin/Staff action requiring `manage bookings`. Customer mobile has no cancellation control or endpoint; customers can still view saved cancellation and refund outcomes. Automatic payment-deadline cancellation is unchanged.

## Management navigation counts

`GET /admin/navigation-counts` is a stateful management read. It returns only aggregate counts, with `null` for modules the user cannot access. Booking requires `manage bookings`; Self-Drive Verification requires `review documents`. Accounts with neither permission, inactive accounts, and non-management roles cannot read the endpoint.

The Booking sidebar count combines unexpired toll requests awaiting review with confirmed bookings that have not started, whose rental start date is today or earlier in Asia/Manila and whose rental end is still in the future. Today's later scheduled pickups count; future-date, expired, pending-payment, ongoing, and terminal bookings do not. Earlier pickups remain counted while their reserved interval is open. The separate Toll Reviews button continues to count only its own pending requests.

Self-Drive Verification counts individual pending driver's license and proof-of-address documents owned by Customers. Front/back files do not increment the count separately; approved, rejected, deleted, and legacy document types do not count. The web customer review label is Pending for `pending_review`. For `documents_required`, it is No documents when every required document is missing and Incomplete when some have been submitted. Existing correction and age statuses retain their priority; eligibility and API status keys are unchanged.

Both sidebar items use the shared yellow circular corner counter, hidden at zero and capped visually at 99+ while accessible text retains the full number. Expanded, collapsed, and mobile navigation share the same counts. Counts refresh every 30 seconds while visible, on focus/visibility return and navigation, and after relevant successful booking, document, and toll-review actions. Loading and failed reads show indicators rather than a fabricated zero.

## Customer account information

Driver mobile UI alignment — 2026-11-11: Services reuses Customer booking cards,
status badges, compact actions, loading surfaces and the shared header. It has
search, Upcoming/Active/History filters, pull-to-refresh and focused 15-second
refreshes for web assignment/status changes. The service API adapter traverses
all returned pages. Notifications open the selected assigned service, Driver
payment, or telematics Activity. The new protected `driver-services/[bookingId]`
route reuses the booking detail screen with the Driver-owned endpoint.
Driver details show vehicle, customer contact, schedule, pickup/return,
navigation, own charges and timeline, hiding Customer pricing/payment/receipts.
Driver delivery navigation does not call the Customer-only estimate endpoint.
The charge screen uses the same compact header typography and plain back icon.
No backend role, API contract or Staff release authority changed.

Verified document editing — 2026-11-11: Customers can select **Edit & resubmit**
on their approved driver's license or proof of address. The mobile editor keeps
existing license details but requires fresh images using the existing upload
contract; Cancel leaves the approved record and eligibility unchanged. A
successful upload replaces only that customer's same-type document, changes it
to pending, clears the prior reviewer/review time/rejection reason and recomputes
self-drive eligibility. Eligibility returns once all required documents are
approved again and the customer meets the other self-drive requirements.
Pending submissions remain locked; rejected submissions
retain their correction flow. Upload rechecks the current row under locks inside
its transaction. No request/Resource field, role or review permission changes.

Sources: `backend/app/Services/DocumentVerificationService.php`,
`mobile-frontend/forms/profile/ProfileDocumentVerificationForm.tsx` and the
existing upload Form Request, document service and Zod schema. Verification:
31 focused mobile-document/Admin-review tests passed (188 assertions). Scoped
PHP formatting, mobile TypeScript and the ARM64 release build passed. The release
sourcemap matches the current document form and shared vehicle summary sources.
The update installed successfully on the Redmi using `adb install -r`, preserving
app data. Customer submission and subsequent staff reapproval remain manual
device checks; no live customer's document was replaced during verification.

### Emergency contact for self-drive

Self-drive requires a customer aged 18 or older, an approved driver's license
and proof of address, and a saved emergency contact with a name, relationship,
and phone number. Staff can approve documents while the contact is missing.
Once age and document requirements are met, Self-Drive Verification shows
**Emergency contact required** until the customer saves the contact in Profile.
Customers can skip this step during onboarding and book with an assigned driver.

`SelfDriveVerificationService` checks the saved contact for the management list,
its eligibility filters, and mobile profile eligibility. `BookingService`
checks it before creating a self-drive booking through either payment path.
`RentalReadinessService` checks it again before standard vehicle release.
The mobile `selfDriveReviewStatus` explains the eligibility result independently
of the document approval status.

Verification on 2026-11-11 covered management filters and details, mobile
eligibility before and after saving a contact, assigned-driver booking, and
self-drive release. The 229 focused backend tests, scoped PHP formatting,
web and mobile lint and type checks, and web production build passed.
The full backend suite reproduced
five existing failures in booking time formatting and overlap tests against
the prior code. Live browser and Android checks are pending.

### Mobile sign-in credentials

The mobile Customer Profile separates personal details from sign-in credentials. Customer-only, authenticated `PUT /api/mobile/account/email` and `PUT /api/mobile/account/password` endpoints require the current password and share a five-attempt-per-minute limit per account. Personal profile update endpoints prohibit email changes; onboarding and personal editors submit no email field.

Email changes are immediate after format, uniqueness, and current-password validation. They clear any prior `email_verified_at`; the registration OTP below does not extend to account email changes. Password changes require a different replacement with confirmation, follow the current eight-character minimum and a 72 UTF-8 byte bcrypt limit, revoke mobile tokens, and rotate the remember token. The current phone returns to sign-in. These actions do not require profile completion and do not modify roles or account activation.

## Mobile registration email verification

New Customer registration requires a six-digit email code before creating an
account. This prevents an unverified registration from obtaining a mobile token
or reserving a permanent account. Existing Customers, Drivers, and the restricted
Admin research login keep their existing sign-in behavior; a null
`email_verified_at` alone is not a login restriction.

The public contracts are:

- `POST /api/mobile/register` validates the existing email/password/confirmation
  payload and optional phone/device fields, sends a code through Laravel's
  configured mail transport, and returns `202` with `registrationId`, `email`,
  `expiresAt`, and `resendAvailableAt`. It returns no User or bearer token.
- `POST /api/mobile/register/verify` accepts `registration_id` and a string `code`
  containing exactly six ASCII digits. Successful verification returns `201` with
  the established `tokenType`, `token`, and User Resource response. Customer,
  profile, verified-email timestamp, and token are created atomically.
- `POST /api/mobile/register/resend` accepts `registration_id` and returns `200`
  with refreshed pending-registration metadata after successful delivery.

Codes expire after 15 minutes. Resending requires 60 seconds, replaces the old
code, and starts a fresh 15-minute code lifetime within a maximum 24-hour pending
registration lifetime. Resend requires at least 15 minutes remaining in that
lifetime; otherwise registration must restart. Five incorrect guesses exhaust a
registration; resending does not reset that count. Restarting after the cooldown
replaces the old registration ID and code. Shared issuance limits apply across
restarts: five attempts per hour per normalized email and twenty per hour per IP,
including unsuccessful issuance requests. Verification permits ten requests per
minute per IP. Laravel rechecks email/phone uniqueness
before creating the account. SMTP failure returns a safe failure response rather
than reporting that a code was sent.

Registration passwords retain the eight-character minimum and are limited to 72
UTF-8 bytes, matching bcrypt's input limit; Laravel and the mobile schema enforce
the same rule before code delivery. Pending registration stores password and code
hashes separately from `users`.
The opaque registration ID is submitted in request bodies, never navigation URLs.
The mobile flow keeps pending metadata only in memory, clears password fields
after initiation, displays six code boxes, and stores an auth token through the
existing secure-storage abstraction only after successful verification. Leaving
or restarting the app can require starting registration again. The registration
email uses a solid JamJade blue backdrop and a white card, with HTML and plain-text
parts and explicit 15-minute expiry copy. The hourly
`mobile-registration:purge` scheduler task removes pending records after their
absolute expiry; deployment must keep Laravel's scheduler running.

The OTP screen renders six display boxes over one focusable native input. The
native input's drawing is hidden with opacity, preventing Android text rendering
from duplicating the code over the boxes. The visible expiry countdown and its
local button lock are removed; Laravel retains the 15-minute expiry and returns
expired-code validation errors. The resend cooldown remains separate.

The OTP display correction passed TypeScript, changed-file ESLint,
`npm run lint`, and `git diff --check` on 2026-11-11. The local ARM64 release APK
built successfully. Its embedded bundle omits the expiry-countdown text while
retaining resend cooldown text; its signing certificate matches the installed
app. The update installed successfully with `adb install -r`, preserving app
data. The overlapping native drawing was identified from the supplied screenshot;
the corrected visual state and keyboard interaction still need confirmation on
the phone.

Registration start and resend wait up to 60 seconds for the synchronous SMTP
response. The normal four-second mobile backend-fallback deadline can abort a
request after the email has already been sent, preventing the pending metadata
from reaching the OTP screen. These two email requests use a longer response
deadline and do not replay the POST against another backend after that deadline
expires. Immediate transport failures retain the existing backend failover.
The scoped response deadline is owned by `services/http/client.ts` and
`services/http/types.ts`; `services/api/auth.service.ts` opts registration and
resend into it. A deadline failure uses client status `408`, with delivery-delay
copy in the registration forms instead of an internet-connectivity message.

The timeout regression checks passed on 2026-11-11: 14 focused transport/service
checks, TypeScript, changed-file ESLint, `npm run lint`, and
`git diff --check`. The delayed-response test honors AbortSignal and confirms that
a mail response beyond the short fallback deadline still returns pending metadata
once. Other cases cover explicit timeout without replay, ordinary GET fallback,
immediate transport-error fallback, and the registration/resend-only timeout
configuration. These simulated checks do not establish live Gmail delivery time.

The connected phone had a standalone release build, so Metro reload was
insufficient. A local ARM64 release build completed successfully with Java 17
and the existing offline Gradle dependencies. Its signing certificate matched the
installed APK, and its embedded bundle contained the response-timeout option and
delivery-delay copy. `adb install -r` completed successfully, preserving app data.
The actual registration/OTP interaction still requires a fresh attempt on the
phone; no email was sent by the verification tools.

Implementation sources include `backend/app/Services/AuthService.php`, the auth
Form Requests and mobile AuthController, `PendingMobileRegistration`,
`VerifyMobileRegistrationMail`, and
`2026_11_11_050000_create_pending_mobile_registrations_table.php`. Mobile uses
`forms/auth/RegisterForm.tsx`, `RegistrationVerificationForm.tsx`,
`validation/auth/schemas.ts`, `services/api/auth.service.ts`, and
`providers/AuthProvider.tsx`.

Verification on 2026-11-11: all 23 focused OTP tests passed (155 assertions),
including mail failure rollback, code expiry/replay, leading zeros, resend and
restart behavior, guess and issuance limits, uniqueness rechecks, optional
phone/device preservation, password byte limits, and expiry pruning. All 312
mobile Node checks passed, along with the six focused auth/schema checks,
TypeScript, changed-file ESLint, `npm run lint`, and Android Expo export. The
installed Expo lint command covers its default app/component inputs; a separate
whole-project ESLint run still reports the existing hooks-rule error in
`services/http/config.ts:73`. PHP formatting and `git diff --check` passed. Only
the new pending-registration migration was applied locally.

The final sequential `composer test` run completed with 1,183 passing tests out
of 1,184 (7,295 assertions). The sole failure is outside registration:
`ModelExplorerTest` compares the exact order of equivalent `Cache-Control`
directives (`private, no-store` versus `no-store, private`). OTP, account,
onboarding, email, and payment checks passed in that run. This final run supersedes
an earlier run that overlapped other checks using shared temporary storage.

The local mail configuration was checked without exposing credentials and uses
Gmail SMTP. No live email was sent. No Android device was connected, so keyboard,
paste, screen-reader, large-text, and edge-to-edge behavior remain to be checked
on a phone. Synthetic HTML rendered successfully; browser visual preview was
blocked by the local-file URL policy. These checks do not establish Gmail inbox
delivery or mail-client appearance.

## Personnel

The existing Admin controls the web page `/admin/personnel` and these cookie/CSRF-protected endpoints:

- `GET /admin/personnel`: paginated Staff/Driver account list, summary, and fixed role choices.
- `POST /admin/personnel/users`: create a Staff or Driver account.
- `PUT /admin/personnel/users/{user}`: edit account details, credentials, role, or active status.
- `DELETE /admin/personnel/users/{user}`: soft-delete a Staff or Driver account.

Personnel uses one table with an All Personnel, Staff, or Driver filter (plus Admin for the Owner) in the search card and a shared account form. All Personnel is the default view; each row shows its role. The backend response supplies the authoritative `category`, `personnelId`, and role. `PER-` identifiers are display values derived from the existing user ID, not a new identity table or persisted identifier.

Names, email, optional phone, role, password, and account status are validated by `StorePersonnelRequest` / `UpdatePersonnelRequest`. The web form uses the corresponding `createPersonnelAccountSchema`. Camel-case form values are mapped to snake-case payload fields in the personnel service. Modules and permissions cannot be supplied as account fields.

Admin can delete a Staff or Driver from the Personnel row menu after confirmation.
Deletion sets `users.deleted_at`, disables the account, revokes mobile tokens and
rotates the remember token. Deleted personnel are excluded from the table,
summary counts, login, editing and new assignment candidates. The user row,
role membership, email/phone uniqueness, and linked records remain intact.
There is no restore or permanent-delete endpoint, and no custom-role mutation
endpoint. Admin, Customer and mixed-role accounts cannot be deleted here.

Historical personnel relationships keep resolving deleted users so bookings,
payments, charges, inspection signatures, maintenance, document reviews and
activity attribution retain their identities. Personnel creation, updates and
deletion record the acting Admin, target account, event and server timestamp in
the existing activity log, within the same transaction. Update metadata records
changed field names and a password-change flag, never password values, tokens,
email addresses or contact values. Existing activity records remain readable;
actions that were not previously logged are not reconstructed.

## Account status and role changes

- Ordinary contact updates remain available during an assigned service.
- A pending, confirmed, or ongoing Driver assignment blocks deactivation and Staff/Driver conversion. Reassign pre-release services or finish ongoing services first.
- An outstanding Driver-responsible charge blocks deactivation and conversion until settled. Debt alone does not disable login, notifications, settlement, or an existing service.
- Those same assignment and unpaid-charge safeguards block deletion, including deletion of an already inactive account.
- An unassigned account with no outstanding Driver obligations may change between Staff and Driver.
- Customers and mixed-role accounts cannot be edited through Personnel. Only the Owner can manage single-role Admin accounts; Staff can manage only Drivers. Admin role transitions are prohibited.
- Deactivation, role conversion, and password changes revoke mobile tokens and rotate the remember token. Inactive accounts are denied on authenticated mobile and management web requests. Driver roles are denied on management web requests, including stale sessions and direct permission grants.
- Role conversion removes direct permission grants so the destination role cannot inherit previous custom privileges.

## Migration

`2026_09_29_000002_fix_personnel_roles` removes legacy Driver role/direct permissions, retires unused custom web roles, and renames the existing personnel-administration permission to `manage personnel`. It preserves account and rental records and existing Staff grants.

Assigned custom roles or mixed Driver roles cause the migration to stop with an explicit mapping requirement. It does not silently convert their accounts. Owner is excluded from custom-role retirement. Retired permissions cannot be reconstructed by rollback; use a pre-migration backup if restoration is necessary.

## Vehicle configuration

Vehicle Management → Configure and its mutation endpoints are Admin-only. Staff with vehicle, booking, or maintenance permissions may read active options for their operational forms. The vehicle-management permission does not grant shared configuration management. See [vehicle configuration](vehicle-configuration.md).

## Geofence management

Admin manages default monitoring zones and custom booking zones on the website. Staff can read the library and booking zone/activity information, but Laravel denies all default-zone and custom-zone mutations to Staff, including direct calls with existing permissions. Geofence management remains separate from authorized Staff Start Handover and Start Rental. The Owner also retains Admin membership for management access.

## Telematics boundary and future work

Self Drive telematics is operated by the owning Customer; With Assigned Driver telematics is operated by the current assigned Driver. Driver Services provides entry to the assigned rental's setup and activity screens, while Laravel checks assignment and setup eligibility on every read and mutation. Staff retains inspection and rental release authority. Video recording, sending, auditing, and dashcam offerings remain outside scope.

Fleet Monitoring reads ongoing rentals and authorized latest locations for active
Admin/Staff accounts with `view fleet tracker`. The latest-point map and private
Reverb updates are implemented; route history and driving scores are not part of
that resource. Module access does not establish physical tracking or AI accuracy.
Customer Self Drive and current assigned-Driver setup, consent, and collection
remain separately authorized. See the [central telematics guide](telematics-master-plan.md),
[booking lifecycle](booking-rental-lifecycle.md), and [vehicle condition](vehicle-condition-architecture.md).

## Verification

Navigation count update verified on 2026-10-16: all 424 backend tests passed with a 512 MB PHP memory limit, PHP formatting passed, and web lint, TypeScript and the production build passed. Isolated browser fixtures exercised expanded/collapsed desktop and 390 px mobile navigation, zero/99+/unavailable states, the three verification labels, and immediate counter refresh after simulated start/cancel, document approval/rejection and toll review. The preview and scoped worker were removed. These checks did not alter live bookings, documents, or toll requests.

Backend regression coverage includes fixed-role validation, Admin-only account administration, removal of custom-role endpoints, Driver web denial, assigned-service scoping, customer-route denial, active-assignment and charge safeguards, token revocation, and migration preservation/explicit mapping requirements. Personnel deletion coverage includes retained identity/history, audit actors and subjects, protected roles, repeat requests, reserved account identifiers, and transaction rollback when audit recording fails. Web and mobile authentication mechanisms remain cookie/CSRF and Sanctum bearer tokens respectively.

## Owner and Admin accounts

The identified account has Owner and Admin membership. The Owner sees Admins in the shared Personnel table and may create, edit, deactivate, or soft-delete single-role Admin accounts. The Owner account and other mixed-role accounts are excluded and protected. Admins see and manage Staff and Drivers; Staff see Staff and Drivers but can create, edit, or delete Drivers only. Laravel enforces these limits and prevents role transitions to or from Admin. The shared form uses the existing account and password rules. Deactivation, password changes, and deletion invalidate tokens as in the existing Personnel lifecycle.

Admin invitation issuance and acceptance are disabled. Existing invitation records remain in storage. No invitation email is sent when an Admin is created.

## Owner verification

Protected management writes require a code sent to the single active account with the Owner role, including when the Owner initiates the action. Existing Admin and Staff permissions still apply. The requester confirms the action, asks the Owner for the emailed code, and enters it to complete the same write. Refund decisions and recording refunds, adjusted or manual late charges, ordinary charge edits and deletions, existing vehicle daily-price changes, and fee-pricing saves are protected. Creating a vehicle and reviewing an unadjusted late charge do not require this code.

Laravel binds a hashed, single-use code to the requester, action, validated payload and locked state. Codes expire after 15 minutes; resends wait 60 seconds and preserve the five-attempt limit. The write and consumption share a transaction. The system fails closed if there is no single active Owner or email delivery is unavailable. The migration `2026_11_11_220000_create_owner_verifications_table.php` adds challenge storage. Mail delivery must use a configured delivery transport; the log transport is rejected for these codes. The web uses the existing HTTP service, a shared verification dialog and the combined `PUT /admin/fee-pricing` endpoint.

The feature tests use faked email and cover code issuance, protected actions, wrong/expired/replayed codes, changed state and transactional rollback. Live email delivery and browser checks are separate.
