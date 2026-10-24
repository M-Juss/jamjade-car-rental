> **Historical archive — 2026-10-24.** This is a superseded working-copy snapshot, not current coding guidance. Read the [central implementation guide](../../telematics-master-plan.md). Historical plans, exclusions, platform targets, and verification statements below retain their original dates; relative Markdown links were rebased for this archive.

# Telematics handover lifecycle

Android-only scope — 2026-10-24: `mobile-frontend` now targets Android only; iOS and mobile-browser support are retired. Earlier dated multi-platform descriptions and results below are historical. Shared Laravel contracts, saved records and the separate Next.js website are unchanged. Current physical verification is required on Android. See [Android-only mobile scope](../../android-only-mobile.md).

Current mobile presentation and prepared-start exception — 2026-10-19: see [Mobile Telematics drawer](telematics-mobile-dashboard.md). The selected rental now opens outside bottom navigation, with three drawer tabs and setup/calibration dialogs. An explicit one-use agreement during setup may start GPS after a fresh staff-release/monitoring-eligibility read; it never collects rental GPS before release or automatically resumes after Stop/runtime loss. Explicit owning Returned/Completed setup reads are now read-only `rental_ended` history; setup mutations still require Confirmed/Ongoing. Earlier UI descriptions below are historical.

With Assigned Driver entry — 2026-10-19: the Driver opens an assigned Confirmed or Ongoing rental from the existing **Services** screen using **Open vehicle setup** or **Open Telematics**. That route opens the same booking-specific drawer and setup/calibration dialogs used by the Customer Telematics tab. Driver authorization is tied to the current assignment; staff still starts handover and releases the rental. The Customer's v4 rental terms disclose that JamJade staff and the Customer can see the Driver rental's latest location, and the Driver separately agrees to GPS sharing in the app.

## Staff-to-renter sequence

1. Laravel selects the authenticated Customer's applicable Self Drive booking or the authenticated Driver's assigned With Assigned Driver booking for the mobile read model. Terminal bookings do not activate setup. The mobile UI renders Laravel's locked explanation instead of local eligibility guesses.
2. Staff chooses **Finalize Inspection & Start Handover** for an Outgoing Inspection on either rental type. The combined `POST /admin/bookings/{booking}/outgoing-inspection-handover` finalizes the inspection with the required signatures and starts the existing handover service in one transaction. The session passes through `setup_required` to `in_progress`; the booking stays confirmed and no checks, calibration or trips are created.
3. Admin may configure optional custom monitoring zones on the website. Default zones apply automatically; neither step is a handover prerequisite.
4. The normal Prepare Rental wizard has **Outgoing Inspection → Setup → Release** for both rental types; With Assigned Driver also has **Assign Driver** before inspection. A previously saved outgoing snapshot awaiting handover remains read-only under the Outgoing step; **Continue to Setup** starts handover without replacing signatures. The read-only **View** action retains handover/setup history.
5. Both the combined action and `POST /admin/bookings/{booking}/telematics-setup/start` require the existing `manage bookings` permission and call `TelematicsSetupService::startHandover`. The latter supports already finalized inspections and the explicit local test path. The original outgoing-only endpoint remains available for assigned-driver inspections and existing callers.
6. In standard mode, the service locks the booking/session and verifies the supported rental, current assigned operator, `confirmed`, `setup_required`, current server time within `[rental_start_at, rental_end_at)`, and finalized outgoing signatures. Self Drive additionally requires approved Customer documents. It changes only the session to `in_progress`, sets `started_at` if needed, and writes `telematics_handover_started` activity. Local/testing handover mode relaxes only its documented Self Drive gates.
7. The owning Customer (Self Drive) or assigned Driver (With Assigned Driver) sees the server-derived `in_progress` state and completes the six device-readiness checks. The next stage captures five explicit, consented calibration steps under Staff supervision in a controlled area. Laravel owns pass/fail evaluation and appends each retry; the client cannot submit a status. See [calibration](telematics-calibration.md).
8. In standard mode, every latest device check and all five ordered calibration results must pass before `ready_for_release`. Restarting a device check or earlier calibration invalidates later calibration projections without deleting attempts. Local/testing handover test mode retains its bounded exception: a real passing phone-mount attempt supplies release readiness without inventing other results.
9. Staff use the existing **Start Rental** action. `RentalReadinessService` gates the transition. Success changes booking to `ongoing`, vehicle to rented, and session to `released`, and freezes the default/custom monitoring zones in the same transaction.
10. Only the current authorized operator (owning Customer or assigned Driver) can later create the one actual trip through the authorized trip service. Reassignment requires the newly assigned Driver to complete their own setup attempts before release.

## Operator read APIs

- `GET /mobile/telematics/rentals` lists applicable pending, confirmed and ongoing rentals for the authenticated Customer or assigned Driver. It uses the standard paginated envelope (default 10, maximum 30 per page), current-rental ordering and the same authoritative eligibility evaluator as setup. Each compact card record contains the booking code/status, vehicle name/image, start/end timestamps, server-derived expiry, whether setup attempts exist, and eligibility. It omits raw check evidence, inspection/signature data, trip coordinates and monitoring zones. Relationships and competing-rental availability are read in batches rather than per card.

- `GET /mobile/telematics/setup` returns the caller's most relevant ongoing, confirmed, or pending supported booking. Its `eligibility` object is authoritative for the locked explanation and setup controls; it returns `data: null` when no applicable non-terminal booking exists.
- `GET /mobile/bookings/{booking}/telematics-setup` returns the same read model for an explicitly selected booking only when it belongs to the Customer or is assigned to the Driver, and is confirmed-or-ongoing.

Both return booking code, booking state, scheduled start, session summary, required-step summaries, server eligibility, `canBeginSetup`, `canContinueSetup`, `canStartTrip`, and trip state. They do not return setup/session/step identifiers, check evidence, assigned boundaries, monitoring-zone records, or exact GPS results. `canStartTrip` is only a read projection for a released booking with no active trip; the backend still enforces one trip per booking, including after an earlier trip has ended, and the current mobile flow does not expose trip-start controls. The mobile tab can use its explicit booking route for confirmed/ongoing bookings, but it also works without a route parameter through the current-setup endpoint.

## Mobile Telematics tab (Customer history)

The Telematics tab is the renter's home for self-drive handover and setup. Phase 1 of the mobile UI refinement, implemented in code on 2026-10-17, makes the tab's initial screen a paginated list of vehicle booking cards. The 2026-10-19 presentation update centers rounded cards with an emphasized concatenated vehicle name at the upper left, a blue booking code at the upper right and the vehicle image bottom-aligned against the rounded action section. A compact Rental date/Return row now sits above the primary action with a divider beneath it; the booking-status badge remains omitted. The primary button contains the waiting reason and required guidance while locked, then uses the available action label when setup or the released rental can open. Booking details is a full-width secondary button. Empty, loading and read-error states are explicit. Current and in-progress rentals come first; pending and future bookings remain visible with locked setup entry and a short reason. Booking details and required-document recovery remain accessible while setup is locked. Stale cards cannot open setup after a failed refresh or while foreground eligibility is being rechecked. Focus, foreground return, pull-to-refresh and focused 15-second reads refresh staff changes without collecting telemetry.

Phase 2, implemented in code on 2026-10-17, opens each selected booking into a Rental setup overview with a compact vehicle summary and three stage cards: Device setup (six results), Calibration (five results), and Vehicle release. Stage progress uses the server's effective result summaries. Device setup requires current server setup permission; calibration additionally requires all six device results and the server's current calibration context/next step. Passing results remain visible when setup is locked, but never grant mutation permission. Ready-for-release setup displays Awaiting staff release; only the released server state enables Open rental, which opens the existing read-only rental panel.

Stage cards navigate to the existing device-check and calibration panels without requesting permissions or starting a capture. Device checks retain their pre-start disclosure; calibration remembers disclosure agreement per Customer/rental/profile/disclosure version and retains manual Start recording per capture. Back navigation returns from a stage to the overview, then to rental cards. Android hardware Back follows the same path; Back controls are unavailable during an active check/capture, with the existing recording Stop action available. Lost eligibility or invalidated prerequisites return an idle stage to the overview. Completed device checks have a completion panel and a Continue to calibration action; repeating checks remains explicit through results and its disclosure warning. Booking details, document/payment recovery and staff-state refresh remain available. Existing booking/notification links containing a booking code open the overview through the same handover read model; Laravel rechecks eligibility before every mutation. There is no customer release action.

Stationary and Forward now have visual/live guides and automatic confirmed-success transitions to the next idle exercise; see [calibration](telematics-calibration.md) and its [computation reference](telematics-calibration-computation.md). Dedicated device-check refinements, visual guides/transitions for exercises 3–5 and the expanded rental overview remain later UI phases. These UI guides preserve staff-release authority; the separate protocol 3 parked-noise policy is documented below.

Monitoring zones are managed and reviewed through the website; they are not assigned by the mobile tab or returned by these read models. Staff remains responsible for inspection, Start Handover and Start Rental. The tab never creates a trip or starts active-trip/background collection. Motion subscriptions exist only during explicit, bounded foreground calibration captures; physical Android/iOS verification and limits are recorded separately.

The renter selects **Check setup** once to run the available checks sequentially and then manually confirm the phone mount. The current check shows progress, guidance and server failure reasons; completed results are available on demand. Standard mode stops at a failed check; the renter can resolve it and rerun setup. Phone-mount confirmation is not automatic mount detection, and no mount pass is submitted without an explicit positive response. Passing the device checks unlocks calibration in the overview, not release readiness. Laravel's setup permission and release state remain authoritative.

Confirmed and active self-drive booking actions open this tab with the booking code. Booking notification actions resolve the current booking before routing applicable self-drive rentals here; document and payment actions retain their existing destinations. Notifications are shortcuts, not prerequisites. Focus, foreground return, pull-to-refresh, and periodic reads while the tab is focused refresh staff changes. Setup checks still require an explicit renter action and a fresh server eligibility check before permission or GPS work.

## Failure and retry semantics

Combined preparation verification — 2026-10-18: the full backend suite passed 758 tests (4,385 assertions), including combined save/start, mobile setup eligibility, no premature release or fabricated checks, permissions, prerequisites, same-day early arrival, immutable retry protection, existing-inspection recovery and transaction/file rollback. PHP formatting, web lint, TypeScript, production build, workflow/service assertions and diff checks passed. Synthetic desktop/390 px browser checks used the existing workflow/form primitives and covered the three-step progress, busy state, required signatures, successful transition to Setup, Previous read-only review, saved inspection recovery, `422` and server failures with retained signatures and one toast. StoreBookingInspectionRequest/VehicleConditionRules and bookingInspectionSchema/vehicleConditionSchema keep the same fields; the service chooses the combined endpoint only for self-drive outgoing. No live booking, native permission, calibration capture or active trip was changed during verification.

The combined inspection/handover action locks the booking and customer before the vehicle. Failure rolls back the inspection, signatures, session, audit and notification, and deletes only newly stored signature files. Repeated inspection submissions cannot replace an immutable snapshot or create duplicate handover events. After a transport failure, refresh the authoritative booking before retrying; a saved inspection can continue through the existing recovery action.

Starting handover is rejected with a validation response if any precondition is missing or the session is no longer `setup_required`. A duplicate staff request after a successful transition is also rejected; it never silently restarts or replaces a session. The web dialog reloads while open only during actionable setup states, so a staff member can see a server-side transition without a websocket.

Setup retries create new append-only attempts. A failed latest attempt prevents readiness; passing a later attempt for the same type replaces only the readiness projection, not history. A released session is immutable. Failed transport requests are safe to retry because the backend re-evaluates state and does not create duplicate release actions. The generic `POST /mobile/bookings/{booking}/telematics-setup/steps/{step}/attempt` endpoint accepts typed evidence for the six device checks and five calibration steps, rejects client-selected statuses, and enforces the calibration protocol, current context, ordering, consent and summary-only payload.

## Local early-start timing only

RC calibration profile is separate from both timing and broad handover test mode.
`TELEMATICS_CALIBRATION_PROFILE=rc_demo` is honored only in local/testing, stamps
real evaluated summaries and preserves all normal device, motion and staff-release
requirements. Profile/settings changes require fresh calibration even when the
stored session was ready; the read model projects in-progress recovery without
rewriting historical attempts. See [RC demonstration](telematics-rc-demonstration.md).

For testing the real setup/calibration flow before the booked start time, set `RENTAL_EARLY_START_TEST_MODE=true` in `backend/.env` and run `php artisan config:clear` from `backend/`. Keep `TELEMATICS_HANDOVER_TEST_MODE=false`. The timing-only flag defaults to false and is ignored outside `local`/`testing`. Disable it and clear configuration when normal clock gating is needed. Automated tests force both flags off unless a case explicitly enables one.

This allows Outgoing Inspection, Start Handover, mobile setup and staff Start Rental for both rental types earlier on the rental's start date in Asia/Manila. A future calendar date remains blocked, the exact return deadline and later times remain blocked, and normal later pickup inside the reserved interval remains valid. The booked start/end timestamps, pricing and return deadline are unchanged.

Outgoing Inspection shares that same bounded timing rule for both rental types. Both existing local/testing flags may enable earlier same-start-date inspection; neither allows a future start date or an expired rental. The service still rechecks timing under the booking lock and before finalization. Existing finalized snapshots remain valid. Management keeps `readiness.outgoingInspectionTimeEligible`; mobile handover eligibility and payloads are unchanged.

All other rules remain strict: confirmed booking, applicable document requirements, age, payment, outgoing inspection/signatures, customer/vehicle/driver availability, staff authorization, six device checks and all five calibration exercises for either rental type. The timing-only flag does not set the broader `eligibility.testMode` field, bypass check ordering or permit mount-only readiness. Server-derived eligibility/readiness fields drive both frontends. The broader mode below remains available independently for its older bounded Self Drive flow-testing use case.

Verification — 2026-10-17: 120 focused backend tests passed, followed by the full `composer test` suite (557 tests, 3,101 assertions) using a temporary CLI-only 512 MB memory setting. PHP formatting and diff checks passed. New cases cover both rental types, Manila/UTC date boundaries, future dates, exact/elapsed return deadlines, disabled/production/staging flags, strict non-timing requirements, mobile step ordering, all eleven self-drive results and staff release without changing booked timestamps. Local runtime verification confirmed timing-only mode enabled and broader handover mode disabled. Browser and physical-device smoke checks were not rerun; frontend payloads and controls are unchanged.

## Temporary local handover testing

Set `TELEMATICS_HANDOVER_TEST_MODE=true` in `backend/.env`, then run `php artisan config:clear` from `backend/`. The flag defaults to false and is ignored unless Laravel's environment is `local` or `testing`. Restore false and clear configuration when done. Tests force the flag off by default.

In this mode, a confirmed self-drive booking may start staff handover, mobile setup and Start Rental before its scheduled clock time when its rental start date is today in Asia/Manila. A 2 PM booking may therefore be tested earlier that same day. Normal collection on later days inside the booked interval also remains allowed. Future-date bookings and bookings at/after their return deadline are blocked. The server rechecks this rule for each setup mutation and release; neither the booked start nor the return deadline changes.

The same early-start timing allowance also applies to With Assigned Driver rentals. Their normal payment, inspection, age, assigned-driver and vehicle-readiness requirements remain enforced, including the standard telematics setup and calibration gate.

For Self Drive, approved documents, outgoing inspection/signatures, payment and age requirements remain relaxed for local flow testing. The server creates the setup session if needed. No payment, document approval, inspection, or successful device result is fabricated.

Test mode removes the server's prerequisite ordering, although the mobile **Check setup** action still runs the six checks in sequence. Failures retain their real result and do not prevent the release-readiness projection. A real phone-mount confirmation makes the session `ready_for_release`, skipping the unavailable calibration requirement for testing. Checks may be retried before release, and a later failed mount confirmation removes readiness. Staff still release using Start Rental. Released sessions remain immutable.

Test sequence: confirm a self-drive booking, choose Prepare Handover, start handover, refresh the mobile Telematics tab, try the implemented checks, confirm the phone mount last, refresh the staff booking, and choose Start Rental. The web and mobile handover views display test mode explicitly. Authentication, ownership, management permissions, confirmed/self-drive scoping, operational vehicle and booking-conflict checks, and the one-trip invariant remain enforced.

This enables testing handover and rental release. It does not fabricate calibration capture, bypass device OS permission prompts, or add mobile active-trip tracking. Disable test mode when verifying the full standard calibration gate. Incoming inspection/return processing still requires the real outgoing inspection baseline; perform an outgoing inspection if testing those later stages.

Policy update — 2026-10-16: standard handover and mobile setup mutations now require current server time inside `[rental_start_at, rental_end_at)`, allowing collection on later booked days. This replaces the earlier same-calendar-date rule. Other payment, inspection, document and real-readiness requirements remain unchanged.

Testing exception verified in code on 2026-10-16: the full backend suite passed 419 tests (2,366 assertions), including early same-Manila-date release across different UTC dates, future-date/expired rejection, setup deadline rechecks, fixed booked timestamps and production ignoring the flag. PHP formatting, web lint, TypeScript, production build and diff checks passed. This follow-up reused the existing booking workflow blocker display and changed no forms or API payloads. Browser and physical-device smoke checks were not rerun for this timing adjustment.

Self-drive overlap policy — 2026-10-16: new pending/confirmed/ongoing self-drive reservations may not overlap another self-drive reservation for the same Customer, even on different vehicles. Adjacent intervals and With Driver rentals remain allowed. Customer-row locks serialize new reservations, handover and release. Another in-progress/ready handover or ongoing self-drive rental (including an overdue one) blocks setup, a new handover and release in all modes. Existing bookings remain saved for Staff resolution.

## Released rental screen — 2026-10-18

Follow-up increment: separately consented foreground **Share location** now
replaces the initial Not recording-only Monitoring card described below.
Opening the rental still starts no collection. See
[foreground latest-location sharing](telematics-foreground-location.md) for
the new controls, encrypted point lifetime and physical test checklist.

The staff-released **Open rental** action now opens the first mobile Telematics
dashboard. It shows the selected vehicle, plate when available, booking details
action, elapsed time since `setup.releasedAt`, time until the original booked
return deadline, release/return dates, and the saved return location. The screen
uses the existing owning-renter handover and booking reads; no new endpoint or
release action is introduced. The booking service preserves `rentalEndAt` in its
mapped view model rather than parsing the human-formatted return label.

Timers are presentation only, based on the phone clock and saved timestamps.
They refresh while the screen is focused and foregrounded, and refresh immediately
on return. Missing timestamps show unavailable values; scheduled start is never
substituted for actual release. Reaching the deadline shows **Return due**, then **Overdue by** and
elapsed overdue time without changing booking state, calculating charges or
ending a trip. Dates use Asia/Manila internally without visible timezone labels.

The Monitoring card explicitly says **Not recording**. It shows a saved trip
record status separately, so a backend trip record cannot imply that this mobile
screen is collecting data. There are no map/location markers, sensor readings,
driving-event counts, tracking actions or invented statistics. Active-trip
collection, background work, offline buffers and classification remain pending.

The existing setup overview retains device/calibration history. The rental
dashboard avoids duplicating the old vehicle header and setup-result panel.
Loading, unavailable/revoked handover, refresh and booking-detail errors continue
through the existing screen. Staff release remains the authoritative entry gate.

Verification: 27 focused mobile dashboard/rental-card/setup tests, mobile lint,
TypeScript and Android/iOS bundle exports passed. An isolated browser rendering
of the actual dashboard/card components, using HTML adapters, placeholder icons
and vehicle image, and labeled synthetic data, was reviewed at 320/390 px phone
and 768 px tablet widths. Populated, overdue and missing-detail layouts had no
horizontal overflow. The preview did not exercise native safe areas, authenticated
navigation or the real phone clock. Physical Android/iOS smoke checks remain
pending. No backend contract or telemetry collection changed.

## Rental-card UI verification — 2026-10-17

Phase 1 adds the compact list endpoint and card entry flow only; later setup/calibration UI phases remain pending. Thirty-eight focused backend tests passed across access eligibility, competing self-drive availability and local handover test mode. Thirteen focused mobile Node tests passed for card gating, dates and the existing setup stages. Mobile lint, TypeScript, PHP formatting and diff checks passed. Synthetic browser review used the actual card components with explicitly labeled demo data at 320/390 px phone and 768 px tablet widths, including locked/available entries, empty state and stale-card disabling. It did not exercise the authenticated native shell or device permissions; physical Android/iOS checks were not run.

The full backend suite was attempted. The default 128 MB PHP limit exhausted memory during PDF generation; a temporary CLI-only 512 MB scan configuration allowed completion with 523 passing tests out of 534, ten failures and one error in payment-document/email tests. The six BookingEmailService tests passed when rerun in isolation; the full-run failures remain unresolved outside the rental-card phase; the full suite is not green. No repository PHP configuration was changed.

## Setup-overview UI verification — 2026-10-17

Phase 2 adds the three-stage overview and navigation to the existing check/calibration panels. Mobile lint, TypeScript and diff checks passed. Thirty-three focused Node tests passed across overview/stage gating, rental cards, calibration summaries and consented calibration workflow, including eight new overview cases. Synthetic browser review used actual stage-card, device-check and calibration components with labeled demo data at 320/390 px phone and 768 px tablet widths. It checked saved partial progress, failed checks, locked calibration, stage navigation without starting native work, staff-release waiting and the released-only Open rental action. No server endpoint, native dependency, permission flow or calibration threshold changed. Physical Android/iOS navigation, hardware Back and authenticated handover/release smoke checks remain pending. The later calibration visuals and automatic exercise-success transitions remain unimplemented in this phase.

Protocol 3 parked-noise calibration — 2026-10-17: the owner read model now
includes the accepted bounded `noiseBaseline` and derived Forward minimum.
Stationary measures the complete parked interval. In-progress protocol 1/2
calibrations restart at Stationary without deleting attempts; completed/released
histories remain intact. Staff release gates are unchanged; see
[calibration](telematics-calibration.md).

Background-sharing follow-up — 2026-10-18: the post-release sharing disclosure
now offers explicit foreground/background or foreground-only consent. This
does not change handover/release or pre-release setup/calibration. See
[background latest-location sharing](telematics-background-sharing.md).
