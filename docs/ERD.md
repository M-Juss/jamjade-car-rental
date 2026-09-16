# JamJade Car Rental — Business Database ERD

Paste the DBML below into [dbdiagram.io](https://dbdiagram.io) to render the normalized business schema.

For a table-by-table sentence explanation of every relationship, see [ERD-relationships.md](ERD-relationships.md).

The diagram intentionally excludes Laravel infrastructure and generic audit tables such as cache, jobs, sessions, permissions, personal access tokens, and `activity_log`. `users` is included because it is the identity anchor for every business domain.

`bookings` is the compact booking core. Assignment/calibration, accepted terms, confirmation delivery, and lifecycle history are linked child records, so the booking row does not repeat those concerns.

```dbml
// ============================================================================
// IDENTITY AND CUSTOMER DOMAIN
// ============================================================================

Table users {
  id bigint [pk, increment]
  name varchar
  email varchar [unique]
  phone_number varchar [unique, null]
  email_verified_at timestamp [null]
  phone_verified_at timestamp [null]
  password varchar
  is_active boolean
  last_login_at timestamp [null]
  remember_token varchar [null]
  created_at timestamp
  updated_at timestamp
}

Table customer_profiles {
  id bigint [pk, increment]
  user_id bigint [not null, unique]
  first_name varchar [null]
  last_name varchar [null]
  birthdate date [null]
  address text [null]
  profile_picture varchar [null]
  profile_completed_at timestamp [null]
  emergency_contact_skipped_at timestamp [null]
  can_self_drive boolean
  verification_status varchar
  passport_required boolean
  driving_intent varchar [null]
  created_at timestamp
  updated_at timestamp
  deleted_at timestamp [null]
}

Table emergency_contacts {
  id bigint [pk, increment]
  user_id bigint [not null, unique]
  name varchar
  relationship varchar
  phone_number varchar
  created_at timestamp
  updated_at timestamp
}

Table customer_documents {
  id bigint [pk, increment]
  user_id bigint [not null]
  document_type varchar
  document_number varchar [null]
  expires_at date [null]
  status varchar
  submitted_at timestamp [null]
  reviewed_by bigint [null]
  reviewed_at timestamp [null]
  rejection_reason text [null]
  created_at timestamp
  updated_at timestamp
  deleted_at timestamp [null]

  Indexes {
    (user_id, document_type) [unique]
  }
}

Table customer_document_files {
  id bigint [pk, increment]
  customer_document_id bigint [not null]
  role varchar
  file_path varchar
  created_at timestamp
  updated_at timestamp

  Indexes {
    (customer_document_id, role) [unique]
  }
}

// ============================================================================
// VEHICLE AND FLEET DOMAIN
// ============================================================================

Table vehicles {
  id bigint [pk, increment]
  current_condition_inspection_id bigint [null]
  name varchar
  brand varchar
  model varchar
  plate_number varchar [unique]
  price_per_day decimal(12,2)
  seats tinyint
  transmission varchar
  fuel_type varchar
  color varchar [null]
  status varchar
  is_featured boolean
  description text [null]
  created_at timestamp
  updated_at timestamp
  deleted_at timestamp [null]
}

Table vehicle_images {
  id bigint [pk, increment]
  vehicle_id bigint [not null]
  image_path varchar
  is_primary boolean
  sort_order int
  created_at timestamp
  updated_at timestamp
}

Table vehicle_features {
  id bigint [pk, increment]
  vehicle_id bigint [not null]
  feature_name varchar
  created_at timestamp
  updated_at timestamp
}

// ============================================================================
// BOOKING AND PAYMENT DOMAIN
// ============================================================================

Table bookings {
  id bigint [pk, increment]
  booking_code varchar [unique]
  user_id bigint [not null]
  vehicle_id bigint [not null]
  rental_type varchar
  rental_start_at timestamp
  rental_end_at timestamp
  pickup_location_type varchar
  pickup_location varchar
  return_location varchar
  owner_driver_coverage varchar [null]
  status varchar
  payment_status varchar
  price_per_day decimal(12,2)
  duration_days int
  subtotal decimal(12,2)
  delivery_fee decimal(12,2)
  owner_driver_fee decimal(12,2)
  add_ons_total decimal(12,2)
  discount_total decimal(12,2)
  remaining_balance decimal(12,2)
  balance_due_at timestamp [null]
  balance_reminder_sent_at timestamp [null]
  total_amount decimal(12,2)
  notes text [null]
  admin_notes text [null]
  created_at timestamp
  updated_at timestamp
  deleted_at timestamp [null]
}

Table booking_events {
  id bigint [pk, increment]
  booking_id bigint [not null]
  event_type varchar
  old_status varchar [null]
  new_status varchar [null]
  actor_user_id bigint [null]
  reason text [null]
  created_at timestamp
  updated_at timestamp
}

Table booking_assignments {
  id bigint [pk, increment]
  booking_id bigint [not null, unique]
  driver_id bigint [null]
  assigned_at timestamp [null]
  calibration_status varchar
  calibrated_by bigint [null]
  calibrated_at timestamp [null]
  created_at timestamp
  updated_at timestamp
}

Table booking_terms {
  id bigint [pk, increment]
  booking_id bigint [not null, unique]
  customer_signature text [null]
  terms_version varchar [null]
  accepted_at timestamp [null]
  created_at timestamp
  updated_at timestamp
}

Table booking_confirmation_emails {
  id bigint [pk, increment]
  booking_id bigint [not null, unique]
  sent_at timestamp [null]
  status varchar [null]
  error text [null]
  created_at timestamp
  updated_at timestamp
}

Table payments {
  id bigint [pk, increment]
  booking_id bigint [not null]
  user_id bigint [not null]
  provider varchar
  purpose varchar [null]
  status varchar
  amount decimal(12,2)
  currency varchar(3)
  provider_order_id varchar(128) [null, unique]
  provider_transaction_id varchar(128) [null, unique]
  approval_url text [null]
  provider_response json [null]
  proof_path varchar [null]
  completed_at timestamp [null]
  failed_at timestamp [null]
  created_at timestamp
  updated_at timestamp
}

Table booking_additional_charges {
  id bigint [pk, increment]
  booking_id bigint [not null]
  type varchar
  description varchar
  amount decimal(12,2)
  responsibility varchar
  responsible_user_id bigint [not null]
  created_by bigint [null]
  created_at timestamp
  updated_at timestamp
}

Table payment_charge_allocations {
  payment_id bigint [not null]
  booking_additional_charge_id bigint [not null]
  amount decimal(12,2)
  created_at timestamp
  updated_at timestamp

  Indexes {
    (payment_id, booking_additional_charge_id) [pk]
  }
}

// ============================================================================
// VEHICLE CONDITION AND INSPECTION DOMAIN
// ============================================================================

Table vehicle_inspections {
  id bigint [pk, increment]
  vehicle_id bigint [not null]
  booking_id bigint [null]
  type varchar
  status varchar
  odometer bigint
  fuel_level tinyint
  comments text [null]
  condition_update_reason varchar [null]
  condition_update_notes text [null]
  based_on_inspection_id bigint [null]
  created_by bigint [null]
  finalized_at timestamp [null]
  created_at timestamp
  updated_at timestamp
}

Table vehicle_inspection_items {
  id bigint [pk, increment]
  inspection_id bigint [not null]
  category varchar
  item_key varchar
  item_label varchar
  value boolean
  notes text [null]
  created_at timestamp
  updated_at timestamp

  Indexes {
    (inspection_id, category, item_key) [unique]
  }
}

Table vehicle_inspection_markers {
  id bigint [pk, increment]
  inspection_id bigint [not null]
  sequence_number int
  panel varchar
  x_position decimal(6,3)
  y_position decimal(6,3)
  issue_type varchar
  description text
  created_at timestamp
  updated_at timestamp

  Indexes {
    (inspection_id, sequence_number) [unique]
  }
}

Table vehicle_inspection_signatures {
  id bigint [pk, increment]
  inspection_id bigint [not null]
  signer_type varchar
  user_id bigint [null]
  signer_name varchar
  signature_path varchar
  signed_at timestamp
  created_at timestamp
  updated_at timestamp

  Indexes {
    (inspection_id, signer_type) [unique]
  }
}

// ============================================================================
// MAINTENANCE DOMAIN
// ============================================================================

Table vehicle_maintenance_plans {
  id bigint [pk, increment]
  vehicle_id bigint [not null]
  name varchar
  category varchar
  description text [null]
  trigger_type varchar
  interval_km int [null]
  interval_days int [null]
  baseline_odometer bigint [null]
  baseline_date date [null]
  next_due_date date [null]
  next_due_odometer bigint [null]
  is_active boolean
  created_by bigint [null]
  created_at timestamp
  updated_at timestamp
}

Table vehicle_maintenance_records {
  id bigint [pk, increment]
  vehicle_id bigint [not null]
  maintenance_plan_id bigint [null]
  category varchar
  title varchar
  description text [null]
  status varchar
  scheduled_start timestamp
  scheduled_end timestamp
  actual_started_at timestamp [null]
  completed_at timestamp [null]
  cancelled_at timestamp [null]
  odometer_at_start bigint [null]
  odometer_at_completion bigint [null]
  service_provider varchar [null]
  technician varchar [null]
  labor_cost decimal(12,2) [null]
  parts_cost decimal(12,2) [null]
  other_cost decimal(12,2) [null]
  work_performed text [null]
  notes text [null]
  cancellation_reason text [null]
  condition_verification_required boolean
  completion_details_recorded_at timestamp [null]
  created_by bigint [null]
  started_by bigint [null]
  completed_by bigint [null]
  cancelled_by bigint [null]
  resulting_condition_inspection_id bigint [null]
  created_at timestamp
  updated_at timestamp
}

// ============================================================================
// TELEMATICS DOMAIN
// ============================================================================

Table telematics_trips {
  id bigint [pk, increment]
  booking_id bigint [not null, unique]
  operator_user_id bigint [not null]
  status varchar
  started_at timestamp [null]
  paused_at timestamp [null]
  resumed_at timestamp [null]
  ended_at timestamp [null]
  start_latitude decimal(10,7) [null]
  start_longitude decimal(10,7) [null]
  end_latitude decimal(10,7) [null]
  end_longitude decimal(10,7) [null]
  current_latitude decimal(10,7) [null]
  current_longitude decimal(10,7) [null]
  current_speed decimal(8,2) [null]
  battery_percent tinyint [null]
  gps_signal_percent tinyint [null]
  current_zone varchar(120) [null]
  allowed_zone varchar(120)
  last_location_at timestamp [null]
  created_at timestamp
  updated_at timestamp
}

Table telematics_events {
  id bigint [pk, increment]
  trip_id bigint [not null]
  event_type varchar
  severity varchar
  latitude decimal(10,7) [null]
  longitude decimal(10,7) [null]
  speed decimal(8,2) [null]
  accelerometer_x decimal(12,6) [null]
  accelerometer_y decimal(12,6) [null]
  accelerometer_z decimal(12,6) [null]
  gyroscope_x decimal(12,6) [null]
  gyroscope_y decimal(12,6) [null]
  gyroscope_z decimal(12,6) [null]
  geofence_status varchar(24) [null]
  distance_from_allowed_area decimal(8,2) [null]
  current_area varchar(120) [null]
  description text [null]
  occurred_at timestamp
  created_at timestamp
  updated_at timestamp
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

Table notifications {
  id bigint [pk, increment]
  user_id bigint [null]
  booking_id bigint [null]
  customer_document_id bigint [null]
  type varchar
  category varchar
  priority varchar
  title varchar
  message text
  full_message longtext [null]
  data json [null]
  action_label varchar [null]
  read_at timestamp [null]
  created_at timestamp
  updated_at timestamp
}

// ============================================================================
// RELATIONSHIPS — read these from the child table toward its parent.
// ============================================================================

// Customer
Ref: customer_profiles.user_id - users.id
Ref: emergency_contacts.user_id - users.id
Ref: customer_documents.user_id > users.id
Ref: customer_documents.reviewed_by > users.id
Ref: customer_document_files.customer_document_id > customer_documents.id

// Fleet
Ref: vehicles.current_condition_inspection_id > vehicle_inspections.id
Ref: vehicle_images.vehicle_id > vehicles.id
Ref: vehicle_features.vehicle_id > vehicles.id

// Booking and payments
Ref: bookings.user_id > users.id
Ref: bookings.vehicle_id > vehicles.id
Ref: booking_events.booking_id > bookings.id
Ref: booking_events.actor_user_id > users.id
Ref: booking_assignments.booking_id - bookings.id
Ref: booking_assignments.driver_id > users.id
Ref: booking_assignments.calibrated_by > users.id
Ref: booking_terms.booking_id - bookings.id
Ref: booking_confirmation_emails.booking_id - bookings.id
Ref: payments.booking_id > bookings.id
Ref: payments.user_id > users.id
Ref: booking_additional_charges.booking_id > bookings.id
Ref: booking_additional_charges.responsible_user_id > users.id
Ref: booking_additional_charges.created_by > users.id
Ref: payment_charge_allocations.payment_id > payments.id
Ref: payment_charge_allocations.booking_additional_charge_id > booking_additional_charges.id

// Inspections
Ref: vehicle_inspections.vehicle_id > vehicles.id
Ref: vehicle_inspections.booking_id > bookings.id
Ref: vehicle_inspections.based_on_inspection_id > vehicle_inspections.id
Ref: vehicle_inspections.created_by > users.id
Ref: vehicle_inspection_items.inspection_id > vehicle_inspections.id
Ref: vehicle_inspection_markers.inspection_id > vehicle_inspections.id
Ref: vehicle_inspection_signatures.inspection_id > vehicle_inspections.id
Ref: vehicle_inspection_signatures.user_id > users.id

// Maintenance
Ref: vehicle_maintenance_plans.vehicle_id > vehicles.id
Ref: vehicle_maintenance_plans.created_by > users.id
Ref: vehicle_maintenance_records.vehicle_id > vehicles.id
Ref: vehicle_maintenance_records.maintenance_plan_id > vehicle_maintenance_plans.id
Ref: vehicle_maintenance_records.created_by > users.id
Ref: vehicle_maintenance_records.started_by > users.id
Ref: vehicle_maintenance_records.completed_by > users.id
Ref: vehicle_maintenance_records.cancelled_by > users.id
Ref: vehicle_maintenance_records.resulting_condition_inspection_id > vehicle_inspections.id

// Telematics
Ref: telematics_trips.booking_id - bookings.id
Ref: telematics_trips.operator_user_id > users.id
Ref: telematics_events.trip_id > telematics_trips.id

// Notifications
Ref: notifications.user_id > users.id
Ref: notifications.booking_id > bookings.id
Ref: notifications.customer_document_id > customer_documents.id
```
