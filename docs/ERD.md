# JamJade canonical database ERD

Audited against the applied MySQL schema on 2026-09-26. The database has **45 tables**: 30 business tables, 6 authorization/audit tables, and 9 Laravel infrastructure tables. The diagrams below show persisted relationships, not merely model conveniences or planned capabilities. See [database-audit-erd-readiness.md](database-audit-erd-readiness.md) for the complete column/index inventory and every foreign key.

**Readiness: READY WITH DOCUMENTED ISSUES.** The live schema can be diagrammed accurately; the retention and model-alignment issues in the audit should be resolved before a production schema freeze.

Mermaid cardinality follows database constraints: a nullable FK makes the parent optional for that child; a unique single-column FK makes the child zero-or-one per parent. Business-service restrictions that lack a database constraint are explained in prose rather than drawn as one-to-one.

## A. Domain ERD

This overview uses only real business tables. It omits detail rows to keep the rental lifecycle readable.

```mermaid
erDiagram
    users ||--o{ bookings : "user_id"
    vehicles ||--o{ bookings : "vehicle_id"
    users ||--o| customer_profiles : "user_id"
    users ||--o{ customer_documents : "user_id"
    vehicles ||--o{ vehicle_inspections : "vehicle_id"
    bookings o|--o{ vehicle_inspections : "booking_id"
    bookings ||--o{ payments : "booking_id"
    bookings ||--o| booking_assignments : "booking_id"
    users o|--o{ booking_assignments : "driver_id"
    bookings ||--o{ booking_additional_charges : "booking_id"
    vehicles ||--o{ vehicle_maintenance_records : "vehicle_id"
    geofences o|--o{ booking_geofences : "source_geofence_id"
    bookings ||--o| booking_geofences : "booking_id"
    bookings ||--o| telematics_setup_sessions : "booking_id"
    telematics_setup_sessions ||--o{ telematics_setup_steps : "telematics_setup_session_id"
    bookings ||--o| telematics_trips : "booking_id"
    telematics_trips ||--o{ telematics_location_points : "telematics_trip_id"
    telematics_trips ||--o{ telematics_events : "trip_id"
```

The diagram expresses **database capacity**, not current row counts. An inspection may lack a booking because initial and standalone condition snapshots are vehicle-scoped. A driver assignment may have no driver while assignment is pending. A trip is physically limited to one per booking by a unique FK, even though one Eloquent relationship is named as a collection.

## B. Complete physical ERD by bounded context

Every business and authorization/audit table appears in one primary diagram below. Referenced parent tables repeated in another context are abbreviated to their primary key. Relationship labels are the actual child FK columns. Polymorphic `model_type/model_id` and `subject_type/subject_id` pairs are described separately because MySQL has no FK to a single parent table for them.
### Identity and verification

```mermaid
erDiagram
    users {
        int id PK
        string email
        int is_active
    }
    customer_profiles {
        int id PK
        int user_id FK
        string verification_status
        datetime deleted_at
    }
    emergency_contacts {
        int id PK
        int user_id FK
    }
    customer_documents {
        int id PK
        int user_id FK
        string document_type
        string status
        int reviewed_by FK
        datetime deleted_at
    }
    customer_document_files {
        int id PK
        int customer_document_id FK
        string role
        string file_path
    }
    notifications {
        int id PK
        int user_id FK
        int booking_id FK
        int customer_document_id FK
        string type
        string category
        string priority
        datetime read_at
    }
    bookings {
        int id PK
    }
    customer_documents ||--o{ customer_document_files : "customer_document_id"
    users o|--o{ customer_documents : "reviewed_by"
    users ||--o{ customer_documents : "user_id"
    users ||--o| customer_profiles : "user_id"
    users ||--o| emergency_contacts : "user_id"
    bookings o|--o{ notifications : "booking_id"
    customer_documents o|--o{ notifications : "customer_document_id"
    users o|--o{ notifications : "user_id"
```

### Fleet and vehicle catalog

```mermaid
erDiagram
    vehicles {
        int id PK
        int current_condition_inspection_id FK
        string name
        string plate_number
        decimal price_per_day
        string fuel_type
        string status
        datetime deleted_at
    }
    vehicle_images {
        int id PK
        int vehicle_id FK
        string image_path
        int is_primary
        int sort_order
    }
    vehicle_features {
        int id PK
        int vehicle_id FK
        string feature_name
    }
    vehicle_inspections {
        int id PK
    }
    vehicles ||--o{ vehicle_features : "vehicle_id"
    vehicles ||--o{ vehicle_images : "vehicle_id"
    vehicle_inspections o|--o{ vehicles : "current_condition_inspection_id"
```

### Booking, payment, and driver

```mermaid
erDiagram
    bookings {
        int id PK
        string booking_code
        int user_id FK
        int vehicle_id FK
        string rental_type
        datetime rental_start_at
        datetime rental_end_at
        string pickup_location_type
        string status
        string payment_status
        decimal remaining_balance
        datetime balance_due_at
        datetime balance_reminder_sent_at
        decimal total_amount
        datetime deleted_at
    }
    booking_events {
        int id PK
        int booking_id FK
        string event_type
        string old_status
        string new_status
        int actor_user_id FK
    }
    booking_assignments {
        int id PK
        int booking_id FK
        int driver_id FK
        datetime assigned_at
    }
    booking_terms {
        int id PK
        int booking_id FK
        text customer_signature
        string terms_version
        datetime accepted_at
    }
    booking_confirmation_emails {
        int id PK
        int booking_id FK
        datetime sent_at
        string status
    }
    payments {
        int id PK
        int booking_id FK
        int user_id FK
        string provider
        string status
        decimal amount
        string provider_order_id
        string provider_transaction_id
        json provider_response
    }
    booking_additional_charges {
        int id PK
        int booking_id FK
        string type
        string description
        decimal amount
        string responsibility
        int responsible_user_id FK
        int created_by FK
    }
    payment_charge_allocations {
        int payment_id PK
        int booking_additional_charge_id PK
        decimal amount
    }
    users {
        int id PK
    }
    vehicles {
        int id PK
    }
    bookings ||--o{ booking_additional_charges : "booking_id"
    users o|--o{ booking_additional_charges : "created_by"
    users ||--o{ booking_additional_charges : "responsible_user_id"
    bookings ||--o| booking_assignments : "booking_id"
    users o|--o{ booking_assignments : "driver_id"
    bookings ||--o| booking_confirmation_emails : "booking_id"
    users o|--o{ booking_events : "actor_user_id"
    bookings ||--o{ booking_events : "booking_id"
    bookings ||--o| booking_terms : "booking_id"
    users ||--o{ bookings : "user_id"
    vehicles ||--o{ bookings : "vehicle_id"
    booking_additional_charges ||--o{ payment_charge_allocations : "booking_additional_charge_id"
    payments ||--o{ payment_charge_allocations : "payment_id"
    bookings ||--o{ payments : "booking_id"
    users ||--o{ payments : "user_id"
```

### Inspection and condition

```mermaid
erDiagram
    vehicle_inspections {
        int id PK
        int vehicle_id FK
        int booking_id FK
        string type
        string status
        int odometer
        int fuel_level
        int based_on_inspection_id FK
        int created_by FK
    }
    vehicle_inspection_items {
        int id PK
        int inspection_id FK
        string category
        string item_key
        string item_label
        int value
    }
    vehicle_inspection_markers {
        int id PK
        int inspection_id FK
        int sequence_number
        string panel
        decimal x_position
        decimal y_position
        string issue_type
    }
    vehicle_inspection_signatures {
        int id PK
        int inspection_id FK
        string signer_type
        int user_id FK
        string signer_name
        string signature_path
        datetime signed_at
    }
    bookings {
        int id PK
    }
    users {
        int id PK
    }
    vehicles {
        int id PK
    }
    vehicle_inspections ||--o{ vehicle_inspection_items : "inspection_id"
    vehicle_inspections ||--o{ vehicle_inspection_markers : "inspection_id"
    vehicle_inspections ||--o{ vehicle_inspection_signatures : "inspection_id"
    users o|--o{ vehicle_inspection_signatures : "user_id"
    vehicle_inspections o|--o{ vehicle_inspections : "based_on_inspection_id"
    bookings o|--o{ vehicle_inspections : "booking_id"
    users o|--o{ vehicle_inspections : "created_by"
    vehicles ||--o{ vehicle_inspections : "vehicle_id"
```

### Maintenance

```mermaid
erDiagram
    vehicle_maintenance_plans {
        int id PK
        int vehicle_id FK
        string trigger_type
        int interval_km
        int interval_days
        int baseline_odometer
        date baseline_date
        date next_due_date
        int next_due_odometer
        int is_active
        int created_by FK
    }
    vehicle_maintenance_records {
        int id PK
        int vehicle_id FK
        int maintenance_plan_id FK
        string status
        datetime scheduled_start
        datetime scheduled_end
        datetime actual_started_at
        datetime completed_at
        int odometer_at_start
        int odometer_at_completion
        string service_provider
        decimal labor_cost
        decimal parts_cost
        decimal other_cost
        int condition_verification_required
        datetime completion_details_recorded_at
        int created_by FK
        int started_by FK
        int completed_by FK
        int cancelled_by FK
        int resulting_condition_inspection_id FK
    }
    users {
        int id PK
    }
    vehicle_inspections {
        int id PK
    }
    vehicles {
        int id PK
    }
    users o|--o{ vehicle_maintenance_plans : "created_by"
    vehicles ||--o{ vehicle_maintenance_plans : "vehicle_id"
    vehicle_inspections o|--o{ vehicle_maintenance_records : "resulting_condition_inspection_id"
    users o|--o{ vehicle_maintenance_records : "cancelled_by"
    users o|--o{ vehicle_maintenance_records : "completed_by"
    users o|--o{ vehicle_maintenance_records : "created_by"
    vehicle_maintenance_plans o|--o{ vehicle_maintenance_records : "maintenance_plan_id"
    users o|--o{ vehicle_maintenance_records : "started_by"
    vehicles ||--o{ vehicle_maintenance_records : "vehicle_id"
```

### Geofences

```mermaid
erDiagram
    geofences {
        int id PK
        string name
        string geometry_type
        decimal center_latitude
        decimal center_longitude
        decimal radius_meters
        json polygon_coordinates
        int created_by FK
        datetime deleted_at
    }
    booking_geofences {
        int id PK
        int booking_id FK
        int source_geofence_id FK
        string name_snapshot
        string geometry_type
        decimal center_latitude
        decimal center_longitude
        decimal radius_meters
        json polygon_coordinates
        int assigned_by FK
    }
    bookings {
        int id PK
    }
    users {
        int id PK
    }
    users o|--o{ booking_geofences : "assigned_by"
    bookings ||--o| booking_geofences : "booking_id"
    geofences o|--o{ booking_geofences : "source_geofence_id"
    users o|--o{ geofences : "created_by"
```

### Telematics

```mermaid
erDiagram
    telematics_setup_sessions {
        int id PK
        int booking_id FK
        int booking_geofence_id FK
        string status
        datetime started_at
        datetime ready_at
        datetime released_at
    }
    telematics_setup_steps {
        int id PK
        int telematics_setup_session_id FK
        string step_type
        int attempt_number
        string status
        datetime started_at
        datetime completed_at
        text failure_reason
        json evidence
        int actor_user_id FK
    }
    telematics_trips {
        int id PK
        int booking_id FK
        int operator_user_id FK
        string status
        datetime paused_at
        datetime resumed_at
        decimal start_latitude
        decimal start_longitude
        decimal end_latitude
        decimal end_longitude
        decimal current_latitude
        decimal current_longitude
        decimal current_speed
    }
    telematics_location_points {
        int id PK
        int telematics_trip_id FK
        decimal latitude
        decimal longitude
        decimal accuracy
        decimal speed
        decimal heading
        datetime captured_at
        datetime received_at
    }
    telematics_events {
        int id PK
        int trip_id FK
        string event_type
        string severity
        decimal latitude
        decimal longitude
        json metadata
        datetime occurred_at
    }
    booking_geofences {
        int id PK
    }
    bookings {
        int id PK
    }
    users {
        int id PK
    }
    telematics_trips ||--o{ telematics_events : "trip_id"
    telematics_trips ||--o{ telematics_location_points : "telematics_trip_id"
    booking_geofences o|--o{ telematics_setup_sessions : "booking_geofence_id"
    bookings ||--o| telematics_setup_sessions : "booking_id"
    users o|--o{ telematics_setup_steps : "actor_user_id"
    telematics_setup_sessions ||--o{ telematics_setup_steps : "telematics_setup_session_id"
    bookings ||--o| telematics_trips : "booking_id"
    users ||--o{ telematics_trips : "operator_user_id"
```

### Authorization and audit

```mermaid
erDiagram
    roles {
        int id PK
        string name
        string guard_name
    }
    permissions {
        int id PK
        string name
        string guard_name
    }
    model_has_roles {
        int role_id PK
        string model_type PK
        int model_id PK
    }
    model_has_permissions {
        int permission_id PK
        string model_type PK
        int model_id PK
    }
    role_has_permissions {
        int permission_id PK
        int role_id PK
    }
    activity_log {
        int id PK
        text description
        string subject_type
        int subject_id
        string event
        string causer_type
        int causer_id
        datetime created_at
    }
    permissions ||--o{ model_has_permissions : "permission_id"
    roles ||--o{ model_has_roles : "role_id"
    permissions ||--o{ role_has_permissions : "permission_id"
    roles ||--o{ role_has_permissions : "role_id"
```

## Data dictionary: business tables

| Table | Purpose | Primary owner / parent | Important relationships |
| --- | --- | --- | --- |
| `users` | Authenticated account for renters, personnel, and drivers. | Identity root | No FK parent |
| `customer_profiles` | Customer details and self-drive eligibility projection. | users | `users` via `user_id` |
| `emergency_contacts` | One emergency contact per account. | users | `users` via `user_id` |
| `customer_documents` | Customer document metadata and review decision. | users | `users` via `reviewed_by`, `users` via `user_id` |
| `customer_document_files` | Document file roles and stored paths. | customer_documents | `customer_documents` via `customer_document_id` |
| `vehicles` | Fleet master record and pointer to accepted current condition. | Fleet root | `vehicle_inspections` via `current_condition_inspection_id` |
| `vehicle_images` | Catalog image paths and display order. | vehicles | `vehicles` via `vehicle_id` |
| `vehicle_features` | Named vehicle amenities. | vehicles | `vehicles` via `vehicle_id` |
| `bookings` | Renter, vehicle, rental period, quote, and payment projection. | users + vehicles | `users` via `user_id`, `vehicles` via `vehicle_id` |
| `booking_events` | Booking status and operational milestone history. | bookings | `users` via `actor_user_id`, `bookings` via `booking_id` |
| `booking_assignments` | One current assigned driver per booking. | bookings | `bookings` via `booking_id`, `users` via `driver_id` |
| `booking_terms` | Accepted rental terms and customer signature. | bookings | `bookings` via `booking_id` |
| `booking_confirmation_emails` | Confirmation-email delivery state. | bookings | `bookings` via `booking_id` |
| `payments` | Manual and provider-backed payment/order records. | bookings + users | `bookings` via `booking_id`, `users` via `user_id` |
| `booking_additional_charges` | Post-return charge and responsible account. | bookings | `bookings` via `booking_id`, `users` via `created_by`, `users` via `responsible_user_id` |
| `payment_charge_allocations` | Amount of a payment allocated to a charge. | payments + booking_additional_charges | `booking_additional_charges` via `booking_additional_charge_id`, `payments` via `payment_id` |
| `vehicle_inspections` | Initial, condition-update, outgoing, or incoming condition snapshot. | vehicles; optionally bookings | `vehicle_inspections` via `based_on_inspection_id`, `bookings` via `booking_id`, `users` via `created_by`, `vehicles` via `vehicle_id` |
| `vehicle_inspection_items` | Historical checklist answer and label. | vehicle_inspections | `vehicle_inspections` via `inspection_id` |
| `vehicle_inspection_markers` | Body issue marker and location. | vehicle_inspections | `vehicle_inspections` via `inspection_id` |
| `vehicle_inspection_signatures` | Signer identity, time, and private file reference. | vehicle_inspections | `vehicle_inspections` via `inspection_id`, `users` via `user_id` |
| `vehicle_maintenance_plans` | Editable mileage/date maintenance reminder. | vehicles | `users` via `created_by`, `vehicles` via `vehicle_id` |
| `vehicle_maintenance_records` | Scheduled and completed service work with costs. | vehicles; optionally a plan | `vehicle_inspections` via `resulting_condition_inspection_id`, `users` via `cancelled_by`, `users` via `completed_by`, `users` via `created_by`, `vehicle_maintenance_plans` via `maintenance_plan_id`, `users` via `started_by`, `vehicles` via `vehicle_id` |
| `geofences` | Reusable circle or polygon boundary template. | Template root | `users` via `created_by` |
| `booking_geofences` | One copied rental boundary snapshot per booking. | bookings; optionally geofences | `users` via `assigned_by`, `bookings` via `booking_id`, `geofences` via `source_geofence_id` |
| `telematics_setup_sessions` | One pre-release handover workflow per self-drive booking. | bookings | `booking_geofences` via `booking_geofence_id`, `bookings` via `booking_id` |
| `telematics_setup_steps` | Retryable, typed setup check attempts. | telematics_setup_sessions | `users` via `actor_user_id`, `telematics_setup_sessions` via `telematics_setup_session_id` |
| `telematics_trips` | One post-release driving lifecycle per booking. | bookings + operator users | `bookings` via `booking_id`, `users` via `operator_user_id` |
| `telematics_location_points` | Timestamped active-trip GPS route points. | telematics_trips | `telematics_trips` via `telematics_trip_id` |
| `telematics_events` | Significant active-trip occurrences. | telematics_trips | `telematics_trips` via `trip_id` |
| `notifications` | Recipient-facing in-app messages and optional subject links. | users; optionally bookings/documents | `bookings` via `booking_id`, `customer_documents` via `customer_document_id`, `users` via `user_id` |

## Historical integrity and physical boundaries

- `booking_geofences` copies circle or polygon geometry from an optional reusable `geofences` template, or from a custom definition. The booking FK is unique. Editing or deactivating the source does not change the copied values. The model rejects updates, and the assignment service rejects a second snapshot. A hard-deleted template would set `source_geofence_id` null but leave the copied boundary.
- `vehicles.current_condition_inspection_id` points to the accepted finalized condition. `vehicle_inspections.based_on_inspection_id` records snapshot lineage: current to outgoing to incoming/new current. Initial and standalone condition-update rows have no booking. Finalized inspections and child rows are protected against ordinary model updates/deletes; DB cascades still apply if their parent is physically deleted.
- Inspection checklist rows and marker rows contain snapshot values, and signature rows keep signer identity/time plus a private file path. Vehicle catalog images and document files also use path rows; the image/signature bytes are stored outside MySQL.
- `booking_events` is the persisted booking lifecycle/milestone timeline. `booking_terms` and `booking_confirmation_emails` each have a unique booking FK. `booking_assignments` stores only the current driver assignment; reassignment activity is logged separately, not as multiple assignment rows.
- `payments` contains manual and PayPal transactions/orders. A PayPal checkout is an Eloquent view over rows with `provider = paypal`, not a physical `paypal_checkouts` table. `payment_charge_allocations` gives each payment/charge pair an allocated amount. Booking status and the booking payment-status projection are distinct.
- A self-drive `telematics_setup_session` is pre-release, with multiple append-only `telematics_setup_steps` attempts. A post-release `telematics_trip` is separate and has at most one row per booking. `telematics_location_points` stores route history; trip current-location fields are an intentional latest-state cache; `telematics_events` stores significant occurrences.
- `activity_log` has polymorphic `subject` and `causer` pairs, without SQL FKs. `model_has_roles`, `model_has_permissions`, and `personal_access_tokens` likewise use polymorphic model references. Those are not drawn as direct user FKs.

## Implemented database architecture

The physical schema and Laravel services support customer verification, vehicles, booking/payment/charge records, driver assignment, condition inspections, maintenance, circle and polygon templates, one immutable booking boundary, pre-release setup attempts, and the trip/location/event data structure. The mobile application currently performs only seven real setup-readiness checks. Trip APIs and storage exist, but the current mobile flow does not start an active trip or stream location. Reports are computed from existing business records rather than a report table.

## Planned or not yet operational

The five calibration step **types** exist in the PHP enum and can be represented by `telematics_setup_steps`, but calibration capture is not implemented. Background active-trip GPS streaming, an offline telemetry queue, driver scoring, AI/ML classification, expressway/corridor zones, and multiple booking geofence zones are not present as working database domains. No AI-specific tables were found. The possible future Python ML service is an external processing boundary; no classification table or flow is implied by this ERD.

The proposed future ML path is mobile sensor capture → Laravel → MySQL telemetry → Python feature extraction/classification → Laravel → significant event or analytics. It is a plan, not an implemented relationship in these diagrams.

## Infrastructure outside the business diagrams

`migrations`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `sessions`, `personal_access_tokens`, and `password_reset_tokens` are present in MySQL. Their schemas and indexes are inventoried in the audit document; they are not JamJade rental entities.
