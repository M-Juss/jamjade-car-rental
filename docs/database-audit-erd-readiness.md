# JamJade database audit and ERD readiness

> Geofence update (2026-10-01): the historical single-boundary schema described below has been superseded by multiple default/custom monitoring zones, release-time freezing, and `telematics_geofence_states`. Setup now has six readiness checks and no geofence gate. See [current monitoring architecture](geofence-monitoring.md).

Audited 2026-09-26. This is a read-only schema audit; no migration or data-changing SQL was run. The backend configuration names MySQL at `127.0.0.1:3306`, database `jamjade_car_rental`, with `APP_ENV=local`. The host and environment show a local development connection; **disposability was not independently verified**, so no destructive command was considered. The live schema was read through `information_schema`; migration status was read through Laravel.

## Source-reviewed current migration delta (2026-10-14; inferred, not live-audited)

This update did not read a database, load local environment values, run Artisan, or apply/reset migrations. It reviewed the repository's 40 migration files, affected Eloquent models, and geofence/delivery services. Assuming the migrations are applied in timestamp order to the 2026-09-28 live baseline of 45 tables, 455 columns, and 59 foreign keys, the migration-defined current shape is **48 tables, 510 columns, and 64 foreign keys**: 33 business tables, 6 authorization/audit tables, and 9 Laravel infrastructure tables. These are inferred counts, not claims about the currently live database.

The `2026_10_01_000001_convert_geofences_to_monitoring_zones` migration changes the boundary contract as follows:

- `geofences` gains `notify_on_enter` and `notify_on_exit`; its existing soft-delete storage remains.
- `booking_geofences.booking_id` is no longer unique. The table gains an index on `booking_id`, `scope`, per-zone `notify_on_enter`/`notify_on_exit`, nullable `frozen_at`, and unique `(booking_id, source_geofence_id)`. A booking can therefore have multiple custom rows (`source_geofence_id` `NULL`) and at most one copied row for each source template.
- Released rows are frozen snapshots. Start Rental copies active default templates, freezes all booking zones, and later model/service operations reject updates or deletes to frozen rows. Custom rows are editable only before release. A default may be deactivated or soft-deleted even when released zones reference it; soft deletion is retained by the model/service contract, while a source FK may still be nulled by a hard delete outside that contract and copied geometry remains.
- `telematics_setup_sessions.booking_geofence_id` and its foreign key are removed. The six readiness checks do not include `geofence_check`, and zone configuration does not gate setup or release.
- New `telematics_geofence_states` has 11 columns: `id`, `telematics_trip_id`, `booking_geofence_id`, `inside`, `uncertain`, `candidate_inside`, `candidate_count`, `candidate_started_at`, `last_captured_at`, and timestamps. Its two FKs cascade on parent deletion, and unique `(telematics_trip_id, booking_geofence_id)` gives one state per trip/zone pair.

The `2026_10_12_000001_create_delivery_pricing` migration adds:

- `delivery_pricing_settings` with 9 columns: singleton-style fee inputs (`minimum_fee`, `included_km`, `per_km_rate`), garage address/coordinates, and timestamps; it has no foreign keys.
- `delivery_quotes` with 29 columns and four foreign keys: required `user_id` (cascade on user delete), required `vehicle_id`, nullable `reviewed_by`, and nullable unique `booking_id`. `destination_point` is physically `TEXT`; the Laravel model casts it as encrypted temporary coordinate-array data. `point_expires_at` bounds retention and expiry cleanup clears the value. Route geometry is transient; `pricing_snapshot` is JSON and preserves the inputs used for the quote.
- `bookings.delivery_toll_fee`, a decimal amount defaulting to zero. It is the accepted initial delivery toll projection and is separate from post-rental additional charges.

The complete inventory and foreign-key register below remain the **historical 2026-09-26/28 live snapshot**. They intentionally retain the original 45-table/455-column/59-FK evidence; use the delta above and the current migration-defined ERD for the later shape. No new live count is asserted.

For current behavior beyond the physical migration delta, read [geofence monitoring](geofence-monitoring.md) and [delivery pricing](delivery-pricing.md). Those guides define the release-time freeze, soft-deletable defaults, server-side zone evaluation, quote retention, and one-time booking consumption rules.

## Scope retirement on 2026-09-29

The owner confirmed that this is a development-only database and retired video recording, sending/uploads, auditing, and dashcam offerings. The scoped follow-up inventory found 45 tables, no video-related tables or columns, one retired permission assigned to two roles, no direct assignments or video-only roles, and no stored Dashcam vehicle features. Migration `2026_09_29_000001_retire_video_features` removes the retired permission (including cascading role/direct assignments) and any matching Dashcam features without changing tables, accounts, retained permissions, or historical booking totals. Its data deletion cannot be reconstructed by rollback. The 36-migration count below describes the original audit; the retirement adds one migration.

The retirement migration was applied to the local database and verified: 37 applied migrations, 45 tables, zero video-named permissions or roles, zero retired permission assignments, and zero Dashcam feature records.

The Staff/Driver refactor subsequently applied `2026_09_29_000002_fix_personnel_roles`, bringing the migration count to 38 without changing tables. Driver role permissions are now empty; Staff grants are preserved, and the Admin personnel permission is named `manage personnel`. No custom-role accounts, direct permission assignments, or mixed-role accounts were found. Before/after record hashes verified preservation of users, bookings, assignments, payments, charges, inspections, and signatures. See [user roles and access](user-roles-and-access.md).

## Verdict

**Historical baseline: READY WITH DOCUMENTED ISSUES.** The 2026-09-26/28 live snapshot supported a truthful canonical ERD at that date. Structural retention risks and a few model/schema cardinality mismatches should be resolved before a production schema freeze. The current migration-defined shape is documented separately above and has not been live-audited.

## Historical table counts and categories (2026-09-26/28 baseline)

| Category | Count | Tables |
| --- | ---: | --- |
| Core business | 30 | `users`, `customer_profiles`, `emergency_contacts`, `customer_documents`, `customer_document_files`, `vehicles`, `vehicle_images`, `vehicle_features`, `bookings`, `booking_events`, `booking_assignments`, `booking_terms`, `booking_confirmation_emails`, `payments`, `booking_additional_charges`, `payment_charge_allocations`, `vehicle_inspections`, `vehicle_inspection_items`, `vehicle_inspection_markers`, `vehicle_inspection_signatures`, `vehicle_maintenance_plans`, `vehicle_maintenance_records`, `geofences`, `booking_geofences`, `telematics_setup_sessions`, `telematics_setup_steps`, `telematics_trips`, `telematics_location_points`, `telematics_events`, `notifications` |
| Authorization / auditing | 6 | `roles`, `permissions`, `model_has_roles`, `model_has_permissions`, `role_has_permissions`, `activity_log` |
| Laravel / infrastructure | 9 | `migrations`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `sessions`, `personal_access_tokens`, `password_reset_tokens` |

## Historical complete live-table inventory (2026-09-26/28)

Every column below is shown as `name:type`; `?` means nullable. The inventory reports live MySQL metadata at the historical audit date, including columns without Eloquent models. Index entries exclude the primary key. Timestamps are included in the column list. `deleted_at` identifies soft-delete storage, while actual Eloquent soft-delete behavior is discussed in the findings. `JSON` and polymorphic columns are explicit in the lists. It is superseded for current monitoring-zone and delivery tables by the source-reviewed delta above.

### Core business

#### `users`

Authenticated account for renters, personnel, and drivers. Primary key: `id`.

- Columns: `id:bigint unsigned`, `name:varchar(255)`, `email:varchar(255)`, `phone_number:varchar(255)?`, `email_verified_at:timestamp?`, `phone_verified_at:timestamp?`, `password:varchar(255)`, `is_active:tinyint(1)`, `last_login_at:timestamp?`, `remember_token:varchar(100)?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: none.
- Unique constraints: `users_email_unique(email)`, `users_phone_number_unique(phone_number)`.
- Other indexes: `users_is_active_index(is_active)`.

#### `customer_profiles`

Customer details and self-drive eligibility projection. Primary key: `id`.

- Columns: `id:bigint unsigned`, `user_id:bigint unsigned`, `first_name:varchar(255)?`, `last_name:varchar(255)?`, `birthdate:date?`, `address:text?`, `country_code:varchar(2)?`, `region_code:varchar(20)?`, `province_code:varchar(20)?`, `city_municipality_code:varchar(20)?`, `barangay_code:varchar(20)?`, `address_line:varchar(255)?`, `postal_code:varchar(20)?`, `profile_picture:varchar(255)?`, `profile_completed_at:timestamp?`, `emergency_contact_skipped_at:timestamp?`, `can_self_drive:tinyint(1)`, `verification_status:varchar(255)`, `passport_required:tinyint(1)`, `driving_intent:varchar(255)?`, `created_at:timestamp?`, `updated_at:timestamp?`, `deleted_at:timestamp?`.
- Foreign keys: `user_id` → `users.id`.
- Unique constraints: `customer_profiles_user_id_unique(user_id)`.
- Other indexes: `customer_profiles_can_self_drive_index(can_self_drive)`, `customer_profiles_verification_status_index(verification_status)`.

#### `emergency_contacts`

One emergency contact per account. Primary key: `id`.

- Columns: `id:bigint unsigned`, `user_id:bigint unsigned`, `name:varchar(255)`, `relationship:varchar(255)`, `phone_number:varchar(255)`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `user_id` → `users.id`.
- Unique constraints: `emergency_contacts_user_id_unique(user_id)`.
- Other indexes: none.

#### `customer_documents`

Customer document metadata and review decision. Primary key: `id`.

- Columns: `id:bigint unsigned`, `user_id:bigint unsigned`, `document_type:varchar(255)`, `document_number:varchar(255)?`, `expires_at:date?`, `status:varchar(255)`, `submitted_at:timestamp?`, `reviewed_by:bigint unsigned?`, `reviewed_at:timestamp?`, `rejection_reason:text?`, `created_at:timestamp?`, `updated_at:timestamp?`, `deleted_at:timestamp?`.
- Foreign keys: `reviewed_by` → `users.id`, `user_id` → `users.id`.
- Unique constraints: `customer_documents_user_id_document_type_unique(user_id, document_type)`.
- Other indexes: `customer_documents_document_type_index(document_type)`, `customer_documents_reviewed_by_foreign(reviewed_by)`, `customer_documents_status_index(status)`.

#### `customer_document_files`

Document file roles and stored paths. Primary key: `id`.

- Columns: `id:bigint unsigned`, `customer_document_id:bigint unsigned`, `role:varchar(24)`, `file_path:varchar(255)`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `customer_document_id` → `customer_documents.id`.
- Unique constraints: `customer_document_files_customer_document_id_role_unique(customer_document_id, role)`.
- Other indexes: none.

#### `vehicles`

Fleet master record and pointer to accepted current condition. Primary key: `id`.

- Columns: `id:bigint unsigned`, `current_condition_inspection_id:bigint unsigned?`, `name:varchar(255)`, `brand:varchar(255)`, `model:varchar(255)`, `plate_number:varchar(32)`, `price_per_day:decimal(12,2)`, `seats:tinyint unsigned`, `transmission:varchar(255)`, `fuel_type:varchar(255)`, `color:varchar(255)?`, `status:varchar(255)`, `is_featured:tinyint(1)`, `description:text?`, `created_at:timestamp?`, `updated_at:timestamp?`, `deleted_at:timestamp?`.
- Foreign keys: `current_condition_inspection_id` → `vehicle_inspections.id`.
- Unique constraints: `vehicles_plate_number_unique(plate_number)`.
- Other indexes: `vehicles_brand_index(brand)`, `vehicles_current_condition_inspection_id_foreign(current_condition_inspection_id)`, `vehicles_fuel_type_index(fuel_type)`, `vehicles_is_most_booked_index(is_featured)`, `vehicles_model_index(model)`, `vehicles_name_index(name)`, `vehicles_status_index(status)`, `vehicles_transmission_index(transmission)`.

#### `vehicle_images`

Catalog image paths and display order. Primary key: `id`.

- Columns: `id:bigint unsigned`, `vehicle_id:bigint unsigned`, `image_path:varchar(255)`, `is_primary:tinyint(1)`, `sort_order:int unsigned`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `vehicle_id` → `vehicles.id`.
- Unique constraints: none.
- Other indexes: `vehicle_images_is_primary_index(is_primary)`, `vehicle_images_sort_order_index(sort_order)`, `vehicle_images_vehicle_id_foreign(vehicle_id)`.

#### `vehicle_features`

Named vehicle amenities. Primary key: `id`.

- Columns: `id:bigint unsigned`, `vehicle_id:bigint unsigned`, `feature_name:varchar(255)`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `vehicle_id` → `vehicles.id`.
- Unique constraints: `vehicle_features_vehicle_id_feature_name_unique(vehicle_id, feature_name)`.
- Other indexes: none.

#### `bookings`

Renter, vehicle, rental period, quote, and payment projection. Primary key: `id`.

- Columns: `id:bigint unsigned`, `booking_code:varchar(255)`, `user_id:bigint unsigned`, `vehicle_id:bigint unsigned`, `rental_type:varchar(255)`, `rental_start_at:timestamp`, `rental_end_at:timestamp`, `pickup_location_type:varchar(255)`, `pickup_location:varchar(255)`, `return_location:varchar(255)`, `owner_driver_coverage:varchar(255)?`, `status:varchar(255)`, `payment_status:varchar(255)`, `price_per_day:decimal(12,2)`, `duration_days:int unsigned`, `subtotal:decimal(12,2)`, `delivery_fee:decimal(12,2)`, `owner_driver_fee:decimal(12,2)`, `add_ons_total:decimal(12,2)`, `discount_total:decimal(12,2)`, `remaining_balance:decimal(12,2)`, `balance_due_at:timestamp?`, `balance_reminder_sent_at:timestamp?`, `total_amount:decimal(12,2)`, `notes:text?`, `admin_notes:text?`, `created_at:timestamp?`, `updated_at:timestamp?`, `deleted_at:timestamp?`.
- Foreign keys: `user_id` → `users.id`, `vehicle_id` → `vehicles.id`.
- Unique constraints: `bookings_booking_code_unique(booking_code)`.
- Other indexes: `bookings_balance_due_at_index(balance_due_at)`, `bookings_payment_status_index(payment_status)`, `bookings_pickup_location_type_index(pickup_location_type)`, `bookings_rental_end_at_index(rental_end_at)`, `bookings_rental_start_at_index(rental_start_at)`, `bookings_rental_type_index(rental_type)`, `bookings_status_index(status)`, `bookings_user_id_status_index(user_id, status)`, `bookings_vehicle_id_status_index(vehicle_id, status)`.

#### `booking_events`

Booking status and operational milestone history. Primary key: `id`.

- Columns: `id:bigint unsigned`, `booking_id:bigint unsigned`, `event_type:varchar(40)`, `old_status:varchar(255)?`, `new_status:varchar(255)?`, `actor_user_id:bigint unsigned?`, `reason:text?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `actor_user_id` → `users.id`, `booking_id` → `bookings.id`.
- Unique constraints: none.
- Other indexes: `booking_events_actor_user_id_foreign(actor_user_id)`, `booking_events_event_type_index(event_type)`, `booking_events_lookup_index(booking_id, event_type, created_at)`.

#### `booking_assignments`

One current assigned driver per booking. Primary key: `id`.

- Columns: `id:bigint unsigned`, `booking_id:bigint unsigned`, `driver_id:bigint unsigned?`, `assigned_at:timestamp?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `booking_id` → `bookings.id`, `driver_id` → `users.id`.
- Unique constraints: `booking_assignments_booking_id_unique(booking_id)`.
- Other indexes: `booking_assignments_driver_index(driver_id, assigned_at)`.

#### `booking_terms`

Accepted rental terms and customer signature. Primary key: `id`.

- Columns: `id:bigint unsigned`, `booking_id:bigint unsigned`, `customer_signature:text?`, `terms_version:varchar(40)?`, `accepted_at:timestamp?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `booking_id` → `bookings.id`.
- Unique constraints: `booking_terms_booking_id_unique(booking_id)`.
- Other indexes: none.

#### `booking_confirmation_emails`

Confirmation-email delivery state. Primary key: `id`.

- Columns: `id:bigint unsigned`, `booking_id:bigint unsigned`, `sent_at:timestamp?`, `status:varchar(24)?`, `error:text?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `booking_id` → `bookings.id`.
- Unique constraints: `booking_confirmation_emails_booking_id_unique(booking_id)`.
- Other indexes: none.

#### `payments`

Manual and provider-backed payment/order records. Primary key: `id`.

- Columns: `id:bigint unsigned`, `booking_id:bigint unsigned`, `user_id:bigint unsigned`, `provider:varchar(32)`, `purpose:varchar(40)?`, `status:varchar(32)`, `amount:decimal(12,2)`, `currency:varchar(3)`, `provider_order_id:varchar(128)?`, `provider_transaction_id:varchar(128)?`, `approval_url:text?`, `provider_response:json?`, `proof_path:varchar(255)?`, `completed_at:timestamp?`, `failed_at:timestamp?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `booking_id` → `bookings.id`, `user_id` → `users.id`.
- Unique constraints: `payments_provider_order_id_unique(provider_order_id)`, `payments_provider_transaction_id_unique(provider_transaction_id)`.
- Other indexes: `payments_booking_id_status_index(booking_id, status)`, `payments_provider_status_index(provider, status)`, `payments_user_id_status_index(user_id, status)`.

#### `booking_additional_charges`

Post-return charge and responsible account. Primary key: `id`.

- Columns: `id:bigint unsigned`, `booking_id:bigint unsigned`, `type:varchar(255)`, `description:varchar(1000)`, `amount:decimal(12,2)`, `responsibility:varchar(255)`, `responsible_user_id:bigint unsigned`, `created_by:bigint unsigned?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `booking_id` → `bookings.id`, `created_by` → `users.id`, `responsible_user_id` → `users.id`.
- Unique constraints: none.
- Other indexes: `booking_additional_charges_booking_id_foreign(booking_id)`, `booking_additional_charges_created_by_foreign(created_by)`, `booking_additional_charges_responsibility_index(responsibility)`, `booking_additional_charges_type_index(type)`, `charge_responsible_index(responsible_user_id, responsibility)`.

#### `payment_charge_allocations`

Amount of a payment allocated to a charge. Primary key: `payment_id, booking_additional_charge_id`.

- Columns: `payment_id:bigint unsigned`, `booking_additional_charge_id:bigint unsigned`, `amount:decimal(12,2)`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `booking_additional_charge_id` → `booking_additional_charges.id`, `payment_id` → `payments.id`.
- Unique constraints: none.
- Other indexes: `payment_charge_allocations_booking_additional_charge_id_foreign(booking_additional_charge_id)`.

#### `vehicle_inspections`

Initial, condition-update, outgoing, or incoming condition snapshot. Primary key: `id`.

- Columns: `id:bigint unsigned`, `vehicle_id:bigint unsigned`, `booking_id:bigint unsigned?`, `type:varchar(255)`, `status:varchar(255)`, `odometer:bigint unsigned`, `fuel_level:tinyint unsigned`, `comments:text?`, `condition_update_reason:varchar(255)?`, `condition_update_notes:text?`, `based_on_inspection_id:bigint unsigned?`, `created_by:bigint unsigned?`, `finalized_at:timestamp?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `based_on_inspection_id` → `vehicle_inspections.id`, `booking_id` → `bookings.id`, `created_by` → `users.id`, `vehicle_id` → `vehicles.id`.
- Unique constraints: none.
- Other indexes: `vehicle_inspections_based_on_inspection_id_foreign(based_on_inspection_id)`, `vehicle_inspections_booking_id_type_index(booking_id, type)`, `vehicle_inspections_created_by_foreign(created_by)`, `vehicle_inspections_finalized_at_index(finalized_at)`, `vehicle_inspections_status_index(status)`, `vehicle_inspections_type_index(type)`, `vehicle_inspections_vehicle_id_type_status_index(vehicle_id, type, status)`.

#### `vehicle_inspection_items`

Historical checklist answer and label. Primary key: `id`.

- Columns: `id:bigint unsigned`, `inspection_id:bigint unsigned`, `category:varchar(255)`, `item_key:varchar(255)`, `item_label:varchar(255)`, `value:tinyint(1)`, `notes:text?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `inspection_id` → `vehicle_inspections.id`.
- Unique constraints: `inspection_item_unique(inspection_id, category, item_key)`.
- Other indexes: `vehicle_inspection_items_category_index(category)`.

#### `vehicle_inspection_markers`

Body issue marker and location. Primary key: `id`.

- Columns: `id:bigint unsigned`, `inspection_id:bigint unsigned`, `sequence_number:int unsigned`, `panel:varchar(255)`, `x_position:decimal(6,3)`, `y_position:decimal(6,3)`, `issue_type:varchar(255)`, `description:text`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `inspection_id` → `vehicle_inspections.id`.
- Unique constraints: `inspection_marker_sequence_unique(inspection_id, sequence_number)`.
- Other indexes: `vehicle_inspection_markers_issue_type_index(issue_type)`, `vehicle_inspection_markers_panel_index(panel)`.

#### `vehicle_inspection_signatures`

Signer identity, time, and private file reference. Primary key: `id`.

- Columns: `id:bigint unsigned`, `inspection_id:bigint unsigned`, `signer_type:varchar(255)`, `user_id:bigint unsigned?`, `signer_name:varchar(255)`, `signature_path:varchar(255)`, `signed_at:timestamp`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `inspection_id` → `vehicle_inspections.id`, `user_id` → `users.id`.
- Unique constraints: `inspection_signer_unique(inspection_id, signer_type)`.
- Other indexes: `vehicle_inspection_signatures_signer_type_index(signer_type)`, `vehicle_inspection_signatures_user_id_foreign(user_id)`.

#### `vehicle_maintenance_plans`

Editable mileage/date maintenance reminder. Primary key: `id`.

- Columns: `id:bigint unsigned`, `vehicle_id:bigint unsigned`, `name:varchar(255)`, `category:varchar(255)`, `description:text?`, `trigger_type:varchar(255)`, `interval_km:int unsigned?`, `interval_days:int unsigned?`, `baseline_odometer:bigint unsigned?`, `baseline_date:date?`, `next_due_date:date?`, `next_due_odometer:bigint unsigned?`, `is_active:tinyint(1)`, `created_by:bigint unsigned?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `created_by` → `users.id`, `vehicle_id` → `vehicles.id`.
- Unique constraints: none.
- Other indexes: `vehicle_maintenance_plans_category_index(category)`, `vehicle_maintenance_plans_created_by_foreign(created_by)`, `vehicle_maintenance_plans_is_active_index(is_active)`, `vehicle_maintenance_plans_next_due_date_index(next_due_date)`, `vehicle_maintenance_plans_next_due_odometer_index(next_due_odometer)`, `vehicle_maintenance_plans_trigger_type_index(trigger_type)`, `vehicle_maintenance_plans_vehicle_id_is_active_index(vehicle_id, is_active)`.

#### `vehicle_maintenance_records`

Scheduled and completed service work with costs. Primary key: `id`.

- Columns: `id:bigint unsigned`, `vehicle_id:bigint unsigned`, `maintenance_plan_id:bigint unsigned?`, `category:varchar(255)`, `title:varchar(255)`, `description:text?`, `status:varchar(255)`, `scheduled_start:timestamp`, `scheduled_end:timestamp`, `actual_started_at:timestamp?`, `completed_at:timestamp?`, `cancelled_at:timestamp?`, `odometer_at_start:bigint unsigned?`, `odometer_at_completion:bigint unsigned?`, `service_provider:varchar(255)?`, `technician:varchar(255)?`, `labor_cost:decimal(12,2)?`, `parts_cost:decimal(12,2)?`, `other_cost:decimal(12,2)?`, `work_performed:text?`, `notes:text?`, `cancellation_reason:text?`, `condition_verification_required:tinyint(1)`, `completion_details_recorded_at:timestamp?`, `created_by:bigint unsigned?`, `started_by:bigint unsigned?`, `completed_by:bigint unsigned?`, `cancelled_by:bigint unsigned?`, `resulting_condition_inspection_id:bigint unsigned?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `resulting_condition_inspection_id` → `vehicle_inspections.id`, `cancelled_by` → `users.id`, `completed_by` → `users.id`, `created_by` → `users.id`, `maintenance_plan_id` → `vehicle_maintenance_plans.id`, `started_by` → `users.id`, `vehicle_id` → `vehicles.id`.
- Unique constraints: none.
- Other indexes: `maintenance_resulting_condition_fk(resulting_condition_inspection_id)`, `maintenance_vehicle_schedule(vehicle_id, scheduled_start, scheduled_end)`, `maintenance_vehicle_status_start(vehicle_id, status, scheduled_start)`, `vehicle_maintenance_records_cancelled_by_foreign(cancelled_by)`, `vehicle_maintenance_records_category_index(category)`, `vehicle_maintenance_records_completed_at_index(completed_at)`, `vehicle_maintenance_records_completed_by_foreign(completed_by)`, `vehicle_maintenance_records_created_by_foreign(created_by)`, `vehicle_maintenance_records_maintenance_plan_id_foreign(maintenance_plan_id)`, `vehicle_maintenance_records_scheduled_end_index(scheduled_end)`, `vehicle_maintenance_records_scheduled_start_index(scheduled_start)`, `vehicle_maintenance_records_started_by_foreign(started_by)`, `vehicle_maintenance_records_status_index(status)`.

#### `geofences`

Reusable circle or polygon boundary template. Primary key: `id`.

- Columns: `id:bigint unsigned`, `name:varchar(255)`, `geometry_type:varchar(16)`, `center_latitude:decimal(10,7)?`, `center_longitude:decimal(10,7)?`, `radius_meters:decimal(10,2)?`, `polygon_coordinates:json?`, `is_active:tinyint(1)`, `created_by:bigint unsigned?`, `created_at:timestamp?`, `updated_at:timestamp?`, `deleted_at:timestamp?`.
- Foreign keys: `created_by` → `users.id`.
- Unique constraints: none.
- Other indexes: `geofences_created_by_foreign(created_by)`, `geofences_is_active_index(is_active)`.

#### `booking_geofences`

One copied rental boundary snapshot per booking. Primary key: `id`.

- Columns: `id:bigint unsigned`, `booking_id:bigint unsigned`, `source_geofence_id:bigint unsigned?`, `name_snapshot:varchar(255)`, `geometry_type:varchar(16)`, `center_latitude:decimal(10,7)?`, `center_longitude:decimal(10,7)?`, `radius_meters:decimal(10,2)?`, `polygon_coordinates:json?`, `assigned_by:bigint unsigned?`, `assigned_at:timestamp`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `assigned_by` → `users.id`, `booking_id` → `bookings.id`, `source_geofence_id` → `geofences.id`.
- Unique constraints: `booking_geofences_booking_id_unique(booking_id)`.
- Other indexes: `booking_geofences_assigned_by_foreign(assigned_by)`, `booking_geofences_source_geofence_id_foreign(source_geofence_id)`.

#### `telematics_setup_sessions`

One pre-release handover workflow per self-drive booking. Primary key: `id`.

- Columns: `id:bigint unsigned`, `booking_id:bigint unsigned`, `booking_geofence_id:bigint unsigned?`, `status:varchar(24)`, `started_at:timestamp?`, `ready_at:timestamp?`, `released_at:timestamp?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `booking_geofence_id` → `booking_geofences.id`, `booking_id` → `bookings.id`.
- Unique constraints: `telematics_setup_sessions_booking_id_unique(booking_id)`.
- Other indexes: `telematics_setup_sessions_booking_geofence_id_foreign(booking_geofence_id)`, `telematics_setup_sessions_status_index(status)`.

#### `telematics_setup_steps`

Retryable, typed setup check attempts. Primary key: `id`.

- Columns: `id:bigint unsigned`, `telematics_setup_session_id:bigint unsigned`, `step_type:varchar(40)`, `attempt_number:smallint unsigned`, `status:varchar(24)`, `started_at:timestamp?`, `completed_at:timestamp?`, `failure_reason:text?`, `evidence:json?`, `actor_user_id:bigint unsigned?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `actor_user_id` → `users.id`, `telematics_setup_session_id` → `telematics_setup_sessions.id`.
- Unique constraints: `telematics_setup_step_attempt_unique(telematics_setup_session_id, step_type, attempt_number)`.
- Other indexes: `telematics_setup_steps_actor_user_id_foreign(actor_user_id)`, `telematics_setup_steps_status_index(status)`, `telematics_setup_steps_step_type_index(step_type)`.

#### `telematics_trips`

One post-release driving lifecycle per booking. Primary key: `id`.

- Columns: `id:bigint unsigned`, `booking_id:bigint unsigned`, `operator_user_id:bigint unsigned`, `status:varchar(24)`, `started_at:timestamp?`, `paused_at:timestamp?`, `resumed_at:timestamp?`, `ended_at:timestamp?`, `start_latitude:decimal(10,7)?`, `start_longitude:decimal(10,7)?`, `end_latitude:decimal(10,7)?`, `end_longitude:decimal(10,7)?`, `current_latitude:decimal(10,7)?`, `current_longitude:decimal(10,7)?`, `current_speed:decimal(8,2)?`, `battery_percent:tinyint unsigned?`, `gps_signal_percent:tinyint unsigned?`, `current_zone:varchar(120)?`, `last_location_at:timestamp?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `booking_id` → `bookings.id`, `operator_user_id` → `users.id`.
- Unique constraints: `telematics_trips_booking_id_unique(booking_id)`.
- Other indexes: `telematics_trips_operator_user_id_status_index(operator_user_id, status)`, `telematics_trips_status_index(status)`, `telematics_trips_status_location_index(status, last_location_at)`.

#### `telematics_location_points`

Timestamped active-trip GPS route points. Primary key: `id`.

- Columns: `id:bigint unsigned`, `telematics_trip_id:bigint unsigned`, `latitude:decimal(10,7)`, `longitude:decimal(10,7)`, `accuracy:decimal(8,2)?`, `speed:decimal(8,2)?`, `heading:decimal(6,2)?`, `captured_at:timestamp`, `received_at:timestamp`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `telematics_trip_id` → `telematics_trips.id`.
- Unique constraints: none.
- Other indexes: `telematics_location_trip_captured_index(telematics_trip_id, captured_at)`.

#### `telematics_events`

Significant active-trip occurrences. Primary key: `id`.

- Columns: `id:bigint unsigned`, `trip_id:bigint unsigned`, `event_type:varchar(40)`, `severity:varchar(16)`, `latitude:decimal(10,7)?`, `longitude:decimal(10,7)?`, `metadata:json?`, `occurred_at:timestamp`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `trip_id` → `telematics_trips.id`.
- Unique constraints: none.
- Other indexes: `telematics_events_event_type_index(event_type)`, `telematics_events_occurred_at_index(occurred_at)`, `telematics_events_severity_index(severity)`, `telematics_events_trip_id_foreign(trip_id)`.

#### `notifications`

Recipient-facing in-app messages and optional subject links. Primary key: `id`.

- Columns: `id:bigint unsigned`, `user_id:bigint unsigned?`, `booking_id:bigint unsigned?`, `customer_document_id:bigint unsigned?`, `type:varchar(255)`, `category:varchar(255)`, `priority:varchar(255)`, `title:varchar(255)`, `message:text`, `full_message:longtext?`, `data:json?`, `action_label:varchar(255)?`, `read_at:timestamp?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: `booking_id` → `bookings.id`, `customer_document_id` → `customer_documents.id`, `user_id` → `users.id`.
- Unique constraints: none.
- Other indexes: `notifications_booking_id_foreign(booking_id)`, `notifications_category_index(category)`, `notifications_customer_document_id_foreign(customer_document_id)`, `notifications_priority_index(priority)`, `notifications_read_at_index(read_at)`, `notifications_type_index(type)`, `notifications_user_id_read_at_index(user_id, read_at)`.

### Authorization / auditing

#### `roles`

Spatie role names and guards. Primary key: `id`.

- Columns: `id:bigint unsigned`, `name:varchar(255)`, `guard_name:varchar(255)`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: none.
- Unique constraints: `roles_name_guard_name_unique(name, guard_name)`.
- Other indexes: none.

#### `permissions`

Spatie permission names and guards. Primary key: `id`.

- Columns: `id:bigint unsigned`, `name:varchar(255)`, `guard_name:varchar(255)`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: none.
- Unique constraints: `permissions_name_guard_name_unique(name, guard_name)`.
- Other indexes: none.

#### `model_has_roles`

Polymorphic role assignment to a model. Primary key: `role_id, model_id, model_type`.

- Columns: `role_id:bigint unsigned`, `model_type:varchar(255)`, `model_id:bigint unsigned`.
- Foreign keys: `role_id` → `roles.id`.
- Unique constraints: none.
- Other indexes: `model_has_roles_model_id_model_type_index(model_id, model_type)`.

#### `model_has_permissions`

Polymorphic direct permission assignment. Primary key: `permission_id, model_id, model_type`.

- Columns: `permission_id:bigint unsigned`, `model_type:varchar(255)`, `model_id:bigint unsigned`.
- Foreign keys: `permission_id` → `permissions.id`.
- Unique constraints: none.
- Other indexes: `model_has_permissions_model_id_model_type_index(model_id, model_type)`.

#### `role_has_permissions`

Role-to-permission join. Primary key: `permission_id, role_id`.

- Columns: `permission_id:bigint unsigned`, `role_id:bigint unsigned`.
- Foreign keys: `permission_id` → `permissions.id`, `role_id` → `roles.id`.
- Unique constraints: none.
- Other indexes: `role_has_permissions_role_id_foreign(role_id)`.

#### `activity_log`

Polymorphic activity audit events. Primary key: `id`.

- Columns: `id:bigint unsigned`, `log_name:varchar(255)?`, `description:text`, `subject_type:varchar(255)?`, `subject_id:bigint unsigned?`, `event:varchar(255)?`, `causer_type:varchar(255)?`, `causer_id:bigint unsigned?`, `attribute_changes:json?`, `properties:json?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: none.
- Unique constraints: none.
- Other indexes: `activity_log_log_name_index(log_name)`, `causer(causer_type, causer_id)`, `subject(subject_type, subject_id)`.

### Laravel / infrastructure

#### `migrations`

Applied migration ledger. Primary key: `id`.

- Columns: `id:int unsigned`, `migration:varchar(255)`, `batch:int`.
- Foreign keys: none.
- Unique constraints: none.
- Other indexes: none.

#### `cache`

Cached key/value entries. Primary key: `key`.

- Columns: `key:varchar(255)`, `value:mediumtext`, `expiration:bigint`.
- Foreign keys: none.
- Unique constraints: none.
- Other indexes: `cache_expiration_index(expiration)`.

#### `cache_locks`

Cache lock entries. Primary key: `key`.

- Columns: `key:varchar(255)`, `owner:varchar(255)`, `expiration:bigint`.
- Foreign keys: none.
- Unique constraints: none.
- Other indexes: `cache_locks_expiration_index(expiration)`.

#### `jobs`

Queued jobs. Primary key: `id`.

- Columns: `id:bigint unsigned`, `queue:varchar(255)`, `payload:longtext`, `attempts:smallint unsigned`, `reserved_at:int unsigned?`, `available_at:int unsigned`, `created_at:int unsigned`.
- Foreign keys: none.
- Unique constraints: none.
- Other indexes: `jobs_queue_index(queue)`.

#### `job_batches`

Queued job batch state. Primary key: `id`.

- Columns: `id:varchar(255)`, `name:varchar(255)`, `total_jobs:int`, `pending_jobs:int`, `failed_jobs:int`, `failed_job_ids:longtext`, `options:mediumtext?`, `cancelled_at:int?`, `created_at:int`, `finished_at:int?`.
- Foreign keys: none.
- Unique constraints: none.
- Other indexes: none.

#### `failed_jobs`

Failed queue job records. Primary key: `id`.

- Columns: `id:bigint unsigned`, `uuid:varchar(255)`, `connection:varchar(255)`, `queue:varchar(255)`, `payload:longtext`, `exception:longtext`, `failed_at:timestamp`.
- Foreign keys: none.
- Unique constraints: `failed_jobs_uuid_unique(uuid)`.
- Other indexes: `failed_jobs_connection_queue_failed_at_index(connection, queue, failed_at)`.

#### `sessions`

Web session records. Primary key: `id`.

- Columns: `id:varchar(255)`, `user_id:bigint unsigned?`, `ip_address:varchar(45)?`, `user_agent:text?`, `payload:longtext`, `last_activity:int`.
- Foreign keys: none.
- Unique constraints: none.
- Other indexes: `sessions_last_activity_index(last_activity)`, `sessions_user_id_index(user_id)`.

#### `personal_access_tokens`

Sanctum polymorphic mobile bearer tokens. Primary key: `id`.

- Columns: `id:bigint unsigned`, `tokenable_type:varchar(255)`, `tokenable_id:bigint unsigned`, `name:text`, `token:varchar(64)`, `abilities:text?`, `last_used_at:timestamp?`, `expires_at:timestamp?`, `created_at:timestamp?`, `updated_at:timestamp?`.
- Foreign keys: none.
- Unique constraints: `personal_access_tokens_token_unique(token)`.
- Other indexes: `personal_access_tokens_expires_at_index(expires_at)`, `personal_access_tokens_tokenable_type_tokenable_id_index(tokenable_type, tokenable_id)`.

#### `password_reset_tokens`

Password reset token records. Primary key: `email`.

- Columns: `email:varchar(255)`, `token:varchar(255)`, `created_at:timestamp?`.
- Foreign keys: none.
- Unique constraints: none.
- Other indexes: none.

## Complete foreign-key register

Each row is a live MySQL constraint. `NO ACTION` is the reported update rule for every FK. Nullable columns can lose attribution when a referenced record is physically removed.

| Child column | Parent column | On delete | On update |
| --- | --- | --- | --- |
| `booking_additional_charges.booking_id` | `bookings.id` | CASCADE | NO ACTION |
| `booking_additional_charges.created_by` | `users.id` | SET NULL | NO ACTION |
| `booking_additional_charges.responsible_user_id` | `users.id` | RESTRICT | NO ACTION |
| `booking_assignments.booking_id` | `bookings.id` | CASCADE | NO ACTION |
| `booking_assignments.driver_id` | `users.id` | SET NULL | NO ACTION |
| `booking_confirmation_emails.booking_id` | `bookings.id` | CASCADE | NO ACTION |
| `booking_events.actor_user_id` | `users.id` | SET NULL | NO ACTION |
| `booking_events.booking_id` | `bookings.id` | CASCADE | NO ACTION |
| `booking_geofences.assigned_by` | `users.id` | SET NULL | NO ACTION |
| `booking_geofences.booking_id` | `bookings.id` | CASCADE | NO ACTION |
| `booking_geofences.source_geofence_id` | `geofences.id` | SET NULL | NO ACTION |
| `booking_terms.booking_id` | `bookings.id` | CASCADE | NO ACTION |
| `bookings.user_id` | `users.id` | CASCADE | NO ACTION |
| `bookings.vehicle_id` | `vehicles.id` | RESTRICT | NO ACTION |
| `customer_document_files.customer_document_id` | `customer_documents.id` | CASCADE | NO ACTION |
| `customer_documents.reviewed_by` | `users.id` | SET NULL | NO ACTION |
| `customer_documents.user_id` | `users.id` | CASCADE | NO ACTION |
| `customer_profiles.user_id` | `users.id` | CASCADE | NO ACTION |
| `emergency_contacts.user_id` | `users.id` | CASCADE | NO ACTION |
| `geofences.created_by` | `users.id` | SET NULL | NO ACTION |
| `model_has_permissions.permission_id` | `permissions.id` | CASCADE | NO ACTION |
| `model_has_roles.role_id` | `roles.id` | CASCADE | NO ACTION |
| `notifications.booking_id` | `bookings.id` | SET NULL | NO ACTION |
| `notifications.customer_document_id` | `customer_documents.id` | SET NULL | NO ACTION |
| `notifications.user_id` | `users.id` | CASCADE | NO ACTION |
| `payment_charge_allocations.booking_additional_charge_id` | `booking_additional_charges.id` | CASCADE | NO ACTION |
| `payment_charge_allocations.payment_id` | `payments.id` | CASCADE | NO ACTION |
| `payments.booking_id` | `bookings.id` | CASCADE | NO ACTION |
| `payments.user_id` | `users.id` | RESTRICT | NO ACTION |
| `role_has_permissions.permission_id` | `permissions.id` | CASCADE | NO ACTION |
| `role_has_permissions.role_id` | `roles.id` | CASCADE | NO ACTION |
| `telematics_events.trip_id` | `telematics_trips.id` | CASCADE | NO ACTION |
| `telematics_location_points.telematics_trip_id` | `telematics_trips.id` | CASCADE | NO ACTION |
| `telematics_setup_sessions.booking_geofence_id` | `booking_geofences.id` | SET NULL | NO ACTION |
| `telematics_setup_sessions.booking_id` | `bookings.id` | CASCADE | NO ACTION |
| `telematics_setup_steps.actor_user_id` | `users.id` | SET NULL | NO ACTION |
| `telematics_setup_steps.telematics_setup_session_id` | `telematics_setup_sessions.id` | CASCADE | NO ACTION |
| `telematics_trips.booking_id` | `bookings.id` | CASCADE | NO ACTION |
| `telematics_trips.operator_user_id` | `users.id` | RESTRICT | NO ACTION |
| `vehicle_features.vehicle_id` | `vehicles.id` | CASCADE | NO ACTION |
| `vehicle_images.vehicle_id` | `vehicles.id` | CASCADE | NO ACTION |
| `vehicle_inspection_items.inspection_id` | `vehicle_inspections.id` | CASCADE | NO ACTION |
| `vehicle_inspection_markers.inspection_id` | `vehicle_inspections.id` | CASCADE | NO ACTION |
| `vehicle_inspection_signatures.inspection_id` | `vehicle_inspections.id` | CASCADE | NO ACTION |
| `vehicle_inspection_signatures.user_id` | `users.id` | SET NULL | NO ACTION |
| `vehicle_inspections.based_on_inspection_id` | `vehicle_inspections.id` | SET NULL | NO ACTION |
| `vehicle_inspections.booking_id` | `bookings.id` | SET NULL | NO ACTION |
| `vehicle_inspections.created_by` | `users.id` | SET NULL | NO ACTION |
| `vehicle_inspections.vehicle_id` | `vehicles.id` | RESTRICT | NO ACTION |
| `vehicle_maintenance_plans.created_by` | `users.id` | SET NULL | NO ACTION |
| `vehicle_maintenance_plans.vehicle_id` | `vehicles.id` | RESTRICT | NO ACTION |
| `vehicle_maintenance_records.resulting_condition_inspection_id` | `vehicle_inspections.id` | SET NULL | NO ACTION |
| `vehicle_maintenance_records.cancelled_by` | `users.id` | SET NULL | NO ACTION |
| `vehicle_maintenance_records.completed_by` | `users.id` | SET NULL | NO ACTION |
| `vehicle_maintenance_records.created_by` | `users.id` | SET NULL | NO ACTION |
| `vehicle_maintenance_records.maintenance_plan_id` | `vehicle_maintenance_plans.id` | SET NULL | NO ACTION |
| `vehicle_maintenance_records.started_by` | `users.id` | SET NULL | NO ACTION |
| `vehicle_maintenance_records.vehicle_id` | `vehicles.id` | RESTRICT | NO ACTION |
| `vehicles.current_condition_inspection_id` | `vehicle_inspections.id` | SET NULL | NO ACTION |

## Historical core domain findings (2026-09-26/28 baseline)

### Booking and driver assignment

`users.id` → `bookings.user_id` and `vehicles.id` → `bookings.vehicle_id` give one renter and one vehicle per booking; each can have many bookings. `bookings.booking_code` is unique. `booking_assignments.booking_id` is unique, so there is at most one **current** assignment per booking; `driver_id` is nullable. Reassignment updates that row and emits activity/notification records, so assignment history is not a separate relational series. The live table contains only `booking_id`, `driver_id`, `assigned_at`, and timestamps—no calibration fields. `booking_events` stores multiple status/milestone rows. A booking may have many inspections in SQL; service code permits one outgoing and one incoming per booking, but no `(booking_id,type)` unique constraint enforces that at the database level.

### Payments and charges

`payments.booking_id` is nonunique: one booking can have many payments. `payments.user_id` identifies the paying account. Manual and PayPal rows share the table; `PayPalCheckout` is a scoped `Payment` subclass. Provider order and transaction IDs each have nullable unique indexes. `booking_additional_charges` has a required responsible user, a charge type, responsibility, and amount. `payment_charge_allocations` has a composite primary key `(payment_id, booking_additional_charge_id)` plus allocation amount, forming a many-to-many settlement relation. Charge payment status and paid time are calculated from completed allocations. `bookings.status` and `bookings.payment_status` are separate persisted states; `bookings.remaining_balance` is a deliberate payment projection.

### Vehicle condition and inspections

`vehicles.current_condition_inspection_id` is a nullable pointer to the accepted current snapshot. `vehicle_inspections` has required vehicle FK, nullable booking FK, and nullable `based_on_inspection_id` self-FK. Types are `initial`, `condition_update`, `outgoing`, `incoming`; statuses are `draft` and `finalized`. Fuel and odometer live on the inspection row. Checklist answers/labels, damage markers, and signer metadata/path are child rows. Their unique constraints are per inspection/category/item, inspection/marker sequence, and inspection/signer type. No inspection-photo table exists; vehicle catalog images have path rows and signatures live as private file paths. Model hooks protect finalized snapshots and children from normal Eloquent update/delete, while SQL FK cascades do not honor those hooks.

### Document verification

Documents belong directly to `users`, not profiles or bookings. `(user_id,document_type)` is unique. A document stores type, status, document number/expiry, submission time, optional reviewer user, review time, and rejection reason. File paths are child `customer_document_files` rows keyed uniquely by `(customer_document_id,role)`; the document model also exposes virtual legacy file-path accessors. User/profile self-drive eligibility is a derived workflow projection from document decisions.

### Maintenance

Plans and work records both belong to a vehicle. A record may reference a plan, so custom maintenance is supported. Plans carry mileage/date trigger and interval/next-due fields. Records carry scheduled and actual times, status, provider/work/cost fields, and an optional resulting-condition inspection. The service computes total cost rather than storing it and keeps a record active until condition verification when required. Booking and maintenance availability checks are service rules; the ERD represents persisted relationships, not a direct FK between maintenance and booking.

### Geofences and polygon support

`geofences` is the reusable template table. `booking_geofences` has a unique `booking_id`, nullable source-template FK, and copied name/geometry; **one booking currently has at most one zone**. A template can source many snapshots. Both tables have `geometry_type` (`circle` or `polygon` in service validation), nullable circle center/radius columns, and `polygon_coordinates` JSON arrays of latitude/longitude point objects. There is no polygon-vertex table, GeoJSON column, purpose/category column, multiple-zone join, or expressway/corridor table. The snapshot model blocks updates and the assignment service refuses a second snapshot. The model has no deletion guard; there is no snapshot deletion route in the current management API. The template can change without changing an existing snapshot; used templates are protected from service-level deletion.

### Telematics setup and active trip

`telematics_setup_sessions.booking_id` is unique, giving zero or one session per booking. The optional `booking_geofence_id` selects its copied boundary. A session has many step rows; `(telematics_setup_session_id,step_type,attempt_number)` is unique, so retries remain separate rows. Seven native-readiness types are operational in the mobile screen; five calibration types exist in the enum/schema contract but have no implemented calibration capture. `telematics_trips.booking_id` is unique, giving at most one post-release trip per booking. Trip status is `started`, `paused`, or `ended`; pause/resume/end timestamps live on the same row. Each trip has many `telematics_location_points` and many `telematics_events`. Location points keep captured and received times; trip current coordinates and speed are a latest-state cache. Events have type, severity, optional position, metadata JSON, and occurrence time. Trip API endpoints exist, but the current mobile flow does not launch or stream an active trip.

### Authorization and audit

Spatie roles and permissions use composite uniqueness for `(name,guard_name)`. `model_has_roles` and `model_has_permissions` have polymorphic model references without user FKs. `activity_log.subject_*` and `causer_*` are polymorphic and likewise have no SQL FKs. `personal_access_tokens.tokenable_*` is Sanctum polymorphism. These are intentional non-FK relationships; do not draw them as if MySQL enforces `users.id` references.

The `UserRole` PHP enum names admin, staff, and customer; the role seeder additionally creates a driver role. There is no dedicated owner role in the current role seed. Roles are rows in `roles` linked through Spatie's polymorphic assignment tables, not separate user tables.

## Historical model and schema alignment (2026-09-26/28 baseline)

- `Booking::telematicsTrips()` is declared `hasMany`, but `telematics_trips.booking_id` is unique. The physical ERD correctly shows zero-or-one trip. This is an API/model cardinality mismatch, not evidence that multiple trips are allowed.
- `User::emergencyContacts()` is declared `hasMany`, but `emergency_contacts.user_id` is unique. The physical ERD shows zero-or-one contact.
- `Booking::statusLogs()` is a deprecated filtered alias over `booking_events`; there is no current `booking_status_logs` table.
- `Booking` and `CustomerDocument` expose several virtual compatibility attributes that persist through related tables. Their fillable lists are not evidence that those attributes remain physical columns.
- No important single-table FK was found without a corresponding child-side Eloquent relation among the audited business models. Inverse relations are not uniformly defined, which does not alter database cardinality. Pivot tables and polymorphic relations intentionally have no dedicated JamJade model for every table.

## Historical high-volume indexes and access paths (2026-09-26/28 baseline)

| Table | Current relevant indexes | Assessment |
| --- | --- | --- |
| `telematics_location_points` | `(telematics_trip_id,captured_at)` | Correct route-history access path; `received_at` has no separate index, which matters only if ingestion-lag queries are added. |
| `telematics_events` | `trip_id`, `event_type`, `severity`, `occurred_at` | Individual indexes exist; a `(trip_id,occurred_at)` index may help ordered per-trip timelines once event volume grows. |
| `activity_log` | `(subject_type,subject_id)`, `(causer_type,causer_id)`, `log_name` | No `created_at` index; consider only after measuring time-ordered audit queries. |
| `payments` | `(booking_id,status)`, `(user_id,status)`, `(provider,status)`, unique provider references | Transaction lookup is covered; no `created_at` index for global time-range reporting. |
| `vehicle_inspection_items` / `markers` / `signatures` | unique inspection-scoped keys | FK-leading unique indexes support fetching children by inspection. No database-backed inspection-photo table. |

## Historical normalization and legacy review (2026-09-26/28 baseline)

The current shape generally keeps independent facts in separate relations: one payment table, allocation pivot, child document files, child inspection evidence, and separate setup attempts/trip points/events. `bookings.payment_status`, `remaining_balance`, and quote totals are intentional stored projections/snapshots. Trip latest location is an intentional cache over point history. JSON is used for bounded polygon vertices, provider responses, setup evidence, event metadata, and notification data; there is no raw sensor stream hidden in JSON in the audited schema.

`customer_profiles.address` coexists with structured address columns and is returned as a formatted address. The update service accepts these fields independently, so the free-text and structured values can diverge; this is a meaningful duplicated-address risk. Cross-parent identity is not enforced for `telematics_setup_sessions.booking_geofence_id`, `vehicles.current_condition_inspection_id`, `vehicle_maintenance_records.resulting_condition_inspection_id`, or a payment/charge allocation: FKs prove each row exists but not that both rows belong to the same booking or vehicle. Services generally check intended relationships; consider DB-level checks only if a concrete failure mode appears.

Removed prototype storage is absent from the live schema: `paypal_checkouts`, `additional_charge_paypal_checkout`, `booking_status_logs`, `geofence_logs`, booking/assignment calibration columns, `telematics_trips.allowed_zone`, raw accelerometer/gyroscope axes, and old event-geofence fields. Old migrations still contain some of those columns as migration history; they are not current tables or columns. No AI/ML table exists.

The older `docs/ERD-relationships.md` is a supplementary relationship guide. It omits the location-point relationship and the authorization/audit inventory, so it should not be treated as the complete physical ERD. No contradictory FK or cardinality statement was found in that guide.

## Historical status and type representation (2026-09-26/28 baseline)

MySQL stores the reviewed domain statuses/types as `VARCHAR` fields, not SQL `ENUM` or `CHECK` constraints. PHP backed enums are used for booking status, booking payment status, rental type, document status, vehicle status, inspection type/status/signer, maintenance trigger/category/record status, setup status/step type/step status, charge type/responsibility, and telematics event type. Trip status and geofence geometry type are constrained by service logic/string values, not PHP enum casts in their models. `payments.status` uses provider-record values such as `pending` and `completed`; its `PaymentStatus` accessor maps these to domain labels, so it is not the same representation as `bookings.payment_status`. Due status is calculated, not stored.

| Stored column | Code representation | Values / distinction |
| --- | --- | --- |
| `bookings.status` | `BookingStatus` PHP enum → varchar | `pending`, `confirmed`, `rejected`, `ongoing`, `returned`, `completed`, `cancelled` |
| `bookings.payment_status` | `PaymentStatus` PHP enum → varchar | `unpaid`, `pending`, `partial`, `paid`, `failed`, `refunded`; booking-level projection |
| `bookings.rental_type` | `RentalType` PHP enum → varchar | `self_drive`, `owners_driver` |
| `payments.status` | Provider-record varchar; mapped by `Payment` accessor | `pending`, `completed`, `failed`, `refunded` in current service paths; separate from booking payment status |
| `customer_documents.status` | `DocumentStatus` PHP enum → varchar | `pending`, `approved`, `rejected` |
| `customer_profiles.verification_status` | Service-controlled varchar | Profile/self-drive readiness projection; separate from each document review status |
| `vehicles.status` | `VehicleStatus` PHP enum → varchar | `available`, `rented`, `maintenance`, `unavailable` |
| `vehicle_inspections.type` / `.status` | `VehicleInspectionType` / `VehicleInspectionStatus` PHP enums → varchar | `initial`, `condition_update`, `outgoing`, `incoming` / `draft`, `finalized` |
| `vehicle_inspection_signatures.signer_type` | `VehicleInspectionSignerType` PHP enum → varchar | `personnel`, `renter`, `driver` |
| `vehicle_maintenance_plans.trigger_type` / `vehicle_maintenance_records.status` | `MaintenanceTriggerType` / `MaintenanceRecordStatus` PHP enums → varchar | `mileage`, `date`, `both` / `scheduled`, `in_progress`, `completed`, `cancelled` |
| `telematics_setup_sessions.status` | `TelematicsSetupStatus` PHP enum → varchar | `locked`, `setup_required`, `in_progress`, `ready_for_release`, `released` |
| `telematics_setup_steps.step_type` / `.status` | `TelematicsSetupStepType` / `TelematicsSetupStepStatus` PHP enums → varchar | Seven implemented readiness types plus five calibration types in the enum / `pending`, `in_progress`, `passed`, `failed` |
| `telematics_trips.status` | Service-controlled varchar | `started`, `paused`, `ended` |
| `telematics_events.event_type` | `TelematicsEventType` PHP enum → varchar | Lifecycle, geofence, interruption, and harsh-motion names exist in code; enum membership does not mean automated detection is live |
| `geofences.geometry_type` / `booking_geofences.geometry_type` | Validated varchar | `circle`, `polygon` |
| `booking_additional_charges.type` / `.responsibility` | `AdditionalChargeType` / `AdditionalChargeResponsibility` PHP enums → varchar | Charge category / `customer`, `driver` |

The 12 setup step types are `device_check`, `motion_permission`, `location_permission`, `background_location`, `gps_check`, `geofence_check`, `phone_mount`, `stationary_calibration`, `forward_calibration`, `braking_calibration`, `left_turn_calibration`, and `right_turn_calibration`. The last five are schema/type capacity only in the current mobile flow. The event enum declares `trip_started`, `trip_paused`, `trip_resumed`, `trip_ended`, `geofence_enter`, `geofence_exit`, `gps_unavailable`, `location_permission_revoked`, `device_orientation_changed`, `telemetry_interrupted`, `harsh_acceleration`, `harsh_braking`, `harsh_left_turn`, and `harsh_right_turn`; the enum does not establish that any automatic classifier exists.

## Historical migration health and baseline decision

The live migration ledger contains **36 applied migrations**, with no pending repository migrations at audit time. Later migrations replace or remove earlier development schema: the August normalization drops/recreates payments and telematics tables; the September booking split replaces status logs and moves assignment/terms/email details; the telematics foundation removes old calibration and sensor fields; the polygon migration adds shape/JSON columns. The normalization and booking-split migrations have intentionally irreversible `down()` methods. This history is suitable to document now, but not yet a production-grade upgrade path for unknown persisted environments.

A schema baseline/dump would be useful **after** the remaining approved telematics schema work and retention decisions are complete, with a verified fresh-install and upgrade strategy. Do not squash or re-run destructive migration history against valuable data as part of this audit.

### Applied migration ledger

All 36 migration files below appear in the live ledger; pending: **none**.

| Migration | Batch |
| --- | --- |
| `0001_01_01_000000_create_users_table` | 1 |
| `0001_01_01_000001_create_cache_table` | 1 |
| `0001_01_01_000002_create_jobs_table` | 1 |
| `2026_05_29_031530_create_activity_log_table` | 1 |
| `2026_05_29_031530_create_permission_tables` | 1 |
| `2026_05_29_031530_create_personal_access_tokens_table` | 1 |
| `2026_05_29_031600_add_jamjade_fields_to_users_table` | 1 |
| `2026_05_29_031610_create_customer_profile_tables` | 1 |
| `2026_05_29_031620_create_vehicle_tables` | 1 |
| `2026_05_29_031630_create_booking_and_payment_tables` | 1 |
| `2026_05_29_031640_create_document_tables` | 1 |
| `2026_05_29_031650_create_telematics_tables` | 1 |
| `2026_05_29_031660_create_notifications_table` | 1 |
| `2026_06_02_000001_remove_inventory_columns_from_vehicles_table` | 1 |
| `2026_06_02_000002_rename_inactive_vehicle_status_to_unavailable` | 1 |
| `2026_06_07_000001_align_mobile_customer_data` | 1 |
| `2026_06_09_000001_create_paypal_checkouts_table` | 1 |
| `2026_06_09_000002_add_balance_deadlines_to_bookings_table` | 1 |
| `2026_06_10_000001_add_delivery_time_to_bookings_table` | 1 |
| `2026_06_10_000002_link_document_notifications` | 1 |
| `2026_06_10_000003_add_confirmation_email_tracking_to_bookings_table` | 1 |
| `2026_08_10_000001_create_vehicle_inspection_tables` | 1 |
| `2026_08_10_000002_add_current_condition_inspection_id_to_vehicles` | 1 |
| `2026_08_10_000003_add_condition_update_fields_to_vehicle_inspections` | 1 |
| `2026_08_14_000001_create_vehicle_maintenance_tables` | 1 |
| `2026_08_16_000001_refine_vehicle_maintenance_workflow` | 1 |
| `2026_08_18_000001_rename_admin_management_permission` | 1 |
| `2026_08_19_000001_add_driver_assignment_to_bookings_table` | 1 |
| `2026_08_22_000001_add_rental_lifecycle_to_bookings` | 1 |
| `2026_08_23_000001_add_plate_number_to_vehicles_table` | 1 |
| `2026_08_29_000001_rename_user_roles` | 1 |
| `2026_08_31_000001_normalize_core_data_model` | 1 |
| `2026_09_01_000001_split_booking_concerns` | 1 |
| `2026_09_17_000001_create_telematics_foundation_tables` | 1 |
| `2026_09_18_000001_add_structured_address_to_customer_profiles` | 2 |
| `2026_09_23_000001_add_geofence_shapes_and_soft_deletes` | 3 |

## Historical issue register (2026-09-26/28 baseline)

The issue rows below belong to the historical single-zone baseline. The current monitoring-zone contract supersedes the old one-zone cardinality and setup-FK rows; use the source-reviewed delta and [geofence monitoring](geofence-monitoring.md) for current behavior.

| Severity | Table / domain | Issue | Why it matters | Recommended future action |
| --- | --- | --- | --- | --- |
| Critical | `users` → `bookings` and children | Hard-deleting a user cascades to bookings; booking deletion cascades to payments, charges, events, geofence snapshot, setup, trip, points, and events. | Rental and financial history can disappear if a destructive delete path is introduced or used. A direct payment/user `RESTRICT` may block some deletes but does not provide a complete retention policy. | Decide retention/anonymization rules, then design a staged FK migration and deletion tests. Until then, deactivate accounts with history. |
| Important | `vehicle_inspections.booking_id` | `SET NULL` preserves inspection rows after booking hard deletion but loses rental attribution. | Evidence may become detached from its booking even when vehicle condition remains. | Resolve together with booking retention policy; do not patch only this FK. |
| Important | `booking_assignments.driver_id`; `customer_documents.reviewed_by`; inspection/user audit FKs | Staff/driver deletion sets actor references null in several historical records. | Attribution is weakened; driver assignment row no longer identifies the historical driver. | Prefer deactivation and decide which actor references must be retained/anonymized before FK changes. |
| Important | `booking_geofences.source_geofence_id` | Hard-deletion would clear template provenance, though copied geometry remains. | Historical boundary shape survives, but its template lineage is lost. | Keep soft-deletion/service guard and define a hard-delete policy before schema freeze. |
| Important | `booking_geofences` | The model blocks updates but does not block deletes; no current API exposes deletion. | A future model delete or direct SQL could remove the historical snapshot and permit replacement. | Add deletion protection only after agreeing on archival and correction rules. |
| Important | `Booking::telematicsTrips`, `User::emergencyContacts` | Model `hasMany` declarations disagree with unique FKs. | Code may suggest impossible cardinality and lead to incorrect query/API assumptions. | Align model relations in a separately approved code change. |
| Important | `booking_geofences`, `vehicle_inspections`, setup/maintenance cross-links | FKs do not enforce matching booking/vehicle across two parent references. | Direct SQL or a future bypass of services could create semantically crossed links. | Keep transactional service checks; consider targeted constraints or integrity tests where feasible. |
| Cleanup | `vehicle_inspections` | No unique `(booking_id,type)` despite service rule of one outgoing/incoming each. | SQL permits duplicates if writes bypass the locked service. | Evaluate a constraint strategy that still allows multiple standalone/current updates. |
| Cleanup | `customer_profiles` | Free-text `address` and structured address columns can be updated independently. | Two representations of the same address may disagree in API responses or reports. | Define one canonical address input and derive/synchronize the formatted value in a separate change. |
| Cleanup | high-volume indexes | No combined event `(trip_id,occurred_at)` or general `created_at` index on activity/payments. | Ordered timelines/range reports may slow at scale; current single-column indexes may suffice now. | Measure actual queries and volume before adding indexes. |
| Informational | migration history | Development normalization migrations rebuild tables and have irreversible downs. | Fresh installs and real data upgrades need different assurances. | Baseline later; separately plan data-copy/reconciliation for any existing non-disposable deployment. |
| Informational | status fields | Most statuses are varchar validated in PHP; payment row status differs from booking payment projection. | A diagram can easily suggest an incorrect shared enum. | Keep distinction explicit in docs and tests. |

## Source and validation notes

Sources for the dated snapshot were the 36 migrations then present, live MySQL `information_schema` table/column/index/FK metadata and migration ledger, Eloquent models and enum casts, booking/inspection/payment/maintenance/geofence/telematics services, and supporting domain docs. The source-reviewed delta additionally used all 40 repository migrations plus the affected current models/services. The historical canonical ERD was generated from the dated live table/FK facts; its business entity set and physical FK relationships are cross-checked against the 45-table/59-FK snapshot. Infrastructure is inventoried but excluded from the business diagrams. No schema or application file was modified.
