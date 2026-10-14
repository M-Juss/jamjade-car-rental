# Booking Rental Lifecycle

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

## Driver assignment

Staff and Driver are separate fixed roles. Staff runs authorized web rental operations; Driver mobile access is limited to assigned services, notifications, and their own charge settlement. Personnel accounts use deactivation to preserve history; active assignments and unpaid Driver charges block deactivation or role conversion. See [user roles and access](user-roles-and-access.md).

An Admin's Driver booking may be confirmed without an assigned Driver. Assignment is staff-controlled and is mandatory before Outgoing Inspection. A candidate must be an active Driver, have no overlapping confirmed/ongoing assignment, and have no unpaid Driver-responsible charge. A later Driver charge does not interrupt an already active service, but blocks a new assignment until paid.

Booking creation does not auto-assign a Driver. Assignment and reassignment create activity and Driver notifications.

## Readiness and release

The backend `RentalReadinessService` is authoritative. Outgoing requires a confirmed booking, permitted payment/readiness state, an operationally eligible vehicle, no incompatible maintenance restriction, and—for Admin's Driver—a valid assigned Driver. Self Drive also preserves the age and approved-document rules.

In standard mode, Start Rental is an authorized Jamjade web action and requires:

- confirmed booking and full customer payment;
- finalized Outgoing with the required signatures;
- for Self Drive only, a `ready_for_release` telematics setup session with every required setup step passed;
- eligible vehicle with no incompatible maintenance restriction;
- approved Self Drive documents/age, or a valid assigned Driver for Admin's Driver.

Success moves the booking to `ongoing`, records a `status_changed` event in `booking_events`, marks the vehicle rented, and notifies the Customer. Customer and Driver mobile clients cannot start the booking.

Local/testing handover test mode relaxes the documented payment, age, document, and outgoing-inspection gates for flow testing; it still requires the confirmed/self-drive scope, an operational vehicle, booking-conflict checks, and a real passing phone-mount attempt for telematics release readiness. No successful payment, document approval, inspection, calibration, or other device result is fabricated.

## Inspections and telematics setup

The immutable snapshot lineage is:

```text
Current -> Outgoing -> Incoming -> new Current
```

Outgoing is copied from Current, belongs to the booking, and never replaces Current. Incoming is copied from finalized Outgoing and becomes the new Current only when finalized. Previous snapshots remain immutable history.

Self Drive signatures are Jamjade Personnel + Customer. Admin's Driver signatures are authorized Jamjade Personnel + Assigned Driver; no Customer signature is used.

Finalized Self Drive Outgoing creates or enables a `setup_required` telematics setup session. In standard mode, Staff must start handover to move it to `in_progress`; Start Handover also requires approved self-drive documents, the scheduled `rental_start_at` to fall on the current `Asia/Manila` calendar date, and required inspection signatures. The scheduled clock time need not have arrived. Only then may retryable required checks be recorded. Phase 3 has six real device-readiness checks while five calibration types remain pending, so standard mode cannot reach `ready_for_release` from the mobile flow. The local/testing handover test mode is a documented exception: a real passing phone-mount attempt enables the release readiness projection without inventing other check results or calibration evidence. Start Handover never starts the rental and does not replace the authorized Start Rental action, which atomically marks the session `released`. Admin's Driver rentals have no telematics setup requirement. See [telematics-architecture.md](telematics-architecture.md), [telematics-handover-lifecycle.md](telematics-handover-lifecycle.md), and [telematics-device-location.md](telematics-device-location.md).

## Telematics boundary

Video recording, sending/uploads, auditing, and dashcam offerings are outside project scope. The retained device/location checks and calibration gate continue to apply to self-drive release. Removing video does not complete calibration capture or active-trip collection.

Telematics applies only to Self Drive. The Customer is the authorized operator; unrelated authenticated users cannot operate the trip. A released self-drive booking may create one actual trip. Pause and resume remain in that same trip.

Reusable circle and polygon defaults apply automatically before release, and Admin may add optional custom booking zones while a self-drive booking is pending or confirmed. The authorized Start Rental transaction copies active defaults, freezes all default/custom zones, and preserves their alert preferences for the released rental. Default templates may still be deactivated or soft-deleted for future rentals; released booking snapshots remain unchanged. Route points are high-volume location history; the trip's latest location fields are intentional fleet-monitoring cache fields. Significant occurrences are stored separately in `telematics_events`. Raw high-frequency motion samples and driver-behavior classification are not implemented or stored in MySQL.

End Trip changes only the telematics trip to `ended`. The booking remains `ongoing`, the vehicle remains rented, and Jamjade must still physically receive the vehicle and finalize Incoming Inspection.

## Return and additional charges

After Incoming is finalized, authorized staff may add zero or more responsibility-aware charges with type, description, decimal amount, creator, payment state, and responsibility.

- Self Drive charges are always Customer responsibility.
- Admin's Driver charges may be Customer or assigned Driver responsibility.
- Responsibility is chosen by staff; inspection or telematics evidence never assigns fault automatically.
- Customer charges increase the customer's final booking total and recompute the booking balance/payment state.
- Driver charges do not change the booking's customer total, balance, or payment status.

Staff explicitly finalizes the return-charge review. Only then may `ongoing -> returned` occur. Customer payment is not required for `returned`.

Returning releases only the rental restriction. `VehicleOperationalStatusService` recalculates actual state and preserves in-progress maintenance, scheduled/date restrictions, and manual unavailability. `completed` does not blindly set a vehicle to available.

## Settlement, restrictions, and completion

Customer and Driver charge payments extend the existing PayPal checkout/capture path. Current unpaid responsible charges for a booking are linked to one checkout, locked during capture, and marked paid idempotently. The mobile settlement summary exposes each charge's description and `outstandingAmount`, calculates the displayed amount in integer cents, and compares the newly created order with that summary before opening PayPal; a mismatch abandons the order and reloads review. Laravel verifies the returned capture is completed PHP for the expected checkout amount, and Driver charge capture also rechecks the locked outstanding charges. Notifications are the action surface; payment and charge records remain the source of truth and notification history is retained.

PayPal return and cancel callbacks are allowlisted server-side. Android uses an intent URL with a browser fallback; the mobile native-intent handler recognizes customer and Driver return/cancel paths. A warm Android/iOS WebBrowser session lets the payment screen confirm and capture the order, while a cold app launch opens the app normally and does not capture automatically. Capture still occurs only after the app confirms the returned order through Laravel.

An unresolved Customer-responsible balance blocks only creation of a new booking. The Customer can still authenticate, browse, inspect bookings/notifications, and pay. It does not cancel unrelated future bookings.

An unresolved Driver-responsible charge blocks only a new assignment. The Driver can still authenticate, see Notifications and Services, pay, and finish an already active assignment.

`returned -> completed` requires finalized Incoming/return review, zero customer balance, and an explicit authorized Jamjade action. Driver debt does not block completion. Completion records server time, actor, booking status log, and activity.

## Interfaces and privacy

The web booking row exposes a read-only View with progress and stage-specific records, Cancel while allowed, and a state-aware workflow. Continue Booking in the details view opens the next saved stage. Prepare Rental connects driver assignment, Outgoing Inspection, self-drive handover/setup, and explicit Start Rental. Process Return connects Incoming Inspection, inline charge entry, explicit review finalization, and explicit Mark Returned; the same dialog then shows completion requirements. Finish Booking resumes customer settlement and explicit Complete. Each successful save reloads the authoritative booking and advances within the dialog. If that reload fails, staff can retry the read without repeating the saved action. Closing and reopening resumes server state; unsaved form input is not persisted.

Setup and returned-booking settlement refresh automatically while staff are waiting. After the currently supported device checks pass, the next self-drive stage is shown as Calibration Pending; it remains read-only until calibration is implemented. Outstanding customer payment does not block Mark Returned, and Driver-responsible debt does not block Complete. The customer app displays a sanitized server-derived handover state and release/trip status; it does not receive monitoring-zone records or simulate setup verification. Driver mobile is limited to Notifications, Services, and Logout.

Management-only inspection details, readiness internals, admin notes, customer documents, and signature storage paths are not exposed through customer/Driver resources. All lifecycle mutations are enforced and authorized on Laravel; frontend visibility is only a user-experience aid.

The website workflow uses content-sized dialogs with a fixed header/footer and a scrolling body. Inspections provide section shortcuts; charge entry opens directly on its fields and returns to review after saving. Release, charge finalization, physical return, and completion keep their explicit confirmation step inside the same workflow panel, with Back to Review and an action-specific final button. Inspection finalization remains a direct signed submission. Read-only booking details separate Overview, Rental, Payment, and self-drive Documents/monitoring zones into tabs; saved stage views return to the booking overview.

## Delivery and initial pricing

Self Drive uses free garage pickup and return only. With Driver allows free garage pickup or paid delivery with the same pickup/end trip address. Laravel consumes an owned, complete delivery quote before creating a booking or PayPal checkout. A successful new route without Google `tollInfo` becomes a complete PHP 0 toll quote immediately; a route with Google-reported toll information needs prior staff review, and legacy uncertain requests remain pending until replaced or reviewed. Waiting requests do not reserve vehicles. Accepted initial delivery/toll amounts stay fixed. They are distinct from post-rental `toll_fee` additional charges. Admin-only pricing settings affect new quotes only. See [delivery pricing](delivery-pricing.md) for calculation, location, permissions, configuration, and retention.
