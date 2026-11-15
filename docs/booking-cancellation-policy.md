# Booking cancellation, no-shows and external refunds

Implemented in code 2026-10-16. Laravel is authoritative; refund actions retain their existing Admin permission and require owner verification.

## Reservation and payment

A paid booking reserves its agreed interval, for example 19 October 2 PM through 20 October 2 PM. Pickup time is tentative; passing it does not automatically cancel the booking. Earlier or later collection follows the existing Staff handover/readiness rules, from the rental start date until the return deadline. Collection changes neither the price nor the agreed return deadline. Future start dates and expired intervals remain blocked for release, and booked timestamps stay fixed; see [readiness and release](booking-rental-lifecycle.md#readiness-and-release).

Schedule selection, ordinary booking creation and delivery confirmation require a future pickup time. PayPal checkout/unpaid-revision submission may continue if that selected time passes on the same date in Asia/Manila. Both paths reject past rental dates and elapsed return deadlines. The separate remaining-balance deadline below is unchanged.

New partial-payment bookings owe the remainder before the start date begins in Asia/Manila. The example booking must be settled before 19 October 12 AM (18 October 4 PM UTC). Deadline processing cancels unpaid partial bookings, retains the down payment and records `payment_deadline`. Persisted deadlines on existing bookings are not backfilled. Down payment remains 50% with the existing two-calendar-day lead rule.

## Cancellation and no-show decisions

Admin and Staff with booking permission reject pending bookings through the web management portal, with a required reason. Confirmed bookings retain the Cancel action and require a cancellation reason. Customers may cancel only their own unpaid pending bookings from mobile, with a reason and confirmation; paid or confirmed bookings remain management actions. The booking becomes Cancelled and releases reserved dates; refund approval does not keep the reservation active. In the web confirmed-booking cancellation dialog, Admin/Owner can approve a full or positive custom refund as part of the same cancellation; reason-only cancellation remains available to Staff and existing callers. A cancellation reason alone is not evidence of automatic refund eligibility. Automatic payment-deadline cancellation remains a separate server process.

Authorized staff record `no_show` only after the entire reserved interval ends, when a confirmed booking was never released. The action label is **No-show**, and it stays disabled before the return deadline. Staff enter findings and then accept a second confirmation explaining that the booking ends, reserved dates are released and rental payments are not refundable. Laravel requires an explicit `confirmed` acknowledgement and rechecks eligibility under the booking lock. They must inspect the release/contact records and choose ordinary management cancellation when Jamjade could not provide handover or a cancellation was arranged. No-show records retain all rental payments and cannot receive an ordinary refund review. No late charge arises from a never-released booking. No automatic no-show is inferred from unanswered messages or the tentative arrival time.

`booking_cancellations` has one row per cancelled booking. New web manual cancellations use `management`; new unpaid Customer cancellations use `customer_unpaid`. Other current kinds are `payment_deadline` and `no_show`. Historical `customer` records remain readable and eligible for the established refund review. Existing historical cancellations without a row remain view-only; no reason, no-show finding or refund amount is inferred retrospectively.

## Final booking outcomes — 2026-11-15

New no-show decisions save the distinct terminal booking status `no_show`
(displayed **No-show**), rather than a Cancelled status. Final statuses are
Completed, Cancelled, Rejected and No-show. No-show records keep the existing
`booking_cancellations.kind = no_show` evidence and zero refundable amount;
original completed payments and issued documents are preserved. Further
transitions, Customer payments, refund review and refund recording are blocked.
The status is included in web history filters/counts, mobile labels/filters and
Driver history. Booking activity reports count new `no_show` events and retain
the existing interpretation of historical Cancelled/no-show events.

Pending management bookings expose Reject rather than Cancel; Laravel also
rejects a management attempt to cancel a pending booking. The separate Customer
unpaid cancellation flow and automatic payment-deadline cancellation remain.
Ending a separate booking on a vehicle with another ongoing rental keeps the
vehicle Rented; a no-show does not release a car currently used by another
Customer.

Implementation uses `BookingStatus`, `BookingService`,
`BookingCancellationService`, `VehicleOperationalStatusService`,
`BookingStatusRequest`, `RecordNoShowRequest` and `BookingResource` on Laravel;
web `BookingDecisionDialog`, shared `NoShowConfirmation`,
`ResolveMissedStartForm`, `validations/booking/decision.ts` and the existing
booking service/management module. Mobile booking DTOs, badges, actions and
history filters accept the new final status. The shared confirmation is also
used by missed-start resolution, with no request sent before the second step.
Reason validation trims input and counts Unicode code points to match Laravel's
1,000-character limit. The no-show schema requires a boolean true from the
confirmation control, mapped to Laravel's `accepted` acknowledgement.

No migration or data rewrite is needed: booking/event status columns are strings.
Existing Cancelled/no-show records keep their historical status and evidence;
the new No-show history filter applies to new distinct-status records. Accepted
rental terms, private receipts and historical PDF bytes are unchanged. No-show
remains unavailable until the whole rental period ends, preserving the existing
signed no-show clause.

Verification: all 1,424 backend tests passed (8,930 assertions). Coverage includes
future/active/ended intervals, direct service guards, acknowledgement/reason
validation, Staff authorization, unresolved PayPal capture, released-history
rejection, terminal history/counts, payment/refund locks, both report event
formats and an overdue rental owned by a different Customer on the same vehicle.
The first full run found the old management history fixture's three-status count
and pending Cancel action; it now explicitly checks four terminal statuses and
pending rejection, and the complete rerun passed.

Nine web form/confirmation callback tests and nine focused mobile
booking/cancellation tests passed. Web and mobile lint/TypeScript, the web
production build and Android export passed. Scoped Pint passed; repository-wide
Pint still reports the existing invitation migration
`2026_11_11_210000_add_owner_and_admin_invitations.php`. Full mobile tests passed
339/340; the existing vehicle-image test expects 7 bundled mappings but finds 42.
`git diff --check` passed. The dialogs reuse CancelBookingDialog's form shell and
the shared AlertDialog primitive; request parity was checked against
`BookingStatusRequest` and `RecordNoShowRequest`. Browser responsive/focus and
Android visual acceptance were not exercised; compilation and callback tests do
not establish visual acceptance. No live booking, no-show, rejection,
cancellation or payment was submitted.

## Mobile unpaid cancellation — 2026-11-15

`POST /api/mobile/bookings/{booking}/cancel` accepts only a required, trimmed
`reason` of up to 1,000 Unicode characters. It requires an active Customer, looks
up the booking by its ID or code within that Customer's records, and calls the
existing booking transition workflow. `BookingPolicy::cancel` requires ownership,
`pending` status and `unpaid` payment status. `BookingService` rechecks under the
same booking lock used by PayPal capture. The controller fixes the cancellation
kind; client refund fields and staff notes are not forwarded.

Cancellation allows no payment attempts, uncaptured `created`/`abandoned` PayPal
orders without capture evidence, or an explicitly `ORDER_NOT_APPROVED` failed
first capture. Creating, approved, capturing, completed and other uncertain
attempts block it. Ledger evidence also blocks cancellation if the booking's
payment-status summary is stale. All created orders become abandoned before the
booking is cancelled in the same transaction; a late callback cannot capture
them. Failure to record cancellation rolls back both changes. Repeated requests
are rejected after the state changes, preserving one cancellation and event.

The `customer_unpaid` record has refund amount zero and `not_eligible` refund
status, without a refund decision or returned-money claim. It is excluded from
the existing Admin refund-review service. Its distinct kind preserves historical
`customer` refund eligibility without reinterpreting old rows. The existing kind
column is a string, so no migration or data rewrite is required. Notifications,
status events, audit records and vehicle-status recalculation reuse the existing
transition workflow. Staff cancellation and payment deadlines are unchanged.

`BookingResource` supplies `canCancelUnpaid` from policy plus payment evidence;
loaded payment relations keep this check out of N+1 queries. Customer booking
details show a full-width Cancel booking action when eligible. A reason form
reuses the existing form sheet, keyboard-aware scrolling, shared input and action
buttons. Keep booking dismisses it; pending submission disables both actions and
closing. Success applies Laravel's returned booking, updates the timeline/actions
and shows one success toast. Laravel reason errors map to the field; payment-state
errors and unconfirmed network results retain a form-level recovery message.
Closing the sheet rereads booking details. Mobile and web display these records
as Cancellation without refund-review or approved-refund wording.

Sources: `CancelUnpaidBookingRequest`, `BookingPolicy`, `BookingController`,
`BookingService`, `BookingCancellationService`, `BookingResource`, mobile
`forms/booking/CancelBookingForm.tsx`, `validation/booking/cancellation.ts`,
`services/api/booking.service.ts` and `screens/bookings/BookingDetailsScreen.tsx`.
Both frontend cancellation types include the new kind. The mobile Zod schema
mirrors the Form Request, including Unicode character counting; the service sends
only the reason. Existing paid agreements and Admin refund forms are unchanged.

Verification: all 1,401 backend tests passed (8,807 assertions), including 58
focused cancellation/policy cases (320 assertions). Eight mobile schema, service
and form-callback tests passed, covering confirmation, Keep booking, pending
controls, field errors, changed eligibility and unconfirmed network results.
Mobile/web lint, web TypeScript, the web production build, Android bundle export,
scoped Pint and `git diff --check` passed. The final mobile TypeScript run is
blocked by concurrent research-screen work: `RcNativeCollectionPanel.tsx:257`
omits the required `stage` and `onSelectGroup` props. No cancellation type error
was reported. The full mobile Node run passed
331/332 tests; the unchanged vehicle-image test expects 7 mappings but finds 42.
Repository-wide Pint still reports the unrelated existing
`2026_11_11_210000_add_owner_and_admin_invitations.php` migration. No live booking,
payment, refund or customer cancellation was performed. Emulator/device visual
checks of the sheet, keyboard and screen sizes remain pending; callback tests do
not constitute native UI acceptance.

## Confirmed cancellation with refund — 2026-11-14

The web cancellation dialog uses the existing shared SelectWithLabel/InputWithLabel
controls above the cancellation reason. Confirmed bookings with completed PHP
Customer payments offer Full refund (the amount actually paid) or Custom (greater
than zero, at most the paid amount, up to two decimals). Admin/Owner sees these
controls; Staff retains reason-only cancellation and cannot approve a refund.
The booking list now returns `customerPaidAmount` whenever payment relations are
loaded, so the ceiling is available before opening cancellation.

`CancelBookingRequest` accepts optional `refund_mode: full|custom` and requires
`refund_amount` only for custom. An amount is prohibited with full mode; Laravel
recomputes the full paid amount while holding the booking lock. Existing
reason-only requests keep the separate review flow. `BookingCancellationService::cancelWithRefund`
checks confirmed status and eligible Customer payments, then cancels and reviews
inside one transaction. Invalid amounts or a failed review roll back cancellation.
The cancellation reason also records the refund decision reason. Owner verification
protects the combined write for Admins; Owner acts directly under the established
verification rules. Approval does not return money, change completed payments,
or mark a refund returned. Existing Record Money Returned remains required.

Source: `CancelBookingDialog.tsx`, `validations/booking/cancellation.ts`,
`services/booking/booking.service.ts`, `CancelBookingRequest`,
`BookingCancellationService`, `BookingController`, `BookingResource`.
No migration or mobile request changes are required. Physical browser verification
remains pending if browser access is unavailable.

## Admin review and actual refund

Admin with booking permission may review an unreviewed customer/management cancellation once. Required inputs are the approved amount (0 through completed positive PHP Customer payments, at most two decimals) and a decision reason (1–1,000 characters). Zero declines the refund. A positive amount approves it. Driver-responsible payments, pending/failed/refunded transactions and other currencies do not enlarge the refund ceiling.

The owner returns money externally. Only then Admin confirms `Record Money Returned`. No transaction reference is collected or required. The full approved amount is recorded as returned at server time, with the actor. This records an external transaction; it does not call PayPal or move funds. The confirmation requires `confirmed: true`. Repeating it is idempotent. Review and recording lock the booking, and decisions cannot be silently overwritten. The Customer is notified after money return is recorded.

Original completed payments, rental information, historical invoice PDFs and payment receipts remain historical evidence. Approval alone is never displayed as money returned. Customer resources expose the cancellation and refund status, approved amount, decision reason and timestamps; Driver resources omit them. Admin review and record endpoints require Admin plus booking permission; Staff cannot approve or record refunds.

## Interfaces and reporting

Web Booking History → View → Payment shows the cancellation/refund record and authorized actions. The missed-start resolution distinguishes No-show from Cancellation. Customer mobile booking details show cancellation/refund progress and the guarded unpaid-cancellation action above. Reports show gross receipts, refunds actually returned and net receipts separately. Gross payment charts and historical receipt amounts are not silently reduced by an approval.

## Schema and verification

Apply `2026_10_15_000003_add_booking_agreement_and_cancellations.php`. It adds encrypted accepted rental context and cancellation/refund metadata without rewriting old rows. The 2026-10-19 metadata migration renames the accepted-context column to `rental_context`; see [financial documents](booking-financial-documents.md). Preserve APP_KEY and private issued PDFs. Do not roll back after issuing records without archival preservation.

Regression tests cover the Manila midnight boundary, later-day pickup eligibility, no early no-show, guarded Customer unpaid cancellation, management cancellation of paid/confirmed bookings, Admin-only review, zero/partial/full decisions, refund ceilings, confirmation without a reference, repeat recording, retained original payments, price mismatch rejection and stable invoice bytes. Live payment providers, external fund transfers and physical mobile device checks remain separate verification.

## Owner verification

Every refund decision, including a zero decision, and recording an external refund require a one-time code from the active Owner. The Owner receives the action details by email and shares the code with the requester. See [roles and access](user-roles-and-access.md#owner-verification).

Verification for the combined cancellation/refund change (2026-11-14): the full
backend suite passed 1,324 tests / 8,559 assertions. After correcting the new list
payment aggregate to correlate each payment with its booking Customer, all 24
booking-agreement/refund tests passed independently (137 assertions), including
the list's paid-amount contract. Regression coverage includes full/partial paid
amounts, zero/negative/over-precision rejection, overpayment rollback, Staff denial,
Admin Owner-code execution and keeping external money return separate. Web lint,
TypeScript, production build, client refund-schema checks and scoped Pint passed.
An earlier receipt-file failure during overlapping test runs passed when rerun
alone; backend tests sharing fake storage should run sequentially. Browser visual
acceptance remains pending.

Cancellation dialog refinement: the refund amount now uses a single React Hook
Form Controller with a string value in both Full and Custom modes, preventing a
controlled/uncontrolled input warning while preserving the custom draft. Switching
modes clears the amount error without validating an empty custom amount prematurely.
The cancellation sentence is the dialog heading; duplicate approval guidance was
removed at the user's request. Actual money return remains a separate operation.
