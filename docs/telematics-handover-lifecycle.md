# Telematics handover lifecycle

## Staff-to-renter sequence

1. Laravel selects only the owning renter's current self-drive lifecycle record for the mobile read model: ongoing first, then a confirmed handover already `in_progress`, then another confirmed booking, then pending, with the earliest scheduled start breaking ties. Terminal and owner's-driver bookings do not activate telematics. The mobile tab renders Laravel's locked explanation instead of local eligibility guesses.
2. Staff finalizes a self-drive Outgoing Inspection. Laravel creates or enables the session as `setup_required`; it does not release the rental.
3. Admin may configure optional custom monitoring zones on the website. Default zones apply automatically; neither step is a handover prerequisite.
4. From the booking's **Prepare Handover** action, staff review readiness, then select **Start Handover**. The read-only **View** action shows the resulting setup progress and step summaries.
5. `POST /admin/bookings/{booking}/telematics-setup/start` is authorized by the existing `manage bookings` permission and calls `TelematicsSetupService::startHandover`.
6. In standard mode, the service locks the booking/session and verifies approved self-drive documents, `confirmed`, `setup_required`, that the `rental_start_at` date is today in `Asia/Manila`, and finalized outgoing personnel/renter signatures. It changes only the session to `in_progress`, sets `started_at` if needed, and writes `telematics_handover_started` activity. Local/testing handover mode relaxes the selected date, document, and inspection gates as described below.
7. The renter sees the server-derived `in_progress` state and may submit only Phase 3 evidence for device capability, motion permission, foreground location permission, background-location readiness, a fresh GPS fix, and a phone-mount confirmation. Laravel owns pass/fail evaluation and appends each retry; the client cannot submit a status.
8. In standard mode, the five calibration checks remain pending in Phase 3, so the session remains `in_progress` and cannot reach `ready_for_release` yet. Local/testing handover test mode is the documented exception: a real passing phone-mount attempt supplies release readiness without inventing calibration or other check results.
9. Staff use the existing **Start Rental** action. `RentalReadinessService` gates the transition. Success changes booking to `ongoing`, vehicle to rented, and session to `released`, and freezes the default/custom monitoring zones in the same transaction.
10. Only the owning renter can later create the one actual trip through the authorized trip service.

## Renter read APIs

- `GET /mobile/telematics/setup` returns the caller's most relevant ongoing, confirmed, or pending self-drive booking. Its `eligibility` object is authoritative for the locked explanation and setup controls; it returns `data: null` when no non-terminal self-drive booking exists.
- `GET /mobile/bookings/{booking}/telematics-setup` returns the same read model for an explicitly selected booking only when it belongs to the caller and is self-drive/confirmed-or-ongoing.

Both return booking code, booking state, scheduled start, session summary, required-step summaries, server eligibility, `canBeginSetup`, `canContinueSetup`, `canStartTrip`, and trip state. They do not return setup/session/step identifiers, check evidence, assigned boundaries, monitoring-zone records, or exact GPS results. `canStartTrip` is only a read projection for a released booking with no active trip; the backend still enforces one trip per booking, including after an earlier trip has ended, and the current mobile flow does not expose trip-start controls. The mobile tab can use its explicit booking route for confirmed/ongoing bookings, but it also works without a route parameter through the current-setup endpoint.

## Mobile Telematics tab

The Telematics tab is the renter's home for existing self-drive handover and setup. It uses the same header, safe-area spacing, cards, and actions as Bookings. It shows the current rental selected by Laravel, allows switching between the renter's confirmed or active self-drive bookings, and rechecks the selected booking through the handover read API. A pending booking can appear as the server-selected current rental, but cannot be selected through the confirmed/ongoing booking endpoint.

The tab contains rental details and payment/document links, server-derived handover requirements, the six device-readiness checks with prerequisite and retry guidance, the last setup result, calibration availability, and read-only release/trip status. Monitoring zones are managed and reviewed through the website; they are not assigned by the mobile tab or returned by this read model. Staff remains responsible for inspection, Start Handover, and Start Rental. The tab never creates a trip or starts sensor/location collection; calibration and active tracking remain unavailable.

The renter selects **Check setup** once to run the available checks sequentially and then manually confirm the phone mount. Individual rows show progress and results instead of separate check buttons. Standard mode stops at a failed check; the renter can resolve it and rerun setup. Phone-mount confirmation is not automatic mount detection, and no mount pass is submitted without an explicit positive response.

Confirmed and active self-drive booking actions open this tab with the booking code. Booking notification actions resolve the current booking before routing applicable self-drive rentals here; document and payment actions retain their existing destinations. Notifications are shortcuts, not prerequisites. Focus, foreground return, pull-to-refresh, and periodic reads while the tab is focused refresh staff changes. Setup checks still require an explicit renter action and a fresh server eligibility check before permission or GPS work.

## Failure and retry semantics

Starting handover is rejected with a validation response if any precondition is missing or the session is no longer `setup_required`. A duplicate staff request after a successful transition is also rejected; it never silently restarts or replaces a session. The web dialog reloads while open only during actionable setup states, so a staff member can see a server-side transition without a websocket.

Setup retries create new append-only attempts. A failed latest attempt prevents readiness; passing a later attempt for the same type replaces only the readiness projection, not history. A released session is immutable. Failed transport requests are safe to retry because the backend re-evaluates state and does not create duplicate release actions. The generic `POST /mobile/bookings/{booking}/telematics-setup/steps/{step}/attempt` endpoint accepts typed evidence only for the Phase 3 steps and rejects client-selected statuses and calibration step types.

## Temporary local handover testing

Set `TELEMATICS_HANDOVER_TEST_MODE=true` in `backend/.env`, then run `php artisan config:clear` from `backend/`. The flag defaults to false and is ignored unless Laravel's environment is `local` or `testing`. Restore false and clear configuration when done. Tests force the flag off by default.

In this mode, a confirmed self-drive booking may start staff handover without approved documents, today's Manila rental date, an outgoing inspection/signatures. The server creates the setup session if needed. Payment and age requirements are also relaxed for outgoing inspection and Start Rental. No payment, document approval, inspection, or successful device result is fabricated.

Test mode removes the server's prerequisite ordering, although the mobile **Check setup** action still runs the six checks in sequence. Failures retain their real result and do not prevent the release-readiness projection. A real phone-mount confirmation makes the session `ready_for_release`, skipping the unavailable calibration requirement for testing. Checks may be retried before release, and a later failed mount confirmation removes readiness. Staff still release using Start Rental. Released sessions remain immutable.

Test sequence: confirm a self-drive booking, choose Prepare Handover, start handover, refresh the mobile Telematics tab, try the implemented checks, confirm the phone mount last, refresh the staff booking, and choose Start Rental. The web and mobile handover views display test mode explicitly. Authentication, ownership, management permissions, confirmed/self-drive scoping, operational vehicle and booking-conflict checks, and the one-trip invariant remain enforced.

This enables testing handover and rental release. It does not implement calibration capture, bypass device OS permission prompts, or add mobile active-trip tracking. Incoming inspection/return processing still requires the real outgoing inspection baseline; perform an outgoing inspection if testing those later stages.
