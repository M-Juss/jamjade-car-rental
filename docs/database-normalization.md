# Database normalization

The August 2026 normalization is a dated historical change set. It keeps one authoritative storage location for each fact while retaining selected booking totals and workflow states as intentional query projections. The current migration-defined shape also includes the October monitoring-zone and delivery-quote extensions described below.

## Main changes

- `payments` now stores both manual and provider-backed transactions. PayPal orders are identified by `provider = paypal`; the separate `paypal_checkouts` table was removed.
- `payment_charge_allocations` records which portion of a completed payment settles each additional charge. Charge payment status and paid time are derived from those allocations.
- Bookings now contain only the rental, customer, vehicle, quote, payment projection, and notes needed for the booking list and checkout. The duplicate `driver_option` and `delivery_time` columns were removed.
- Driver assignment lives in one-to-one `booking_assignments` records. Pre-release telematics readiness is a separate `telematics_setup_sessions` workflow with retryable `telematics_setup_steps`; customer signatures and accepted terms live in `booking_terms`, and confirmation delivery state lives in `booking_confirmation_emails`.
- `booking_events` is the single append-only timeline for status changes and operational milestones; the old `booking_status_logs` table and lifecycle timestamp columns were removed from `bookings`.
- Toll, late-return, and penalty amounts live in `booking_additional_charges`; bookings no longer duplicate those totals. A booking's first completed payment supplies its down-payment projection.
- Customer document metadata remains in `customer_documents`; file roles and paths live in `customer_document_files`.
- Reusable circle and polygon `geofences` are copied into booking-scoped `booking_geofences` rows. A booking can have multiple custom/default zones, active defaults are copied at Start Rental, and every released row is frozen. Editing or deactivating a template cannot change a frozen rental boundary. Defaults remain soft-deletable even when released zones reference them; soft deletion retains the template row and future releases use the then-active defaults.
- `telematics_geofence_states` stores the independent membership/debounce state for each `(telematics_trip_id, booking_geofence_id)` pair. Setup sessions no longer point at one booking geofence, and geofence configuration does not gate the six readiness checks.
- `delivery_pricing_settings` stores editable fee inputs; `delivery_quotes` stores a customer/vehicle-bound route, pricing snapshot, toll review, and optional one-time booking consumption. The encrypted temporary coordinate payload is physically `TEXT` and is cleared after its expiry.
- A telematics trip is the one post-release driving lifecycle for a supported Self Drive or With Assigned Driver booking. The Customer or current assigned Driver is its operator. `telematics_location_points` is the legacy route-history boundary; the current consented collector instead overwrites encrypted `telematics_trips.latest_location`. `telematics_events` stores significant occurrences only. Table existence does not establish active route-history collection.
- Vehicle service history comes from maintenance records and plans. Derived last-service fields and stored maintenance totals were removed.
- `vehicles.is_featured` replaces the misleading manually maintained `is_most_booked`; actual booking popularity is calculated from booking data.
- Each user can have at most one emergency contact record.

The August normalization described a 29-column `bookings` table. The current migration-defined table has **30 columns**, including the standard audit/soft-delete columns, because `2026_10_12_000001_create_delivery_pricing` adds `delivery_toll_fee`. Its business data is limited to booking identity, rental period, locations, quote totals, payment projection, accepted delivery toll, and notes; workflow details are linked through the focused tables above. This is a migration-derived count, not a new live-schema audit.

## Intentional projections

`bookings.payment_status`, `bookings.remaining_balance`, and quote totals remain stored because they are frequently filtered or must preserve the price agreed at booking time. Services update these values transactionally when their source records change. Lifecycle timestamps are read from `booking_events`, so there is one source of truth for the timeline.

## Legacy account and document projections

`users` remains the authoritative account table, while `customer_profiles.can_self_drive`, `verification_status`, and `passport_required` are workflow projections/compatibility fields. They are not a second account or identity source. Current self-drive eligibility is based on the active document workflow: approved driver's license and proof of address; legacy passport records may remain stored but passport is not a required or offered upload. `customer_documents` and its `customer_document_files` rows remain the authoritative document metadata and file-role storage.

## Migration policy

The normalization migrations are development-only and intentionally irreversible because they replace payment, telematics, and booking workflow storage. Apply them with a fresh migration and seed. Production adoption would require a separate staged data-copy migration and reconciliation report.

## Telematics foundation policy

- Setup is pre-release; a trip is post-release. Setup readiness never starts a rental, and the existing authorized Start Rental action remains the release decision.
- The setup session lifecycle is `locked -> setup_required -> in_progress -> ready_for_release -> released`; check rows are append-only retries and readiness evaluates only each type's latest attempt. See the [central telematics guide](telematics-master-plan.md#existing-rental-and-handover-boundaries) for the domain boundary.
- The six device-readiness checks do not include a geofence check. Released-zone membership is evaluated separately from setup and is persisted per trip/zone in `telematics_geofence_states`.
- Telematics applies to Self Drive and With Assigned Driver bookings. One booking has at most one trip; pauses and resumes remain within it.
- Raw high-frequency accelerometer and gyroscope samples must not be stored as ordinary MySQL rows or hidden in setup-step evidence. Existing RC research uses isolated metadata rows and encrypted private sample files. Its native/durable recording extension follows the [central target design](telematics-master-plan.md#native-recording-and-protocol-upgrade).
- Current user-to-booking and booking-to-payment/telemetry cascades remain legacy retention risk. Users with rental history should be deactivated or anonymized instead of hard-deleted; changing that policy is a separate migration project.
