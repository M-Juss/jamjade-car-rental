# JamJade presentation ERD

This is a **simplified view of the migration-defined current database** for an ERD presentation. The live MySQL schema was checked on 2026-09-28: **45 tables, 455 columns, and 59 foreign keys**; that is a historical baseline. A source review on 2026-10-14 infers **48 tables and 510 columns** if all 40 repository migrations apply in order, but no live schema query or migration run was performed for that count. This view shows **17 existing tables** (31 omitted from the drawing) and only their identifying, linking, and main business-state columns. It does not propose deleting tables or columns. The [complete physical ERD](ERD.md) and [database audit](database-audit-erd-readiness.md) remain the references for implementation.

## Core ERD

The overview uses one connected diagram, with each table shown once. Curved line jumps mark connector crossings without a relationship junction.

```mermaid
erDiagram
    users {
        bigint id PK
        string name
        string email
        string password "Password hash"
        boolean is_active
    }
    roles {
        bigint id PK
        string name
    }
    customer_profiles {
        bigint id PK
        bigint user_id FK
        boolean can_self_drive
        string verification_status
    }
    customer_documents {
        bigint id PK
        bigint user_id FK
        string document_type
        string status
    }
    vehicles {
        bigint id PK
        string plate_number
        string status
        decimal price_per_day
    }
    bookings {
        bigint id PK
        bigint user_id FK
        bigint vehicle_id FK
        string rental_type
        datetime rental_start_at
        datetime rental_end_at
        string status
        decimal total_amount
    }
    booking_assignments {
        bigint id PK
        bigint booking_id FK
        bigint driver_id FK
    }
    payments {
        bigint id PK
        bigint booking_id FK
        string purpose
        string status
        decimal amount
    }
    vehicle_inspections {
        bigint id PK
        bigint vehicle_id FK
        bigint booking_id FK
        string type
        string status
        datetime finalized_at
    }
    geofences {
        bigint id PK
        string name
        string geometry_type
        boolean is_active
    }
    booking_geofences {
        bigint id PK
        bigint booking_id FK
        bigint source_geofence_id FK
        string geometry_type
        string scope
        boolean notify_on_enter
        boolean notify_on_exit
        datetime frozen_at
    }
    telematics_setup_sessions {
        bigint id PK
        bigint booking_id FK
        string status
    }
    telematics_trips {
        bigint id PK
        bigint booking_id FK
        bigint operator_user_id FK
        string status
        datetime started_at
        datetime ended_at
    }
    telematics_location_points {
        bigint id PK
        bigint telematics_trip_id FK
        decimal latitude
        decimal longitude
        datetime captured_at
    }
    telematics_events {
        bigint id PK
        bigint trip_id FK
        string event_type
        string severity
        datetime occurred_at
    }
    telematics_geofence_states {
        bigint id PK
        bigint telematics_trip_id FK
        bigint booking_geofence_id FK
        boolean inside
        boolean uncertain
        int candidate_count
        datetime last_captured_at
    }
    delivery_quotes {
        uuid id PK
        bigint user_id FK
        bigint vehicle_id FK
        string destination_address
        text destination_point "Encrypted temporary coordinates"
        decimal delivery_fee
        decimal delivery_toll_fee
        string status
        bigint reviewed_by FK
        bigint booking_id FK
    }

    roles }o..o{ users : "assigned roles (logical)"
    users ||--o| customer_profiles : "user_id"
    users ||--o{ customer_documents : "user_id"
    users ||--o{ bookings : "user_id"
    users o|--o{ booking_assignments : "driver_id"
    users ||--o{ telematics_trips : "operator_user_id"
    vehicles ||--o{ bookings : "vehicle_id"
    vehicles ||--o{ vehicle_inspections : "vehicle_id"
    bookings ||--o| booking_assignments : "booking_id"
    bookings ||--o{ payments : "booking_id"
    bookings o|--o{ vehicle_inspections : "booking_id"
    bookings ||--o{ booking_geofences : "booking_id"
    geofences o|--o{ booking_geofences : "source_geofence_id"
    bookings ||--o| telematics_setup_sessions : "booking_id"
    bookings ||--o| telematics_trips : "booking_id"
    telematics_trips ||--o{ telematics_location_points : "telematics_trip_id"
    telematics_trips ||--o{ telematics_events : "trip_id"
    telematics_trips ||--o{ telematics_geofence_states : "telematics_trip_id"
    booking_geofences ||--o{ telematics_geofence_states : "booking_geofence_id"
    users ||--o{ delivery_quotes : "user_id"
    users o|--o{ delivery_quotes : "reviewed_by"
    vehicles ||--o{ delivery_quotes : "vehicle_id"
    bookings o|--o| delivery_quotes : "booking_id (unique)"
```

## How to explain it

**Roles:** A user can have multiple roles, and a role can be assigned to multiple users. The diagram summarizes this as a direct many-to-many relationship between `users` and `roles`. Its dotted connector is a logical association implemented by the omitted `model_has_roles` table, rather than a direct database foreign key. The role-assignment table remains in the database.

1. A customer **user** can have a profile and verification documents. The customer books a **vehicle**; an optional driver assignment supports rentals with an owner's driver.
2. The **booking** anchors the rental dates, status, amount, payments, and vehicle condition inspections. An inspection may also exist without a booking, such as an initial vehicle condition snapshot.
3. For a self-drive rental, active default **geofences** and optional custom zones are represented as booking-scoped rows. Custom rows are editable before release; Start Rental copies active defaults and freezes every zone. Defaults may later be deactivated or soft-deleted without changing frozen snapshots. The setup session records six pre-release readiness checks without a geofence gate. After release, the booking can have one telematics trip, with many location points, significant events, and one state row per frozen zone. A delivery quote stores the customer/vehicle-bound route and toll decision until one booking consumes it.

The solid connectors reflect database foreign keys and uniqueness, not guaranteed row counts. For example, `bookings` can have at most one `telematics_trips` row because `telematics_trips.booking_id` is unique; the application limits trip creation to eligible self-drive rentals. A driver assignment can exist before `driver_id` is filled. A booking can have many `booking_geofences` rows; `(booking_id, source_geofence_id)` prevents duplicate default sources while allowing multiple custom rows with a `NULL` source. Released rows are frozen snapshots, and the setup session intentionally has no zone FK. `booking_geofences` stores an independent snapshot, so its source template can be absent.

## What the overview groups away

| Area | Existing tables kept in the database but omitted here |
| --- | --- |
| Customer details and notifications | `emergency_contacts`, `customer_document_files`, `notifications` |
| Booking and settlement details | `booking_terms`, `booking_events`, `booking_confirmation_emails`, `booking_additional_charges`, `payment_charge_allocations` |
| Vehicle catalog, condition evidence, and maintenance | `vehicle_images`, `vehicle_features`, `vehicle_inspection_items`, `vehicle_inspection_markers`, `vehicle_inspection_signatures`, `vehicle_maintenance_plans`, `vehicle_maintenance_records` |
| Retryable setup detail | `telematics_setup_steps` |
| Delivery pricing configuration | `delivery_pricing_settings` |
| Role assignments, permission details, and audit | `model_has_roles`, `permissions`, `model_has_permissions`, `role_has_permissions`, `activity_log` |
| Laravel infrastructure | `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `migrations`, `password_reset_tokens`, `personal_access_tokens`, `sessions` |

Video recording, sending/uploads, auditing, and dashcam offerings are outside project scope. No video entity or relationship belongs in this ERD. The retirement migration removes the old permission and any Dashcam vehicle features; the existing table structure is retained.
