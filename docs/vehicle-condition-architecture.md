# Vehicle Condition Architecture

## Purpose

Vehicle condition is auditable snapshot data, not mutable vehicle-master data. A vehicle points to the finalized inspection that represents its accepted current condition. Finalized snapshots remain historical evidence when later booking inspections change that pointer.

The implemented current-condition lifecycle is:

```text
Vehicle created
  -> Initial inspection finalized
  -> Current condition`
  -> Standalone condition update (copied from current)
  -> Condition update finalized and assigned as current
  -> Previous current snapshot remains immutable history
  -> Booking outgoing inspection (copied from current)
  -> Rental
  -> Booking incoming inspection (copied from outgoing)
  -> Incoming finalized and assigned as current
  -> Next booking outgoing inspection
```

The same snapshot architecture now supports booking Outgoing and Incoming inspections. Additional charges remain separate responsibility-aware financial records; inspection differences never determine fault or price automatically.

## Database relationships

- `vehicles.current_condition_inspection_id` is nullable for legacy vehicles and references the currently accepted finalized snapshot.
- `vehicle_inspections` belongs to a vehicle and optionally a booking. `type` supports `initial`, `condition_update`, `outgoing`, and `incoming`; `status` supports `draft` and `finalized`.
- `vehicle_inspections.based_on_inspection_id` preserves Current → Outgoing → Incoming lineage.
- Standalone condition updates store a controlled `condition_update_reason` and optional `condition_update_notes`. Their `booking_id` is always null and `based_on_inspection_id` identifies the prior accepted current snapshot.
- `vehicle_inspection_items` stores checklist records by category/key instead of adding one column per item. `item_label` preserves the wording used by that historical snapshot.
- `vehicle_inspection_markers` stores one body issue per record with a global sequence number.
- `vehicle_inspection_signatures` stores signer metadata and a private storage reference. Signature paths and bytes are never returned by vehicle resources.

Finalized inspection records and their items, markers, and signatures are protected from model-level update/delete operations. No generic inspection update endpoint exists.

## Initial-condition transaction

New vehicle creation is one transaction:

1. Validate vehicle and nested condition data.
2. Store the personnel signature on the private `local` disk.
3. Create vehicle, images, and features.
4. Create the draft Initial inspection and all checklist, marker, and signature records.
5. Finalize the inspection with server time.
6. Assign it to `vehicles.current_condition_inspection_id`.
7. Record activity events and commit.

Newly stored vehicle images and the private signature are deleted if the transaction fails. The authenticated management user supplies signer identity; the client does not supply the signer or signed timestamp.

Legacy vehicles retain a null current-condition pointer after migration. Authorized users can use **Set Initial Condition** in Vehicle Details. The same reusable condition form creates one finalized Initial snapshot without recreating the vehicle.

## Standalone current-condition update

Authorized personnel can use **Update Current Condition** from Vehicle Details after an initial/current snapshot exists. The workflow is separate from vehicle-master editing and booking Outgoing/Incoming inspections:

1. Lock the vehicle and confirm that it has no `ongoing` booking.
2. Load the finalized snapshot referenced by `vehicles.current_condition_inspection_id`.
3. Create a draft `condition_update` snapshot with `booking_id = null` and `based_on_inspection_id` pointing to that current snapshot.
4. Copy the accepted condition into the draft, apply the newly verified odometer, fuel, checklist, markers, and comments, and record the controlled reason and notes.
5. Store a new personnel signature using the authenticated user and server time.
6. Finalize the new snapshot and atomically move `vehicles.current_condition_inspection_id` to it.
7. Preserve the prior snapshot and its child records unchanged in history.

Allowed update reasons are correction/reinspection, maintenance completed, repair completed, refueling/servicing, issue discovered, company use, and other. Notes are required for **Other**. Odometer readings normally cannot decrease. A lower value is accepted only for **Correction / Reinspection** with explicit explanatory notes; this is validated both before the service call and again while the vehicle is locked.

The new signature is written to private storage before the database transaction. If validation or persistence fails, the database transaction rolls back, the current pointer remains unchanged, and only that newly written signature is removed.

An `ongoing` booking is the authoritative active-rental blocker. The admin vehicle resource exposes the corresponding eligibility state for a clear disabled UI, while the service repeats the check inside the transaction to protect against stale clients and races.

## Checklist definitions

Backend checklist keys and labels are read from the shared configuration library through VehicleInspectionDefinition. The web loads those definitions from /admin/vehicle-options; only category labels and body-panel/issue enums remain fixed locally. Every new inspection submission includes checklist_version, and stale or incomplete templates are rejected again inside the persistence transaction. Stored item labels are snapshot data and must not be rewritten if library wording changes later. See [vehicle configuration](vehicle-configuration.md) for option lifecycle and baseline handling.

## Body marker coordinate system

Panel order is always:

1. Front
2. Right
3. Rear
4. Left

Marker numbers are global across these panels. Editable drafts reindex after deletion; finalized snapshots never reindex.

Marker coordinates are percentages in the inclusive range `0.000` through `100.000`, relative to the shared `1000 x 600` SVG viewBox. The UI converts the client pointer through the clicked SVG hit region's inverse screen transform. Zoom and pan affect only the viewport and never persisted coordinates.

Each panel owns independent 1x–4x zoom/pan state. Pinch gestures and drags are distinguished from taps and cannot create markers. Only explicit vehicle silhouette hit regions accept new markers; whitespace does not.

`VehicleBodyInspection` supports `edit`, `readonly`, and a foundational `compare` mode. Current-condition and history views reuse its readonly mode.

## Management API

The existing stateful admin API remains under `/admin` and the existing `manage vehicles` permission protects all condition endpoints:

- `GET /admin/vehicles/{vehicle}/current-condition`
- `GET /admin/vehicles/{vehicle}/inspections`
- `GET /admin/vehicles/{vehicle}/inspections/{inspection}`
- `POST /admin/vehicles/{vehicle}/initial-condition`
- `POST /admin/vehicles/{vehicle}/condition-updates`

The existing `POST /admin/vehicles` contract now requires `initial_condition`. Inspection lookup is vehicle-scoped to prevent cross-vehicle ID access.

## Public privacy boundary

`VehicleResource` remains the public/mobile catalog resource and does not include current-condition pointers, checklist values, markers, comments, history, signer metadata, or signatures. `AdminVehicleResource` is used only by authenticated management endpoints. Future work must preserve this separation.

## Current snapshot invariants

- Only finalized snapshots may be accepted as current.
- Every standalone condition update is a new immutable snapshot, never an edit to an existing record.
- Every standalone update has a new personnel signature, a controlled reason, and lineage to the previous current snapshot.
- Maintenance completion with a different odometer uses the signed maintenance condition-update flow before completing the job. The signed odometer must match the saved completion reading; the previous snapshot remains unchanged. See [Vehicle Maintenance Architecture](maintenance-architecture.md).
- Standalone updates are forbidden while the vehicle has an ongoing rental.
- Signature paths and bytes remain private and are never included in API resources or activity properties.

## Booking inspection rules

- Outgoing finalization uses the shared rental-time rule for both rental types: `[rental_start_at, rental_end_at)` normally, plus early arrival on the same rental start date in Asia/Manila when a local/testing timing flag is enabled. Future dates and exact/elapsed return deadlines remain blocked. The service rechecks under the booking lock and before saving the finalized snapshot; rejection rolls back the snapshot and removes newly stored signatures. Existing finalized snapshots are preserved.
- Outgoing copies the vehicle's finalized Current Condition and references it through `based_on_inspection_id`; finalizing Outgoing does not move the Current pointer.
- Incoming copies the booking's finalized Outgoing snapshot. Finalizing Incoming atomically moves the vehicle's Current pointer to the new immutable Incoming snapshot.
- Self Drive requires authenticated Jamjade personnel plus the customer signature captured on the personnel device.
- Admin's Driver requires authenticated authorized Jamjade personnel plus the assigned Driver; the Customer does not sign these inspections.
- Booking signatures belong to booking inspection snapshots, never to `vehicles`.
- Self-drive **Finalize Inspection & Start Handover** commits the immutable inspection and the existing staff handover transition together. Failure rolls both back and removes new signature files; no phone checks are fabricated and Start Rental remains separate. Existing signed inspections can continue to Setup without replacement.
- Booking forms place one shared acknowledgement above the personnel/operator signature cards. Both cards keep the existing heading and SignaturePad treatment without internal descriptions; phones stack the cards. Standalone single-signature forms keep their existing acknowledgement placement.
- Inspection evidence never automatically assigns financial responsibility. Authorized personnel create separate customer- or Driver-responsible charges after Incoming finalization.
- The complete lifecycle and readiness gates are documented in `docs/booking-rental-lifecycle.md`.

Signature layout verification — 2026-10-18: reused VehicleConditionForm and SignaturePad; browser checks at desktop and 390 px verified equal card/pad dimensions, shared acknowledgement placement, capture/clear, required-field errors, Laravel-style `422`, server failure and successful submission using synthetic data. Lint, TypeScript, production build and diff checks passed. StoreBookingInspectionRequest/VehicleConditionRules were compared with bookingInspectionSchema/vehicleConditionSchema and the service mapping; fields and validation are unchanged, with no new differences introduced.
