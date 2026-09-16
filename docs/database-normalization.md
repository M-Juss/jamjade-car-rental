# Database normalization

The August 2026 normalization keeps one authoritative storage location for each fact while retaining selected booking totals and workflow states as intentional query projections.

## Main changes

- `payments` now stores both manual and provider-backed transactions. PayPal orders are identified by `provider = paypal`; the separate `paypal_checkouts` table was removed.
- `payment_charge_allocations` records which portion of a completed payment settles each additional charge. Charge payment status and paid time are derived from those allocations.
- Bookings now contain only the rental, customer, vehicle, quote, payment projection, and notes needed for the booking list and checkout. The duplicate `driver_option` and `delivery_time` columns were removed.
- Assignment and calibration details live in one-to-one `booking_assignments` records, customer signatures and accepted terms live in `booking_terms`, and confirmation delivery state lives in `booking_confirmation_emails`.
- `booking_events` is the single append-only timeline for status changes and operational milestones; the old `booking_status_logs` table and lifecycle timestamp columns were removed from `bookings`.
- Toll, late-return, and penalty amounts live in `booking_additional_charges`; bookings no longer duplicate those totals. A booking's first completed payment supplies its down-payment projection.
- Customer document metadata remains in `customer_documents`; file roles and paths live in `customer_document_files`.
- Telematics events inherit booking, vehicle, and operator context through their trip. Geofence observations are event fields rather than a separate log table.
- Vehicle service history comes from maintenance records and plans. Derived last-service fields and stored maintenance totals were removed.
- `vehicles.is_featured` replaces the misleading manually maintained `is_most_booked`; actual booking popularity is calculated from booking data.
- Each user can have at most one emergency contact record.

The resulting `bookings` table has 29 columns, including the standard audit/soft-delete columns. Its business data is limited to booking identity, rental period, locations, quote totals, payment projection, and notes; workflow details are linked through the focused tables above.

## Intentional projections

`bookings.payment_status`, `bookings.remaining_balance`, and quote totals remain stored because they are frequently filtered or must preserve the price agreed at booking time. Services update these values transactionally when their source records change. Lifecycle timestamps are read from `booking_events`, so there is one source of truth for the timeline.

## Migration policy

The normalization migrations are development-only and intentionally irreversible because they replace payment, telematics, and booking workflow storage. Apply them with a fresh migration and seed. Production adoption would require a separate staged data-copy migration and reconciliation report.
