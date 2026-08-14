# Vehicle Maintenance Architecture

## Purpose and boundaries

Maintenance is an internal fleet-operations domain. It is intentionally split into two records:

- A **maintenance plan** is editable configuration describing when work becomes due. It may use mileage, a date interval, or both.
- A **maintenance record** is historical evidence of work that was manually scheduled, started, completed, or cancelled.

Plans never create records or calendar blocks automatically. `upcoming`, `due_soon`, `due`, and `overdue` are derived informational states only.

## Authoritative inputs

The current finalized Vehicle Condition snapshot supplies the current odometer. Maintenance does not keep a second mutable "current mileage" field. A missing Current Condition produces an unknown current odometer rather than a fabricated value.

Warning thresholds are centralized in `backend/config/maintenance.php` (initially 500 km and 7 days). For a plan using both triggers, the most urgent result wins.

## Scheduling and availability

Jamjade personnel must select the vehicle, work, start, and expected end. The backend uses the same booking scopes as booking creation: only confirmed and ongoing bookings block the vehicle, and overlap uses the system's existing inclusive boundary semantics.

The booking availability boundary also checks operational maintenance records:

- `scheduled`: blocks its selected `scheduled_start` through `scheduled_end`.
- `in_progress`: blocks from its scheduled start without a planned-end cutoff. Passing `scheduled_end` never releases an overrun.
- `completed`: its historical effective block ends at server-recorded `completed_at`, not `scheduled_end`. Finishing early immediately releases the unused planned window.
- `cancelled`: does not block; cancellation preserves the record and actor/timestamp.

Due plan states do not participate in this query. Scheduling never alters a customer booking and rejects conflicts with a safe validation response.

## Lifecycle and vehicle status

Allowed transitions are `scheduled → in_progress → completed` and `scheduled → cancelled`. Actual start/completion timestamps and actors come from the authenticated server request. Completed and cancelled evidence cannot be reopened through the ordinary workflow.

A future schedule does not change the current vehicle status. Starting maintenance requires an otherwise available, non-rented vehicle and sets its operational status to maintenance. Completion reconciles status conservatively: an ongoing rental wins; otherwise only a maintenance-owned status is released to available. Booking completion uses the inverse reconciliation, so it cannot erase an in-progress maintenance restriction.

## Completion, costs, and next due targets

Completion requires work performed and an odometer that is not below the current-condition or starting reading. Labor, parts, and other costs are optional decimals; `total_cost` is derived on the server. If linked to a plan, completion—not scheduling or starting—updates last-completed evidence and calculates the next date/mileage targets.

Costs, providers, technicians, work notes, and maintenance records are internal. Guest/mobile vehicle resources expose only merged blocked date ranges needed by the booking calendar, never maintenance internals.

## Vehicle Condition relationship

Maintenance evidence and condition evidence remain separate. Corrective/body work surfaces an **Update Current Condition** action. Personnel use the existing signed `condition_update` flow, which creates a new immutable finalized snapshot; the maintenance record can then reference it through `resulting_condition_inspection_id`. Routine work such as an oil change does not force a physical-condition update.

## Permissions, audit, and reporting foundation

`manage maintenance` is a module-level Spatie permission enforced on all maintenance admin routes. The owner receives it with all module permissions; assignable admin roles can receive it independently. Create/update/deactivate, schedule/start/complete/cancel, and condition-link events use the existing Spatie activity-log conventions.

Maintenance cost columns and completion timestamps are indexed/queryable for later reporting. The maintenance module already exposes due-soon, overdue, scheduled, and in-progress operational summaries without redesigning the main dashboard.

## Deferred work

Attachments are deferred until the repository has a reusable internal attachment architecture. Future receipts, invoices, reports, and before/after photos must remain separate from public vehicle images and inspection signatures.
