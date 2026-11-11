# Booking Rental Lifecycle

The customer vehicle-details screen refreshes the server-backed profile and booking
status on focus and when returning to the foreground, so completed bookings do not
leave a stale Book Now lock. The action waits for the check; a failed check offers
retry. Laravel remains authoritative when a booking is submitted. The change is in
`mobile-frontend/app/browse/[vehicleId].tsx` and `components/browse/VehicleDetailsContent.tsx`.
Mobile lint and TypeScript checks passed; device acceptance remains to be confirmed.

## State boundaries

Booking, payment, vehicle operation, inspection, and telematics are separate state dimensions. The ordinary booking path is:

```text
pending -> confirmed -> ongoing -> returned -> completed
   |          |
   +-> rejected
   +-> cancelled
```

`pending` may be rejected or cancelled. `confirmed` may be cancelled. Once a rental is `ongoing`, ordinary cancellation is no longer valid. `completed`, `cancelled`, and `rejected` are terminal.

`confirmed` reserves dates but does not authorize handover. `returned` means the physical rental and return processing are finished, while customer money may still be outstanding. `completed` requires a zero customer balance and an explicit authorized Jamjade action; it is never automatic.

Successful booking checkout creates one Customer notification combining confirmation, the payment amount, and any remaining balance/deadline. Its details retain the cancellation and non-refundable down-payment warning when a deadline applies. Successful rental-information/receipt delivery updates that payment's notification instead of adding another; retries and resends do not reset its read state. Later balance reminders, charge requests, and Driver assignment notices remain separate events. Existing notification history is preserved.

## Driver assignment

Staff and Driver are separate fixed roles. Staff runs authorized web rental operations; Driver mobile access is limited to assigned services, notifications, and their own charge settlement. Personnel accounts use deactivation to preserve history; active assignments and unpaid Driver charges block deactivation or role conversion. See [user roles and access](user-roles-and-access.md).

An Admin's Driver booking may be confirmed without an assigned Driver. Assignment is staff-controlled and is mandatory before Outgoing Inspection. A candidate must be an active Driver, have no overlapping confirmed/ongoing assignment, and have no unpaid Driver-responsible charge. A later Driver charge does not interrupt an already active service, but blocks a new assignment until paid.

Booking creation does not auto-assign a Driver. Assignment and reassignment create activity and Driver notifications.

## Readiness and release

The backend `RentalReadinessService` is authoritative. Outgoing requires a confirmed booking, permitted payment/readiness state, an operationally eligible vehicle, no incompatible maintenance restriction, and—for Admin's Driver—a valid assigned Driver. Self Drive also preserves the age and approved-document rules.

Outgoing Inspection uses the same server-time eligibility as handover and Start Rental for both rental types. Standard mode requires `[rental_start_at, rental_end_at)`. In local/testing, either existing timing flag also allows earlier arrival on the rental start date in Asia/Manila; future start dates and the exact/elapsed return deadline stay blocked. The current timing-only setup uses `RENTAL_EARLY_START_TEST_MODE=true` with broader handover mode off, preserving payment, documents, age, operator, vehicle and setup requirements. Laravel rechecks after locking and before finalization, rolling back the snapshot and removing new signatures if the period ends during submission. Existing finalized inspections remain immutable and readable. Management readiness keeps `outgoingInspectionTimeEligible`; the web uses this server flag to show the form. No inspection request fields or agreed booking timestamps change.

Same-day alignment verification — 2026-10-18: 223 focused tests and the full 742-test backend suite (4,292 assertions), PHP formatting and diff checks passed. Coverage includes both rental types, same Manila date across UTC midnight, future dates, exact/elapsed return deadlines, disabled modes, production/staging behavior, real early inspection through setup/release, and unchanged booked timestamps. A read-only local runtime check confirmed the reported same-day booking is eligible for both inspection and rental timing. No booking was modified; web/mobile runtime code and payloads are unchanged.

Initial clock-gating verification — 2026-10-18 (before the same-day allowance was aligned): all 715 backend tests (4,070 assertions), PHP formatting, web lint, TypeScript and production build passed. Synthetic browser checks reused the existing workflow Requirements panel at desktop and 390 px widths, covering blocked/expired states, automatic opening when server eligibility changes, missing signatures, successful finalization, timing `422` with retained values, and a server failure with one toast. No live booking was changed. `StoreBookingInspectionRequest`/`VehicleConditionRules`, `bookingInspectionSchema`/`vehicleConditionSchema`, and `toConditionRequest` were reviewed; their fields and mapping are unchanged. Timing intentionally remains a server-state rule, rather than a client-clock Zod rule. Mobile handover contracts and native APIs are unchanged.

In standard mode, Start Rental is an authorized Jamjade web action and requires:

- confirmed booking and full customer payment;
- finalized Outgoing with the required signatures;
- for both rental types, a `ready_for_release` telematics setup session with every required device-readiness and calibration step passed by the current operator;
- eligible vehicle with no incompatible maintenance restriction;
- for Self Drive, an eligible age, approved documents, and a saved emergency contact
- for With Assigned Driver, a valid assigned Driver.

Success moves the booking to `ongoing`, records a `status_changed` event in `booking_events`, marks the vehicle rented, and notifies the Customer. Customer and Driver mobile clients cannot start the booking.

For timing-only development testing, `RENTAL_EARLY_START_TEST_MODE=true` permits early Outgoing Inspection, handover, mobile setup and rental release on the same rental start date in Asia/Manila for both rental types. It preserves every other readiness requirement and all eight setup/calibration results. Future dates and expired bookings stay blocked; production/staging ignore the flag. Keep the broader handover test mode off for this use case. See [the timing-only setup](telematics-master-plan.md#existing-rental-and-handover-boundaries).

Local/testing handover test mode relaxes payment, age, document, emergency
contact, and outgoing-inspection gates for flow testing. It requires a
confirmed self-drive booking, an operational vehicle, booking-conflict checks,
and a real passing phone-mount attempt for telematics release readiness.

The testing timing exception allows Start Rental, staff handover and mobile setup for both Self Drive and With Assigned Driver before the scheduled time when the rental start date is today in Asia/Manila. With Assigned Driver retains its normal payment, inspection, age, assigned-Driver, setup and vehicle-readiness requirements; only its timing gate is relaxed. Otherwise time must be inside the booked interval. At/after the return deadline all starts are blocked. Neither agreed timestamp is moved, and the exception is ignored outside local/testing environments.

## Inspections and telematics setup

The immutable snapshot lineage is:

```text
Current -> Outgoing -> Incoming -> new Current
```

Outgoing is copied from Current, belongs to the booking, and never replaces Current. Incoming is copied from finalized Outgoing and becomes the new Current only when finalized. Previous snapshots remain immutable history.

Self Drive signatures are Jamjade Personnel + Customer. Admin's Driver signatures are authorized Jamjade Personnel + Assigned Driver; no Customer signature is used.

Staff selects **Finalize Inspection & Start Handover** for either rental type. Laravel finalizes the immutable Outgoing snapshot and starts handover in one transaction, passing the session through `setup_required` to `in_progress`. The wizard proceeds directly to Setup. An existing finalized inspection can use **Continue to Setup** without signing again; Start Handover also requires the current operator, server time within `[rental_start_at, rental_end_at)`, and required inspection signatures. Self Drive additionally requires approved Customer documents. Pickup may occur later anywhere inside the reserved interval, including a later calendar day. It never reduces the price or moves the agreed return deadline. Only then may retryable required checks be recorded. The six device-readiness checks lead to two explicitly consented foreground calibration captures (stationary and forward reference) supervised by Staff in a controlled area. The owning Customer operates Self Drive setup; the assigned Driver operates With Assigned Driver setup. Reassignment requires the new Driver to complete their own checks. Standard setup reaches `ready_for_release` only after all eight effective checks pass; physical-device calibration validation is separate. See [calibration](telematics-master-plan.md#existing-calibration-and-sensor-conventions). The local/testing handover test mode is a documented Self Drive exception: a real passing phone-mount attempt enables the release readiness projection without inventing other check results or calibration evidence. Start Handover never starts the rental and does not replace the authorized Start Rental action, which atomically marks the session `released`. See the [central handover and release contract](telematics-master-plan.md#existing-rental-and-handover-boundaries).

In Admin and Staff Bookings, Prepare Rental and Rental Progress show Stationary
followed by Forward Reference for both rental types. The web displays Laravel's
saved check results and refreshes while handover is in progress. The mobile
Forward Reference capture ends automatically when it has enough usable readings.
Staff reviews readiness and uses **Start Rental** to confirm release.

## Telematics boundary

Video recording, sending/uploads, auditing, and dashcam offerings are outside project scope. Existing device/location and calibration gates apply to both supported rental types. Native motion recording, AI and scoring are separate target work in the [central guide](telematics-master-plan.md); they do not change booking release requirements.

Telematics applies to Self Drive and With Assigned Driver. The owning Customer operates Self Drive; the current assigned Driver operates With Assigned Driver. Unrelated authenticated users cannot operate setup or a trip. A released booking may create one actual trip. Pause and resume remain in that same trip.

Reusable circle and polygon defaults apply automatically before release, and Admin may add optional custom booking zones while a supported booking is pending or confirmed. The authorized Start Rental transaction copies active defaults, freezes all default/custom zones, and preserves their alert preferences for the released rental. Default templates may still be deactivated or soft-deleted for future rentals; released booking snapshots remain unchanged. Route points are high-volume location history; the trip's latest location fields are intentional fleet-monitoring cache fields. Significant occurrences are stored separately in `telematics_events`. Separate RC Research already stores motion recordings in encrypted private files, not raw-sample MySQL tables. Continuous rental motion and driver-behavior classification are not implemented.

End Trip changes only the telematics trip to `ended`. The booking remains `ongoing`, the vehicle remains rented, and Jamjade must still physically receive the vehicle and finalize Incoming Inspection.

## Late returns and attention

The administrator-only Pricing Settings page manages hourly late-return rates by seat capacity (initially PHP 200 for 5 seats or fewer and PHP 300 for 6 seats or more). New bookings freeze the accepted rate and policy; older bookings require review of their original agreement. Any positive delay costs at least one hour; after the first hour, a remainder rounds up only above 30 minutes. Long delays remain hourly. Physical receipt stops the late clock, and Staff reviews the proposed charge before it becomes payable. See [late returns and booking attention](late-return-workflow.md) for the complete contract, dashboard behavior, missed-start handling, and scheduler requirements.

## Return and additional charges

Authorized Staff must record actual physical receipt before Incoming Inspection. Receipt does not finish processing or make the vehicle available. When late hours exist, the dedicated late-charge review must finish before general return-charge finalization. Generic additional charges cannot bypass this review.

After Incoming is finalized, authorized staff may add zero or more responsibility-aware charges with type, description, decimal amount, creator, payment state, and responsibility.

- Self Drive charges are always Customer responsibility.
- Admin's Driver charges may be Customer or assigned Driver responsibility.
- Responsibility is chosen by staff; inspection or telematics evidence never assigns fault automatically.
- Customer charges increase the customer's final booking total and recompute the booking balance/payment state.
- Driver charges do not change the booking's customer total, balance, or payment status.

Staff confirms **Finalize Charges & Mark Returned** once. Laravel finalizes the review and performs `ongoing -> returned` together under the booking lock and one transaction. Customer payment is not required for `returned`; customer settlement and explicit Completion remain separate. A previously finalized ongoing return can use the same action, and retries preserve its original events and timestamps.

Returning releases only the rental restriction. `VehicleOperationalStatusService` recalculates actual state and preserves in-progress maintenance, scheduled/date restrictions, and manual unavailability. `completed` does not blindly set a vehicle to available.

## Settlement, restrictions, and completion

The management Payment tab groups rental costs and customer return charges
before the billed total, completed customer payments, and saved remaining
balance. Assigned Driver charges appear separately. The booking detail
response supplies `customerPaidAmount` using the same completed customer
payment scope as receipts.

Each completed positive PHP Customer payment issues a matching Rental Information and Payment Receipt pair after commit. Both identify the same receipt and payment totals; the detailed document includes accepted rental facts, itemized agreed pricing and the originally signed terms. Later Customer charges are separately identified. Each pair retains its original references, dates, amounts and bytes. New invoices are not issued, and historical document downloads/resends preserve their original files. Driver payments remain outside Customer documents. See [rental information and payment receipts](booking-financial-documents.md) for financial filtering, snapshots, delivery/retry and deployment details.

Customer and Driver charge payments extend the existing PayPal checkout/capture path. Current unpaid responsible charges for a booking are linked to one checkout, locked during capture, and marked paid idempotently. The mobile settlement summary exposes each charge's description and `outstandingAmount`, calculates the displayed amount in integer cents, and compares the newly created order with that summary before opening PayPal; a mismatch abandons the order and reloads review. Laravel verifies the returned capture is completed PHP for the expected checkout amount, and Driver charge capture also rechecks the locked outstanding charges. Notifications are the action surface; payment and charge records remain the source of truth and notification history is retained.

When a portal/API proxy replaces the incoming Host, set the optional backend `PAYPAL_CALLBACK_ORIGIN` to the public HTTP(S) origin without `/api` or another path. Both checkout return/cancel URLs and Android browser fallback links use it; direct Laravel/LAN requests retain their request origin when it is unset. This does not trust extra forwarded headers. Explicit `PAYPAL_RETURN_URL`/`PAYPAL_CANCEL_URL` overrides still take precedence. New checkouts receive the corrected callback; an existing PayPal order keeps the URL originally sent to PayPal. Update the origin whenever a temporary public tunnel changes.

Callback verification — 2026-10-18: all 724 backend tests (4,120 assertions), PHP formatting and diff checks passed. Mocked checkout/capture tests cover direct and configured public origins; return/cancel tests cover reachable Android fallback URLs and malformed-origin rejection. Read-only HTTP probes through the active public portal verified both callback routes use the public origin instead of loopback. No payment was created, approved or captured during verification. A fresh checkout and physical Android/iOS return remain user-device checks; no mobile runtime code or request payload changed.

PayPal return and cancel callbacks are allowlisted server-side. Android uses an intent URL with a browser fallback; the mobile native-intent handler recognizes customer and Driver return/cancel paths. A warm Android/iOS WebBrowser session lets the payment screen confirm and capture the order, while a cold app launch opens the app normally and does not capture automatically. Capture still occurs only after the app confirms the returned order through Laravel.

An unresolved Customer-responsible balance blocks only creation of a new booking. The Customer can still authenticate, browse, inspect bookings/notifications, and pay. It does not cancel unrelated future bookings.

An unresolved Driver-responsible charge blocks only a new assignment. The Driver can still authenticate, see Notifications and Services, pay, and finish an already active assignment.

`returned -> completed` requires finalized Incoming/return review, zero customer balance, and an explicit authorized Jamjade action. Driver debt does not block completion. Completion records server time, actor, booking status log, and activity.

## Interfaces and privacy

Completed booking details include Driving Analysis for viewers with booking
management and fleet permissions. It shows received driving events and sync
status. See the [central telematics guide](telematics-master-plan.md#completed-rental-driving-analysis)
for implementation, verification and pending coverage/scoring work.

The Release step in `web-frontend/src/forms/booking/BookingWorkflowDialog.tsx`
uses the existing booking summary card with three columns on wider screens so
Vehicle, Customer, and Rental type are visible in one row. On narrow screens the
fields stack for readability. Web lint and TypeScript checks passed. Browser
verification was unavailable.

The web booking row exposes a read-only View with progress and stage-specific records, Cancel while allowed, and a state-aware workflow. Continue Booking in the details view opens the next saved stage. Prepare Rental connects Driver assignment when needed, combined Outgoing Inspection/handover for supported rentals, Setup, and explicit Start Rental. Handover is no longer a separate wizard step. Process Return connects Incoming Inspection, inline charge entry and the combined Finalize Charges & Mark Returned confirmation, then advances directly to completion requirements. There is no separate Returned step in the workflow progress. Finish Booking resumes customer settlement and explicit Complete. Each successful save reloads the authoritative booking and advances within the dialog. If that reload fails, staff can retry the read without repeating the saved action. Closing and reopening resumes server state; unsaved form input is not persisted.

Setup, release readiness and returned-booking settlement refresh automatically while staff are waiting. Management readiness includes server-derived `rentalPeriodEligible` for both rental types. Start Rental and Confirm Release remain disabled outside the reserved `[rental_start_at, rental_end_at)` interval, with a concise warning below the rental information card. The local/testing same-start-date timing exception applies to both rental types. Release review refreshes every five seconds without a manual refresh button, including while confirmation is open; Laravel rechecks eligibility on submission. After device checks pass, the next self-drive stage is Calibration Pending while the renter performs guided calibration in the mobile app. The website shows server results and remains responsible for final release. Outstanding customer payment does not block Mark Returned, and Driver-responsible debt does not block Complete. The customer app displays a sanitized server-derived handover state and release/trip status; it does not receive monitoring-zone records or simulate setup verification. Driver mobile is limited to Notifications, Services, and Logout.

Management-only inspection details, readiness internals, admin notes, customer documents, and signature storage paths are not exposed through customer/Driver resources. All lifecycle mutations are enforced and authorized on Laravel; frontend visibility is only a user-experience aid.

The website workflow uses content-sized dialogs with a fixed header/footer and a scrolling body. Inspections provide section shortcuts; charge entry opens directly on its fields and returns to review after saving. Release, the combined charge-finalization/return action, and completion open a separate confirmation dialog above the unchanged workflow, with Back to Review and an action-specific final button. Opening or cancelling a confirmation preserves the main dialog's dimensions, content and scroll position. Inspection finalization remains a direct signed submission. Read-only booking details separate Overview, Rental, Payment, Self Drive Documents, and supported-rental monitoring zones into tabs; saved stage views return to the booking overview.

Workflow navigation — 2026-10-17: Previous opens the preceding saved step within Prepare Rental or the return/completion flow; it is disabled at the first step. The header close action remains available. Reviewing saved steps preserves the active form's unsaved input and returns with Back to the active step without repeating a mutation. Driver assignment remains editable before release, and ordinary charges retain their existing open-review/payment locks. Editable saved forms show Save & Continue only after changes; an unchanged driver assignment or charge entry returns without a request. Finalized inspections, received time, late-charge review, finalized charges, release, return and completion remain saved records rather than editable lifecycle transitions. Late-charge review appears as its own progress step when applicable, and Finish Booking retains the earlier return steps for review.

## Booking timezone contract

Mobile booking fields represent Asia/Manila wall time. Checkout and delivery
quote services attach the explicit `+08:00` offset before submitting them to
Laravel; timestamps already carrying an offset or `Z` retain their instant.
Quote matching and pickup validation use the same conversion, independent of
the device timezone. Laravel continues storing UTC and returning UTC ISO
timestamps for eligibility and timers. Booking display labels, delivery time,
payment time and timeline labels are formatted in Asia/Manila without a visible
timezone suffix. Existing issued financial documents remain immutable. Saved
bookings created with the earlier offset-free mobile payload require individual
review before correcting their reserved interval; there is no bulk shift.

## Delivery and initial pricing

Self Drive uses free garage pickup and return only. With Driver allows free garage pickup or paid delivery with the same delivery/end trip address. Laravel selects the quickest returned driving estimate and consumes an owned, complete, unexpired delivery quote before booking/PayPal creation. New quotes have zero upfront toll; actual tolls use existing `toll_fee` Additional Charges after Incoming Inspection, with notice before booking. Accepted delivery fees and historical initial tolls stay fixed. Legacy unconsumed quotes require fresh confirmation. Admin-only pricing affects new quotes. See [delivery pricing](delivery-pricing.md).

## Payment, cancellation and no-show policy — 2026-10-16

New down-payment bookings must settle before the beginning of the rental start date in Asia/Manila, not 24 hours before the scheduled clock time. A booking starting 19 October at 2 PM has a cutoff of 19 October at 12 AM. Existing persisted deadlines are retained. The existing two-calendar-day lead requirement for the 50% down-payment option remains unchanged.

Cancellation and refund review are separate. Customers provide a cancellation reason before the interval ends. A cancellation releases reserved dates; Admin (the current owner authority) decides no, partial or full refund against completed Customer payments, records a reason, then separately confirms external return of the approved amount. There is no required transaction reference and no PayPal refund API. Original payments and issued receipts remain historical records. Reports distinguish gross receipts, refunds actually returned, and net receipts. See [cancellation policy](booking-cancellation-policy.md).

There is no pickup grace countdown. Only after the full reserved interval ends without release may authorized staff record a no-show with findings; no-show rental payments are retained in full. Missing a tentative arrival time or unanswered messages alone does not establish a no-show. Staff must choose ordinary cancellation instead when handover failed on Jamjade’s side or an actual cancellation was arranged. The missed-start resolution offers both decisions; neither creates a late charge.

New `2026-10-15-v2` agreements remove the PHP 10,000 advance participation fee and reconcile payment, cancellation, pickup and telematics wording. Historical signed contexts and issued documents are not rewritten.

Self-drive concurrency — 2026-10-16: a Customer cannot create overlapping pending/confirmed/ongoing self-drive reservations on different vehicles. At that point, adjacent dates and With Driver bookings remained allowed. Only one self-drive handover or ongoing rental could be operated at once, including when an older rental was overdue. Existing bookings were preserved for Staff resolution; no automatic cancellation or refund was performed. The current single-booking rule is recorded below.

Single active customer booking — 2026-11-11: Laravel now blocks a customer from creating any new booking while a pending, confirmed, ongoing, or returned booking remains open, including a different vehicle or rental type. The mobile browse flow mirrors this server rule by keeping vehicle discovery available while disabling the booking action with the same concise message. Completion, cancellation, or rejection clears the restriction; no existing booking is changed automatically.

### Unpaid pending booking recovery

Customers can reopen an unpaid pending booking in mobile, choose rental dates, review current pricing and sign the current agreement before starting another PayPal checkout. Vehicle, driver option, pickup location and coverage remain fixed. Laravel checks the customer's ownership and pending/unpaid state, vehicle and customer availability, current late-return policy and reviewed prices. Delivery bookings require a newly confirmed, unexpired quote for the new dates. The earlier signed agreement and delivery quote remain retained as historical records; no previous payment documents are changed.

Only a checkout abandoned before capture or an explicitly declined first capture with no earlier uncertain attempt can be replaced. An approved, capturing, completed, or otherwise uncertain payment blocks changes and another checkout; the existing confirmation retry remains available for an uncertain approved capture. Provider creation errors retain the pending booking and attempt for reconciliation. This prevents a client error from being treated as proof that money was not taken. Checkout cancellation records an abandoned initial order rather than deleting its booking. These flows do not automatically refund or reconcile provider payments.

A pending booking with an approved or capturing initial payment temporarily blocks overlapping vehicle reservations while the provider outcome is unresolved. Capture attempts are serialized by a two-minute lease and retain the original PayPal idempotency key; after a worker interruption a later retry may take over, and stale responses cannot change the newer attempt. Automatic retries stop five hours after the first capture attempt, within PayPal’s documented six-hour idempotency retention window; older uncertain payments require reconciliation. Staff cancellation/rejection and payment-deadline cancellation wait while a capture remains unresolved. Reconciliation is still required if an uncertain payment cannot be confirmed, including after its booking no longer meets capture eligibility. The revision archive migration refuses rollback while it contains agreements, and an approved or capturing PayPal payment also blocks rollback.

PayPal request performance — 2026-11-12: `PayPalClient` caches OAuth tokens in Laravel's configured cache until one minute before provider expiry, keyed by a hash of the configured endpoint and credentials. Cache failures fall back to requesting a fresh token. OAuth, order-creation, and capture connections use a five-second connection timeout; the full request timeout remains 30 seconds. This removes a separate OAuth request from subsequent checkout/capture calls without changing booking or payment state. The token-reuse regression test passed (1 case, 4 assertions); sandbox checkout and remaining-balance flows passed focused feature tests (3 cases, 85 assertions); payment notification tests passed (16 cases, 87 assertions); `Pint --test` passed. The full backend suite reported 1,210/1,243 passing, with 31 failures and 2 errors in other location/geofence, mobile validation, booking availability/timezone, and Fleet Tracker areas. Live PayPal timing was not measured.
