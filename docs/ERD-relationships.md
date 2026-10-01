# JamJade ERD — Relationship Guide

This guide translates the relationships in `ERD.md` into plain sentences. “Can have many” means zero or more related rows; “may have one” means zero or one. Where a relationship is optional, the child foreign key may be `NULL`.

## `users`

- A user may have one customer profile, and each customer profile belongs to one user.
- A user may have one emergency contact, and each emergency contact belongs to one user.
- A user can have many customer documents, and each customer document belongs to one user.
- A user can review many customer documents, while a customer document may be reviewed by one user.
- A user can create many bookings, and each booking belongs to one user.
- A user can act in many booking events, while a booking event may name one acting user.
- A user can be the assigned driver for many booking assignments, while an assignment may have one driver.
- A user can make many payments, and each payment belongs to one user.
- A user can be responsible for many additional booking charges, and each charge has one responsible user.
- A user can create many additional booking charges, while an additional charge may name one creating user.
- A user can create many vehicle inspections, while an inspection may name one creating user.
- A user can sign many vehicle inspections, while an inspection signature may name one user signer.
- A user can create many vehicle maintenance plans, while a maintenance plan may name one creating user.
- A user can create, start, complete, or cancel many maintenance records; each maintenance record may name one user for each of those roles.
- A user can operate many telematics trips, and each telematics trip has one operator user.
- A user can receive many notifications, while a notification may be linked to one user.

## `customer_profiles`

- A customer profile belongs to one user, and a user may have one customer profile.

## `emergency_contacts`

- An emergency contact belongs to one user, and a user may have one emergency contact.

## `customer_documents`

- A customer document belongs to one user, and a user can have many customer documents.
- A customer document may be reviewed by one user, and a user can review many customer documents.
- A customer document can have many document files, and each document file belongs to one customer document.
- A customer document can be referenced by many notifications, while a notification may be linked to one customer document.

## `customer_document_files`

- A customer document file belongs to one customer document, and a customer document can have many document files.

## `vehicles`

- A vehicle may point to one current-condition inspection; the schema permits an inspection to be referenced by many vehicle rows.
- A vehicle can have many images, and each vehicle image belongs to one vehicle.
- A vehicle can have many features, and each vehicle feature belongs to one vehicle.
- A vehicle can be used in many bookings, and each booking uses one vehicle.
- A vehicle can have many inspections, and each inspection belongs to one vehicle.
- A vehicle can have many maintenance plans, and each maintenance plan belongs to one vehicle.
- A vehicle can have many maintenance records, and each maintenance record belongs to one vehicle.

## `vehicle_images`

- A vehicle image belongs to one vehicle, and a vehicle can have many images.

## `vehicle_features`

- A vehicle feature belongs to one vehicle, and a vehicle can have many features.

## `bookings`

- A booking belongs to one user, and a user can have many bookings.
- A booking belongs to one vehicle, and a vehicle can have many bookings.
- A booking can have many lifecycle events, and each booking event belongs to one booking.
- A booking may have one assignment, and each booking assignment belongs to one booking.
- A booking may have one accepted-terms record, and each booking-terms record belongs to one booking.
- A booking may have one confirmation-email record, and each confirmation-email record belongs to one booking.
- A booking can have many payments, and each payment belongs to one booking.
- A booking can have many additional charges, and each additional charge belongs to one booking.
- A booking can have many vehicle inspections, while a vehicle inspection may be linked to one booking.
- A self-drive booking may have one immutable booking-geofence snapshot and one telematics setup session.
- A booking may have one telematics trip, and each telematics trip belongs to one booking.
- A booking can be referenced by many notifications, while a notification may be linked to one booking.

## `booking_events`

- A booking event belongs to one booking, and a booking can have many events.
- A booking event may name one acting user, and a user can act in many booking events.

## `booking_assignments`

- A booking assignment belongs to one booking, and a booking may have one assignment.
- A booking assignment may name one driver, and a user can be the driver in many assignments.

## `booking_terms`

- A booking-terms record belongs to one booking, and a booking may have one accepted-terms record.

## `booking_confirmation_emails`

- A booking-confirmation-email record belongs to one booking, and a booking may have one confirmation-email record.

## `payments`

- A payment belongs to one booking, and a booking can have many payments.
- A payment belongs to one user, and a user can have many payments.
- A payment can be allocated to many additional charges through payment-charge allocations.

## `booking_additional_charges`

- An additional booking charge belongs to one booking, and a booking can have many additional charges.
- An additional booking charge has one responsible user, and a user can be responsible for many additional charges.
- An additional booking charge may name one creating user, and a user can create many additional charges.
- An additional booking charge can receive allocations from many payments through payment-charge allocations.

## `payment_charge_allocations`

- A payment-charge allocation belongs to one payment, and a payment can have many allocations.
- A payment-charge allocation belongs to one additional booking charge, and an additional charge can have many allocations.
- Therefore, payments and additional booking charges have a many-to-many relationship through this table; the allocation row records the amount applied.

## `vehicle_inspections`

- A vehicle inspection belongs to one vehicle, and a vehicle can have many inspections.
- A vehicle inspection may be linked to one booking, and a booking can have many inspections.
- A vehicle inspection may be based on one earlier inspection, and an inspection can be the base for many later inspections.
- A vehicle inspection may name one creating user, and a user can create many inspections.
- A vehicle inspection can have many checklist items, markers, and signatures; each of those rows belongs to one inspection.
- A vehicle inspection may be the current-condition inspection referenced by a vehicle; the schema does not make that reference unique.
- A vehicle inspection can be the resulting-condition inspection for many maintenance records, while a maintenance record may reference one resulting inspection.

## `vehicle_inspection_items`

- A vehicle inspection item belongs to one vehicle inspection, and a vehicle inspection can have many items.

## `vehicle_inspection_markers`

- A vehicle inspection marker belongs to one vehicle inspection, and a vehicle inspection can have many markers.

## `vehicle_inspection_signatures`

- A vehicle inspection signature belongs to one vehicle inspection, and a vehicle inspection can have many signatures.
- A vehicle inspection signature may name one user signer, and a user can sign many inspections.

## `vehicle_maintenance_plans`

- A vehicle maintenance plan belongs to one vehicle, and a vehicle can have many maintenance plans.
- A vehicle maintenance plan may name one creating user, and a user can create many maintenance plans.
- A maintenance plan can have many maintenance records, while a maintenance record may be linked to one plan.

## `vehicle_maintenance_records`

- A vehicle maintenance record belongs to one vehicle, and a vehicle can have many maintenance records.
- A vehicle maintenance record may belong to one maintenance plan, and a maintenance plan can have many records.
- A maintenance record may name one creating, starting, completing, and cancelling user; a user can hold each of those roles for many records.
- A maintenance record may reference one resulting-condition inspection, and an inspection can be referenced by many maintenance records.

## `booking_geofences` and telematics setup

- A reusable geofence template can be copied into many booking snapshots; each snapshot stores its own circle or polygon geometry and remains immutable.
- A geofence creator may create many templates. A used template cannot be soft-deleted, and soft deletion never erases the template row.
- A booking geofence belongs to one booking and may record one source geofence template and one assigning user.
- A telematics setup session belongs to one booking and may reference one immutable booking geofence.
- A setup session has many append-only setup-step attempts; each attempt may name one actor user.

## `telematics_trips`

- A telematics trip belongs to one booking, and a booking may have one telematics trip.
- A telematics trip has one operator user, and a user can operate many telematics trips.
- A telematics trip can have many telematics events, and each telematics event belongs to one trip.

## `telematics_events`

- A telematics event belongs to one telematics trip, and a telematics trip can have many events.

## `notifications`

- A notification may be linked to one user, and a user can have many notifications.
- A notification may be linked to one booking, and a booking can have many notifications.
- A notification may be linked to one customer document, and a customer document can have many notifications.
