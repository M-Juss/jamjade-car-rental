# Booking cancellation, no-shows and external refunds

Implemented in code 2026-10-16. Laravel is authoritative; owner authority uses the existing Admin role.

## Reservation and payment

A paid booking reserves its agreed interval, for example 19 October 2 PM through 20 October 2 PM. Collection can be arranged at any time within that interval. No pickup grace period applies; delayed collection changes neither the price nor the return deadline. Standard release and self-drive handover cannot occur before the interval starts or at/after its end. With the existing local/testing handover flag enabled, self-drive testing may start earlier on the rental start date in Asia/Manila; future dates and expired intervals remain blocked, and booked dates stay fixed.

New partial-payment bookings owe the remainder before the start date begins in Asia/Manila. The example booking must be settled before 19 October 12 AM (18 October 4 PM UTC). Deadline processing cancels unpaid partial bookings, retains the down payment and records `payment_deadline`. Persisted deadlines on existing bookings are not backfilled. Down payment remains 50% with the existing two-calendar-day lead rule.

## Cancellation and no-show decisions

Only Admin and Staff with booking permission can manually cancel bookings through the web management portal, and a reason is required. Customer mobile has no cancellation action or endpoint. The booking becomes Cancelled and releases reserved dates; refund approval is a separate decision and does not keep the reservation active. A cancellation reason alone is not evidence of automatic refund eligibility. Automatic payment-deadline cancellation remains a separate server process.

Authorized staff record `no_show` only after the entire reserved interval ends, when a confirmed booking was never released. Findings are required. They must inspect the release/contact records and choose ordinary management cancellation when Jamjade could not provide handover or a cancellation was arranged. No-show records retain all rental payments and cannot receive an ordinary refund review. No late charge arises from a never-released booking. No automatic no-show is inferred from unanswered messages or the tentative arrival time.

`booking_cancellations` has one row per cancelled booking. New manual cancellations use `management`; other current kinds are `payment_deadline` and `no_show`. Historical `customer` records remain readable and eligible for the established refund review. Existing historical cancellations without a row remain view-only; no reason, no-show finding or refund amount is inferred retrospectively.

## Admin review and actual refund

Admin with booking permission may review an unreviewed customer/management cancellation once. Required inputs are the approved amount (0 through completed positive PHP Customer payments, at most two decimals) and a decision reason (1–1,000 characters). Zero declines the refund. A positive amount approves it. Driver-responsible payments, pending/failed/refunded transactions and other currencies do not enlarge the refund ceiling.

The owner returns money externally. Only then Admin confirms `Record Money Returned`. No transaction reference is collected or required. The full approved amount is recorded as returned at server time, with the actor. This records an external transaction; it does not call PayPal or move funds. The confirmation requires `confirmed: true`. Repeating it is idempotent. Review and recording lock the booking, and decisions cannot be silently overwritten. The Customer is notified after money return is recorded.

Original completed payments, rental information, historical invoice PDFs and payment receipts remain historical evidence. Approval alone is never displayed as money returned. Customer resources expose the cancellation and refund status, approved amount, decision reason and timestamps; Driver resources omit them. Admin review and record endpoints require Admin plus booking permission; Staff cannot approve or record refunds.

## Interfaces and reporting

Web Booking History → View → Payment shows the cancellation/refund record and authorized actions. The missed-start resolution distinguishes No-show from Cancellation. Customer mobile booking details show cancellation and refund progress, with no customer cancellation controls. Reports show gross receipts, refunds actually returned and net receipts separately. Gross payment charts and historical receipt amounts are not silently reduced by an approval.

## Schema and verification

Apply `2026_10_15_000003_add_booking_agreement_and_cancellations.php`. It adds encrypted accepted rental context and cancellation/refund metadata without rewriting old rows. The 2026-10-19 metadata migration renames the accepted-context column to `rental_context`; see [financial documents](booking-financial-documents.md). Preserve APP_KEY and private issued PDFs. Do not roll back after issuing records without archival preservation.

Regression tests cover the Manila midnight boundary, later-day pickup eligibility, no early no-show, management-only manual cancellation, removed mobile cancellation routes, Admin-only review, zero/partial/full decisions, refund ceilings, confirmation without a reference, repeat recording, retained original payments, price mismatch rejection and stable invoice bytes. Live payment providers, external fund transfers and physical mobile device checks remain separate verification.
