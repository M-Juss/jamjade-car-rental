# Vehicle Maintenance Architecture

## Purpose and boundaries

Maintenance is an internal fleet-operations domain with two separate records:

- A **maintenance plan** is editable reminder configuration. It never schedules work or blocks a booking automatically.
- A **maintenance record** is the auditable scheduled, in-progress, completed, or cancelled work history.

The management UI preserves that distinction through Maintenance Plans, Scheduled & Active, and History views. History is readonly.

Maintenance plan and record resources include the vehicle plate number alongside its name so the web tables identify the specific vehicle. The plan-based scheduling dialog displays the plan's vehicle, category, and maintenance name as fixed information; custom scheduling retains its editable controls. The schedule request and validation contract are unchanged. Sources: `MaintenancePlanResource`, `MaintenanceRecordResource`, `MaintenanceTables`, and `ScheduleMaintenanceDialog`.

## Authoritative plan inputs and targets

The current finalized Vehicle Condition snapshot is the only source for current odometer mileage. Maintenance does not maintain a duplicate mutable current-mileage field.

When a plan is created, Laravel calculates its first targets:

- Mileage: `Current Condition odometer + interval_km`
- Date: current business date + `interval_days`
- Both: both calculations

Mileage or combined plans cannot be created if the vehicle has no authoritative Current Condition odometer. The browser previews current and next values, but it does not submit next-due targets.

Plans retain an original cycle baseline. Editing an interval recalculates from the last completed maintenance evidence when available; otherwise it uses the preserved original baseline. Editing never mutates historical maintenance records. Completion starts the next plan cycle from the actual completion odometer and/or server completion date.

## Due-state calculation

`upcoming`, `due_soon`, `due`, and `overdue` are derived informational states:

- Mileage becomes Due Soon when 25% or less of the configured interval remains (75% has been consumed).
- Date becomes Due Soon at seven days remaining.
- Exactly zero remaining is Due; a negative remaining value is Overdue.
- A combined plan uses its most urgent mileage/date result.

A plan can remain mathematically due while its work is Scheduled or In Progress. The plan response includes that active record so the UI can show the reminder as handled. Due state never participates in booking availability.

## Plan lifecycle

An unused plan may be physically deleted. A plan with completed or cancelled history is deactivated so its evidence remains linked. A plan with Scheduled or In Progress work cannot be deleted until that work is resolved.

Only one Scheduled or In Progress maintenance record is permitted for the same plan cycle. This is checked while the vehicle and plan are locked inside the scheduling transaction.

## Scheduling and availability

Personnel schedule either a configured plan or one custom maintenance job. Plan scheduling receives its vehicle, name, category, and description from the plan. Custom work supplies those values without creating a plan.

Scheduling and rescheduling accept today or a future date in `Asia/Manila`.
The web calendar interprets the start of the selected start date and the end of
the selected end date in `Asia/Manila`, then submits UTC ISO timestamps. A job may start and end
on the same date; past start dates and end times not after the start remain
invalid. Availability and conflict checks still apply to the whole selected days.

The maintenance calendar consumes an internal vehicle-availability response that distinguishes booking and maintenance blocks and includes the authoritative Current Condition odometer. A whole calendar date is unavailable when any blocking booking or active maintenance occupies that date. A selected maintenance range cannot cross an unavailable date.

The backend repeats the conflict check using the same rules:

- Confirmed and ongoing bookings block maintenance calendar days.
- Scheduled maintenance blocks its selected calendar days.
- In Progress maintenance blocks indefinitely until valid completion.
- Completed maintenance ends its operational block at `completed_at`, releasing unused future schedule immediately.
- Cancelled maintenance releases its block while remaining in History.

Booking creation checks the same maintenance boundary. Public/mobile vehicle resources receive only the date ranges they need and never receive provider, cost, work, notes, plan configuration, condition evidence, or activity data.

## Record transitions

Allowed ordinary transitions are:

```text
scheduled -> in_progress -> completed
scheduled -> cancelled
```

Only Scheduled records can be rescheduled or cancelled. Rescheduling updates the same record, rechecks conflicts while ignoring its old range, and logs old/new timestamps. Cancellation records server time, actor, and an optional reason.

Starting uses server time and actor identity. The Current Condition odometer is captured automatically as `odometer_at_start`; personnel do not enter a separate starting odometer. Starting is rejected while the vehicle is rented or otherwise operationally unavailable.

## Completion, costs, and provider

Completion requires explicit labor, parts, and other costs; each can be zero. Laravel derives total cost. The completion form no longer requests work performed, and existing work descriptions remain in history. A service provider is required when scheduling; an existing job without one requires it at completion. A provider saved during scheduling stays fixed. Notes remain optional. Technician is not part of the active maintenance request or response contract. The plan table shows the associated job's Scheduled or In Progress state while it exists, otherwise the plan's due condition. The completion odometer remains editable and subject to server validation.

Completion odometer is required for mileage and combined plans. It is optional for date-only plans and custom work. Any supplied reading cannot regress below the Current Condition or captured starting reading.

Vehicle status is reconciled conservatively. Completing maintenance releases only a maintenance-owned restriction; it does not override an ongoing rental or an unrelated unavailable state. An In Progress overrun remains unavailable after its expected end.

## Vehicle Condition completion gate

Maintenance and condition evidence remain separate, but some work requires a resulting condition snapshot:

- Body Repair always requires Vehicle Condition verification.
- Corrective and Other completion asks whether tracked condition changed; Yes requires verification, No completes normally.
- Preventive work completes normally when its completion odometer matches Current Condition.
- A completion odometer that differs from Current Condition requires a signed condition update before maintenance can complete. The update starts with the completion reading, and the server requires the signed reading to match it. The previous snapshot remains unchanged. An initial condition is required before recording this update.

When verification is required, completion details are saved while the record remains In Progress and the vehicle remains unavailable. The existing Vehicle Condition dialog copies the current finalized snapshot, records the verified odometer/fuel/checklist/body markers/comments, captures a new personnel signature, and finalizes a new immutable `condition_update` snapshot. The previous current snapshot is never edited.

The new snapshot must be the vehicle's current finalized condition, have an appropriate Maintenance Completed or Repair Completed reason, and be finalized after completion details were recorded. It is then linked through `resulting_condition_inspection_id`; only that successful link finalizes maintenance, releases the maintenance restriction, and advances the plan cycle. Snapshot finalization, current-condition assignment, maintenance linking, and maintenance completion share one database transaction so a linking failure rolls back the entire condition update.

## Authorization and audit

All maintenance routes require the existing Spatie `manage maintenance` permission. The maintenance-specific condition-verification endpoints use that same permission while reusing the existing condition request rules and inspection service.

Activity events cover plan creation/update/delete/deactivation, scheduling, rescheduling, cancellation, start, completion-details pending verification, resulting-condition linking, and completion. Activity properties contain operational identifiers and timestamps, not cancellation text, internal notes, signatures, or other sensitive content.
