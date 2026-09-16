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

An Admin's Driver booking may be confirmed without an assigned Driver. Assignment is staff-controlled and is mandatory before Outgoing Inspection. A candidate must be an active Driver, have no overlapping confirmed/ongoing assignment, and have no unpaid Driver-responsible charge. A later Driver charge does not interrupt an already active service, but blocks a new assignment until paid.

Booking creation does not auto-assign a Driver. Assignment and reassignment create activity and Driver notifications.

## Readiness and release

The backend `RentalReadinessService` is authoritative. Outgoing requires a confirmed booking, permitted payment/readiness state, an operationally eligible vehicle, no incompatible maintenance restriction, and—for Admin's Driver—a valid assigned Driver. Self Drive also preserves the age and approved-document rules.

Start Rental is an authorized Jamjade web action and requires:

- confirmed booking and full customer payment;
- finalized Outgoing with the required signatures;
- successful mobile calibration;
- eligible vehicle with no incompatible maintenance restriction;
- approved Self Drive documents/age, or a valid assigned Driver for Admin's Driver.

Success moves the booking to `ongoing`, records a `status_changed` event in `booking_events`, marks the vehicle rented, and notifies the Customer. Customer and Driver mobile clients cannot start the booking.

## Inspections and calibration

The immutable snapshot lineage is:

```text
Current -> Outgoing -> Incoming -> new Current
```

Outgoing is copied from Current, belongs to the booking, and never replaces Current. Incoming is copied from finalized Outgoing and becomes the new Current only when finalized. Previous snapshots remain immutable history.

Self Drive signatures are Jamjade Personnel + Customer. Admin's Driver signatures are authorized Jamjade Personnel + Assigned Driver; no Customer signature is used.

Finalized Outgoing makes calibration `available`. Only the booking Customer for Self Drive or assigned Driver for Admin's Driver can record calibration. Calibration proves device readiness and does not start the rental.

## Telematics boundary

For Self Drive, the Customer is the authorized operator. For Admin's Driver, the assigned Driver is the authorized operator. Unrelated authenticated users cannot operate the trip.

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

Customer and Driver charge payments extend the existing PayPal checkout/capture path. Current unpaid responsible charges for a booking are linked to one checkout, locked during capture, and marked paid idempotently. Notifications are the action surface; payment and charge records remain the source of truth and notification history is retained.

An unresolved Customer-responsible balance blocks only creation of a new booking. The Customer can still authenticate, browse, inspect bookings/notifications, and pay. It does not cancel unrelated future bookings.

An unresolved Driver-responsible charge blocks only a new assignment. The Driver can still authenticate, see Notifications and Services, pay, and finish an already active assignment.

`returned -> completed` requires finalized Incoming/return review, zero customer balance, and an explicit authorized Jamjade action. Driver debt does not block completion. Completion records server time, actor, booking status log, and activity.

## Interfaces and privacy

The web Booking Details dialog is the lifecycle control center, with derived progress/readiness and state-aware inspection, assignment, Start Rental, return-charge, Returned, and Complete actions. The customer app displays sanitized progress, calibration, trip boundary, responsible charges, and PayPal settlement. Driver mobile is limited to Notifications, Services, and Logout.

Management-only inspection details, readiness internals, admin notes, customer documents, and signature storage paths are not exposed through customer/Driver resources. All lifecycle mutations are enforced and authorized on Laravel; frontend visibility is only a user-experience aid.
