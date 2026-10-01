# Telematics handover lifecycle

## Staff-to-renter sequence

1. Laravel selects only the owning renter's current self-drive lifecycle record for the mobile read model: ongoing first, then a confirmed handover already `in_progress`, then another confirmed booking, then pending, with the earliest scheduled start breaking ties. Terminal and owner's-driver bookings do not activate telematics. The mobile tab renders Laravel's locked explanation instead of local eligibility guesses.
2. Staff finalizes a self-drive Outgoing Inspection. Laravel creates or enables the session as `setup_required`; it does not release the rental.
3. Staff assigns the immutable booking geofence snapshot if it has not already been assigned.
4. From the booking's **Prepare Handover** action, staff assign the immutable booking geofence if needed, review readiness, then select **Start Handover**. The read-only **View** action shows the resulting setup progress and step summaries.
5. `POST /admin/bookings/{booking}/telematics-setup/start` is authorized by the existing `manage bookings` permission and calls `TelematicsSetupService::startHandover`.
6. The service locks the booking/session and verifies approved self-drive documents, `confirmed`, `setup_required`, that the `rental_start_at` date is today in `Asia/Manila`, the matching booking geofence snapshot, and finalized outgoing personnel/renter signatures. It changes only the session to `in_progress`, sets `started_at` if needed, and writes `telematics_handover_started` activity.
7. The renter sees the server-derived `in_progress` state and may submit only Phase 3 evidence for device capability, motion permission, foreground location permission, background-location readiness, a fresh GPS fix, geofence verification, and a phone-mount confirmation. Laravel owns pass/fail evaluation and appends each retry; the client cannot submit a status.
8. The five calibration checks remain pending in Phase 3, so the session remains `in_progress` and cannot reach `ready_for_release` yet.
9. Staff use the existing **Start Rental** action. `RentalReadinessService` gates the transition. Success changes booking to `ongoing`, vehicle to rented, and session to `released` in the same transaction.
10. Only the owning renter can later create the one actual trip through the authorized trip service.

## Renter read APIs

- `GET /mobile/telematics/setup` returns the caller's most relevant ongoing, confirmed, or pending self-drive booking. Its `eligibility` object is authoritative for the locked explanation and setup controls; it returns `data: null` when no non-terminal self-drive booking exists.
- `GET /mobile/bookings/{booking}/telematics-setup` returns the same read model for an explicitly selected booking only when it belongs to the caller and is self-drive/confirmed-or-ongoing.

Both return booking code, booking state, scheduled start, session summary, immutable geofence snapshot, required-step summaries, server eligibility, `canBeginSetup`, `canContinueSetup`, `canStartTrip`, and trip state. They do not return setup/session/step identifiers or check evidence. The mobile tab can use its explicit booking route for confirmed/ongoing bookings, but it also works without a route parameter through the current-setup endpoint.

## Failure and retry semantics

Starting handover is rejected with a validation response if any precondition is missing or the session is no longer `setup_required`. A duplicate staff request after a successful transition is also rejected; it never silently restarts or replaces a session. The web dialog reloads while open only during actionable setup states, so a staff member can see a server-side transition without a websocket.

Setup retries create new append-only attempts. A failed latest attempt prevents readiness; passing a later attempt for the same type replaces only the readiness projection, not history. A released session is immutable. Failed transport requests are safe to retry because the backend re-evaluates state and does not create duplicate release actions. The generic `POST /mobile/bookings/{booking}/telematics-setup/steps/{step}/attempt` endpoint accepts typed evidence only for the Phase 3 steps and rejects client-selected statuses and calibration step types.
