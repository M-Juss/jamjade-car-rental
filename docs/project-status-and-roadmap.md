# JamJade project status and roadmap

Last reviewed: 2026-10-19. This page is the entry point for the current project direction. It summarizes decisions and implementation status; the linked domain guides and repository code define the detailed contracts. The earlier master project context is study history where it disagrees with this page or the current repository. The dated browser, Android emulator, backend, and integration results below are historical records attributed to their recorded dates; this update did not rerun historical checks or establish physical-device verification.

## Product direction

With Assigned Driver telematics — 2026-10-19: the self-drive setup, calibration, release gate, one-trip lifecycle and latest-location/geofence flow now also support the currently assigned Driver on With Assigned Driver rentals. The Driver enters through Services; Laravel keeps eligibility and staff release authoritative, and the Customer agreement discloses sharing latest vehicle location with JamJade staff and the Customer. Reassignment requires fresh setup by the new Driver. This is implemented in code; physical Android/iOS validation remains pending. See [handover lifecycle](telematics-handover-lifecycle.md) and [booking lifecycle](booking-rental-lifecycle.md).

Mobile Telematics — 2026-10-19: a dedicated map/drawer screen now groups Full details, Device setup and Activity, with checks/calibration in dialogs. Explicit GPS agreement during device setup can prepare one automatic start after server-confirmed staff release while the same screen/runtime remains active; cancellation, manual Stop, interruption and runtime loss require explicit recovery. Latest GPS only and in-app notifications remain the scope. See [the screen and consent contract](telematics-mobile-dashboard.md); physical Android/iOS validation remains pending.

Defense test platform decision — 2026-10-17: motion calibration will be evaluated
using a smartphone mounted on an RC car as a controlled prototype testbed.
Local/testing RC profile isolation and provenance are implemented. Revision 5
retains the first Forward sample reaching 3 m/s² through later fluctuations and uses evidence-based movement completion
with three-second maximum timeouts for steps 2–5; RC Forward uses acceleration
without a gyro/yaw gate, while Stationary checks remain unchanged. All five exercises show confirmed
success animations. Disclosure acceptance is remembered per Customer/rental/profile
and disclosure version.
These workflow settings still require physical trials and are not learned limits. RC-only
findings cannot establish full-size vehicle or AI classification accuracy.
See [RC demonstration and validation](telematics-rc-demonstration.md).

Mobile RC Research — 2026-10-18: normal mobile sign-in admits an existing active
Admin only in local/testing RC mode. The protected page now provides Data /
Collect / Logout navigation with Collect in the middle. Session setup with
movement dropdowns, manually stopped foreground recording, review and explicit
save stay inside Collect with back navigation and compact session summaries.
Laravel owns validation, private encrypted sample files, owner-bound paginated
trial reads, idempotent save and explicit deletion. Saved recordings remain until
the owning Admin deletes them. Unsaved raw data remains in memory only. No
automatic recording timer or automatic save is used. Physical Android/iOS and
end-to-end upload checks remain pending. Export, comparison/reference extensions
and the offline Random Forest baseline are future work; see the
[data contract and collection protocol](rc-research-data-protocol.md).

Released rental UI — 2026-10-18: Open rental now shows a mobile Telematics
dashboard with the vehicle, release/return timing, return location and an explicit
Not recording monitoring state in its initial increment. The subsequent increment
adds separately consented foreground latest-location sharing and the web
latest-point map with private Reverb notices. Explicit background sharing is also
implemented; physical end-to-end testing remains pending. See
[the screen contract](telematics-handover-lifecycle.md#released-rental-screen--2026-10-18).

JamJade has a Laravel API, a Next.js management website, and an Expo mobile app for Customers and assigned Drivers. Laravel remains authoritative for validation, authorization, booking transitions, payments, inspections, and telematics outcomes. The capstone's intended main feature is **AI driving-event classification for self-drive rentals**. That goal is agreed, but the classifier is not implemented; the isolated RC pilot collector is implemented in code and still requires physical validation.

Video recording, sending, uploads, auditing, and dashcam offerings are outside project scope. AI classification must use a separately designed, consent-based telematics data flow; it does not depend on video. A classified event is an observation, not an automatic fault finding, financial charge, or driver score. Marketing driving-insights copy is aspirational product presentation and is not evidence that a classifier or live trip feed exists.

## Current system

Financial document update — 2026-10-19: each successful Customer payment now issues matching Rental Information (including the accepted agreement) and Payment Receipt PDFs with the same receipt reference. New invoice issuance is removed. Each payment has an immutable context, retained private PDF pair, and independent email tracking. Existing emailed documents remain unchanged. See [rental information and payment receipts](booking-financial-documents.md).

| Area | Current state |
| --- | --- |
| Accounts | Admin, Staff, Driver, and Customer are the current roles. Staff and Driver are fixed separate roles; Admin/Owner separation is deferred. Admin manages Staff and Driver accounts in Personnel. |
| Delivery pricing | Updated 2026-10-17: customer location confirmation returns one automatic driving estimate and ready quote. Customer maps show the fixed pin only; actual tolls are disclosed before booking and charged through the existing return-charge flow. Web Toll Reviews is removed. Accepted historical amounts remain fixed. See [delivery pricing](delivery-pricing.md) for verification and platform limits. |
| Booking and payment | Seat-based configurable late-return pricing, accepted booking policy snapshots, explicit physical receipt/late-charge review, dashboard attention and scheduled return reminders are implemented; see [late returns](late-return-workflow.md). Booking and payment states are separate. In standard mode, Start Rental requires a confirmed booking, full Customer payment, finalized Outgoing Inspection and required signatures, an eligible vehicle/operator, and ready telematics setup for both rental types. Local/testing handover mode relaxes selected Self Drive gates for flow testing while retaining real mount evidence and operational vehicle/conflict checks. Return-charge review and completion are explicit staff actions. |
| Verification | Staff manually review the required Customer documents in a centered Customer Verification dialog. Customer information appears first, and each document's metadata appears above its immediately visible front/back images; wider screens show both sides together, and phones stack them. Booking minimum age is 18. Self Drive requires only approved driver's license and proof of address. License numbers use uppercase letters/digits (maximum 11, excluding display hyphens), formatted like `N03-12-123456`. License front/back images are required; proof of address requires a main image with an optional back image. Address evidence may be a recent utility bill, billing statement, or official document showing the Customer's name and current residential address. Legacy passport records are preserved but no longer required or offered for upload. |
| Condition and maintenance | Current, Outgoing, and Incoming vehicle inspections are distinct snapshots. Maintenance plans and work records are implemented. Vehicle Management Configure provides an Admin-only shared option library with checklist-version checks and preserved historical labels; see [vehicle configuration](vehicle-configuration.md). |
| Geofences | Website-managed default circle/polygon monitoring zones apply automatically at self-drive release. Admin can add custom booking zones before release; multiple zones are frozen for rental history. Updated 2026-10-19: consent version 3 connects foreground/background latest GPS to backend crossing detection, website activity and named Customer in-app alerts. No route history is collected. Physical crossing verification and phone push remain pending; see [geofences](geofence-monitoring.md). |
| Telematics | Pre-release setup is separate from the single allowed post-release trip for both rental types. The owning Customer operates Self Drive; the assigned Driver operates With Assigned Driver. Six device-readiness checks and five explicitly consented, supervised foreground calibration captures are implemented in code. All eleven effective results are required in standard mode; physical validation is still required. Stationary and Forward have visual/live guides; all five exercises have confirmed-success transitions. Movement captures finish on sufficient evidence, with maximum timeouts; disclosure agreement is remembered for the same operator and rental. See [calibration](telematics-calibration.md). Consented foreground and background latest-location sharing are implemented, with physical GPS verification pending. |
| Fleet Monitoring | Updated 2026-10-18: the management screen lists real ongoing rentals, including overdue/no-trip rentals, with server search/filter/pagination and saved tracking state. The map displays authorized latest points and receives private Reverb invalidations. Explicit background sharing is implemented; physical end-to-end validation and classification remain pending. See [Fleet Monitoring](fleet-tracker.md). |
| Database | The migration files in this checkout are the source for the current schema. ERD diagrams and audits are dated documentation snapshots, and their historical table/column counts must not be read as current runtime counts. Retention and production migration-baseline issues remain open. |

See [roles and access](user-roles-and-access.md), [booking lifecycle](booking-rental-lifecycle.md), [vehicle condition](vehicle-condition-architecture.md), [maintenance](maintenance-architecture.md), [telematics architecture](telematics-architecture.md), and the [database audit](database-audit-erd-readiness.md) for the detailed rules and limits.

A temporary local handover test mode can relax readiness gates for flow testing without fabricating check results. See [the test-mode sequence](telematics-handover-lifecycle.md#temporary-local-handover-testing). It does not complete calibration or active-trip collection.

## Agreed handover rule

Combined preparation — 2026-10-18: the self-drive web action finalizes signed Outgoing Inspection and starts handover in one transaction, then opens Setup. Existing signed records can continue without signing again. Phone checks/calibration and explicit staff release remain required. See [handover lifecycle](telematics-handover-lifecycle.md).

Outgoing timing — 2026-10-18: Outgoing Inspection now shares the handover/release timing rule for both rental types, including the bounded same-start-date allowance in local/testing. Future start dates and exact/elapsed return deadlines remain blocked. Existing finalized records and booked timestamps are preserved. See [booking lifecycle](booking-rental-lifecycle.md#readiness-and-release).

Timing-only local testing — 2026-10-17: `RENTAL_EARLY_START_TEST_MODE=true` allows early Outgoing Inspection, handover, mobile setup and release on the same rental start date while preserving all normal readiness, device and calibration gates for both rental types. Future dates and expired rentals remain blocked, booked timestamps remain unchanged, and production/staging ignore the flag. Keep the broader `TELEMATICS_HANDOVER_TEST_MODE=false` when testing the full setup flow. See [early-start setup](telematics-handover-lifecycle.md#local-early-start-timing-only).

Updated 2026-10-16: standard self-drive handover requires current server time inside the reserved interval `[rental_start_at, rental_end_at)`. A renter may collect on a later booked day. The arrival time is tentative within that interval; late collection does not change price or the return deadline. Payment, inspection, documents and real setup gates remain authoritative. Local/testing handover mode remains a bounded exception, not a production policy. Start Handover begins setup only; authorized Start Rental remains the final vehicle-release step.

For local testing with `TELEMATICS_HANDOVER_TEST_MODE=true`, Start Rental for both rental types, plus self-drive handover and mobile setup, may begin before the scheduled clock time on the same rental start date in Asia/Manila. With Assigned Driver retains all other release-readiness requirements. Later pickup inside the interval still works; future-date and expired bookings are blocked. The agreed start/end timestamps are preserved. The flag is ignored outside `local`/`testing` environments.

Payment-only issuance now creates an immutable Rental Information and Payment Receipt pair per successful Customer payment; existing historical documents are retained. Cancellation refunds are Admin decisions recorded separately from actual external money return; there is no required reference or PayPal refund integration. Staff-confirmed no-shows require the full unused rental interval to have ended and retain rental payments. New partial-payment deadlines are the beginning of the rental date in Asia/Manila. See [financial documents](booking-financial-documents.md) and [cancellation policy](booking-cancellation-policy.md).

Background permission preparation — 2026-10-18: the released rental Monitoring
card now reads background access and offers a platform-specific disclosure and
explicit permission preparation with Settings recovery. It does not activate
background collection or change foreground pause/resume. Physical Android/iOS
permission validation remains pending. See [permission preparation](telematics-background-permissions.md).

Background collection — 2026-10-18: explicit foreground-and-background GPS now
uses a visible native task and consent version 2, with foreground-only sharing
still available. Sessions stay in memory and never restart automatically after
runtime loss. Latest-only encrypted storage and Reverb/map reads are unchanged.
Physical Android/iOS lock/minimize/stop verification remains pending. See
[background sharing](telematics-background-sharing.md).

## Roadmap and evidence gate

| Stage | Status | Completion boundary |
| --- | --- | --- |
| Phase 1: telematics data foundation | Implemented in code | Setup sessions and attempts, geofence snapshots, one-trip constraint, location-point and significant-event storage. |
| Phase 2: staff handover and server-gated mobile access | Implemented in code | Staff starts an eligible handover; Laravel selects the Customer's Self Drive or assigned Driver's With Assigned Driver booking and explains authoritative eligibility. |
| Phase 3: real device readiness | Implemented in code; **physical validation pending** | Device, motion permission, foreground/background location, fresh GPS and phone mount must be checked on a real development build by the owning Customer or assigned Driver. No physical Android or iOS verification is recorded: Android testing was pending device availability and iOS validation is unconfirmed. Standard mode requires the subsequent real calibration stage; local/testing Self Drive handover mode retains its documented test exception. |
| Phase 4: real calibration | Implemented in code; physical validation pending | Consented, bounded foreground DeviceMotion captures, dynamic gravity/forward mount reference (flat, upright or tilted), five ordered server-evaluated steps, stale-context protection and interruption cleanup. Staff supervises a controlled area; Android/iOS physical results and threshold validation remain explicit evidence gates. See [calibration](telematics-calibration.md). |
| Phase 5: active-trip collection and fleet data | Dashboard, web rental list and foreground latest-location sharing implemented; physical validation pending | The released mobile screen offers explicit consented foreground GPS with encrypted latest-only storage, stop/resume and interruption handling for either rental type. Fleet Monitoring reads ongoing rentals and saved trip/location timestamps. Route history is not collected. Physical Android/iOS validation, explicit background sharing is implemented, with physical validation pending. Offline buffering remains a separate increment. The web latest-point map and private Reverb notices are implemented. Motion detection/classification is deferred pending a separately approved data design. See [foreground sharing](telematics-foreground-location.md). |
| Phase 6: labeled driving dataset | Planned | Collect and label real, safely obtained examples across trips, drivers, and devices where feasible; keep evaluation trips separate from training trips. |
| Phase 7: AI driving-event classification | **Main capstone goal; planned** | Define event classes and acceptance criteria from actual data, train an explainable baseline such as Random Forest, evaluate per-class results, and integrate defensible significant events through Laravel. No trained model or classifier currently exists. |
| Phase 8: event analytics | Planned | Present validated event trends and context. A driver score is a separate product and fairness decision, not implied by classification. |

The immediate evidence gate is Phase 3 physical testing, using the [Android and iOS checklist](telematics-device-test-checklist.md). Until those checks are run and recorded on physical devices, their result stays **pending**. Planning the later phases is useful, but implementation claims must follow real device and data evidence. Parked mode and offline queues need their own designs when the relevant phase begins. The approved latest-only realtime transport is documented in [Fleet Monitoring](fleet-monitoring-realtime.md).

## Rules for future project updates

- Record whether a capability is implemented in code, physically verified, or planned. Do not infer operational readiness from a schema, enum, endpoint, or mock screen.
- Scope telematics to Self Drive and With Assigned Driver, with the owning Customer or current assigned Driver as the operator; keep setup separate from the post-release trip.
- Do not store ordinary GPS route points as significant events or introduce raw motion streams, AI tables, or classifications before their phase has an approved data and privacy design.
- Recheck the repository and relevant domain guide before changing behavior. Update this page when a decision or phase status changes, and update the detailed guide when its contract changes.

Parked-noise calibration update — 2026-10-17: protocol 3 adds a fixed parked
measurement and bounded noise summaries; the server derives the Forward minimum
from an accepted baseline while preserving mount-quality caps. This supersedes
the continuous-green Stationary timer. Physical validation of noise margins and
existing thresholds remains pending; see [calibration](telematics-calibration.md).
The [computation and sensor-fusion reference](telematics-calibration-computation.md)
documents the current equations and units. We use platform-processed motion and
gravity-based geometric combination, without a custom continuous fusion estimator.
Forward candidate retry fix — 2026-10-17: rejected early direction windows reset
instead of locking out a later clean movement; all whole-capture quality gates
remain active. See [calibration](telematics-calibration.md#forward-candidate-retries--2026-10-17).
