# Booking cancellation, no-shows and external refunds

Implemented in code 2026-10-16. Laravel is authoritative; refund actions retain their existing Admin permission and require owner verification.

## Reservation and payment

A paid booking reserves its agreed interval, for example 19 October 2 PM through 20 October 2 PM. Collection can be arranged at any time within that interval. No pickup grace period applies; delayed collection changes neither the price nor the return deadline. Standard release and self-drive handover cannot occur before the interval starts or at/after its end. With the existing local/testing handover flag enabled, self-drive testing may start earlier on the rental start date in Asia/Manila; future dates and expired intervals remain blocked, and booked dates stay fixed.

New partial-payment bookings owe the remainder before the start date begins in Asia/Manila. The example booking must be settled before 19 October 12 AM (18 October 4 PM UTC). Deadline processing cancels unpaid partial bookings, retains the down payment and records `payment_deadline`. Persisted deadlines on existing bookings are not backfilled. Down payment remains 50% with the existing two-calendar-day lead rule.

## Cancellation and no-show decisions

Only Admin and Staff with booking permission can manually cancel bookings through the web management portal, and a reason is required. Customer mobile has no cancellation action or endpoint. The booking becomes Cancelled and releases reserved dates; refund approval does not keep the reservation active. In the web confirmed-booking cancellation dialog, Admin/Owner can now approve a full or positive custom refund as part of the same cancellation; reason-only cancellation remains available to Staff and existing callers. A cancellation reason alone is not evidence of automatic refund eligibility. Automatic payment-deadline cancellation remains a separate server process.

Authorized staff record `no_show` only after the entire reserved interval ends, when a confirmed booking was never released. Findings are required. They must inspect the release/contact records and choose ordinary management cancellation when Jamjade could not provide handover or a cancellation was arranged. No-show records retain all rental payments and cannot receive an ordinary refund review. No late charge arises from a never-released booking. No automatic no-show is inferred from unanswered messages or the tentative arrival time.

`booking_cancellations` has one row per cancelled booking. New manual cancellations use `management`; other current kinds are `payment_deadline` and `no_show`. Historical `customer` records remain readable and eligible for the established refund review. Existing historical cancellations without a row remain view-only; no reason, no-show finding or refund amount is inferred retrospectively.

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

Web Booking History → View → Payment shows the cancellation/refund record and authorized actions. The missed-start resolution distinguishes No-show from Cancellation. Customer mobile booking details show cancellation and refund progress, with no customer cancellation controls. Reports show gross receipts, refunds actually returned and net receipts separately. Gross payment charts and historical receipt amounts are not silently reduced by an approval.

## Schema and verification

Apply `2026_10_15_000003_add_booking_agreement_and_cancellations.php`. It adds encrypted accepted rental context and cancellation/refund metadata without rewriting old rows. The 2026-10-19 metadata migration renames the accepted-context column to `rental_context`; see [financial documents](booking-financial-documents.md). Preserve APP_KEY and private issued PDFs. Do not roll back after issuing records without archival preservation.

Regression tests cover the Manila midnight boundary, later-day pickup eligibility, no early no-show, management-only manual cancellation, removed mobile cancellation routes, Admin-only review, zero/partial/full decisions, refund ceilings, confirmation without a reference, repeat recording, retained original payments, price mismatch rejection and stable invoice bytes. Live payment providers, external fund transfers and physical mobile device checks remain separate verification.

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
