# Vehicle configuration

Vehicle Management → Configure is an Admin-only shared option library. Its seven cards are Brands, Features, Transmissions, Fuel Types, Exterior Checklist, Interior Checklist, and Equipment / Tools. Each card opens its own option list directly. Checklist items stay within the three fixed inspection groups. Status values, body panels, issue types, fuel-level scale, and individual vehicle fields remain outside this library.

## Management contract

All endpoints use the existing management session and CSRF flow.

- GET /admin/vehicle-options: active catalog names, current checklist definitions, and checklist_version; available to Admin or authorized vehicle, booking, or maintenance personnel.
- GET /admin/vehicle-configuration: option records, active state, and whether an option has been used; Admin only.
- POST /admin/vehicle-configuration: section, trimmed name, and is_active; Admin only.
- PUT /admin/vehicle-configuration/{option}: name and is_active; Admin only. Section and stable key cannot be changed.
- DELETE /admin/vehicle-configuration/{option}: delete an unused option or deactivate a used option; Admin only.

Names are unique within a section without regard to case. Brand names allow 80 characters, transmission/fuel names 40, and features/checklist items 120. Dashcam remains excluded. At least one active option must remain in each section. Each option shows an Active or Inactive badge beside its row menu. The menu offers Deactivate for active options and Activate for inactive ones, using the existing PUT contract. Unused options also have a separate Delete action; Edit still supports changing the name and active state.

The additive migration seeds existing defaults and imports distinct existing fleet values, including values on soft-deleted vehicles. It does not rewrite vehicles, features, or inspections. Shared selection replaces the former form-local feature add/remove controls.

## Existing vehicle values

Vehicles and public/mobile resources retain their established string fields and feature arrays. Renaming a library option changes future choices, not already saved vehicles. Previous catalog names are retained internally only to identify usage and prevent another option from claiming the same historical value.

An existing vehicle may retain its own retired brand, transmission, fuel type, or features while editing. A new vehicle or another vehicle cannot newly select those retired values. Laravel validates these rules again inside the vehicle transaction. Mobile catalog display and filters continue reading the saved vehicle values; management configuration and private inspection information are not exposed through mobile resources.

## Inspection templates and history

VehicleInspectionDefinition::checklist() reads active database definitions. Each checklist item has a stable key, while finalized inspection items retain their own key, label, category, and response. Configuration changes do not modify finalized snapshots.

Every initial, standalone, outgoing, incoming, or maintenance-completion inspection submission carries checklist_version, a SHA-256 fingerprint of the active definitions. Laravel rejects stale versions, missing/extra items, and unanswered values. Services repeat the version and response checks under the configuration lock before persistence. Configuration writes and relevant vehicle/inspection writes share this lock.

New initial inspections start with the current checklist. When a later inspection is prepared from a baseline, existing answers are carried forward for matching active keys and unchanged labels. Newly introduced or renamed items require an explicit Yes or No. Removed items stay in the old snapshot and are omitted from the new template. Reloading a changed checklist preserves other form fields and matching answers, introduces new unanswered items, and clears the personnel signature for review.

The web form keeps the definition it loaded alongside its answers so labels do not change underneath an open inspection. This local definition is not submitted as authoritative metadata. The service layer sends only the version and typed condition data; Laravel owns the accepted keys and snapshot labels.

## Verification

Regression tests cover Admin/Staff boundaries, all seven option sections, duplicate/length validation, excluded features, rename/deactivation history, retained vehicle values, direct service validation, the last-active-option rule, stale/missing/unanswered checklist responses, and immutable labels. Existing inspection and rental lifecycle tests remain applicable. Browser checks use temporary options and do not create or finalize real vehicle inspections.
