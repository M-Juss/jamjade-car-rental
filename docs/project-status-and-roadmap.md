# JamJade project status and roadmap

Last reviewed: 2026-10-01. This page is the entry point for the current project direction. It summarizes decisions and implementation status; the linked domain guides and repository code define the detailed contracts. The earlier master project context is study history where it disagrees with this page or the current repository.

## Product direction

JamJade has a Laravel API, a Next.js management website, and an Expo mobile app for Customers and assigned Drivers. Laravel remains authoritative for validation, authorization, booking transitions, payments, inspections, and telematics outcomes. The capstone's intended main feature is **AI driving-event classification for self-drive rentals**. That goal is agreed, but the classifier and the data collection it needs are not implemented yet.

Video recording, sending, uploads, auditing, and dashcam offerings are outside project scope. AI classification must use a separately designed, consent-based telematics data flow; it does not depend on video. A classified event is an observation, not an automatic fault finding, financial charge, or driver score.

## Current system

| Area | Current state |
| --- | --- |
| Accounts | Admin, Staff, Driver, and Customer are the current roles. Staff and Driver are fixed separate roles; Admin/Owner separation is deferred. Admin manages Staff and Driver accounts in Personnel. |
| Booking and payment | Booking and payment states are separate. Start Rental requires a confirmed booking, full Customer payment, finalized Outgoing Inspection and required signatures, an eligible vehicle/operator, and ready telematics setup for Self Drive. Return-charge review and completion are explicit staff actions. |
| Verification | Staff manually review the required Customer documents. Booking minimum age is 18. Self Drive requires approved driver's license and proof of billing, plus a passport when the Customer is flagged as requiring one. |
| Condition and maintenance | Current, Outgoing, and Incoming vehicle inspections are distinct snapshots. Maintenance plans and work records are implemented. |
| Geofences | Reusable circle and polygon templates and one immutable booking-specific boundary snapshot are implemented. Multiple zones and expressway corridors are not implemented. |
| Telematics | Pre-release setup is separate from the single allowed post-release trip. Seven device-readiness checks are implemented in code; five calibration step types exist but calibration capture is not implemented. Trip and location backend capacity exists, but the mobile app does not run active-trip telemetry. |
| Fleet Tracker | The management screen exists and can display a map, but its fleet and behavior data are mock data, not a live trip feed. |
| Database | The local migration status on 2026-10-01 showed 38 applied migrations. The 45-table physical ERD was audited earlier; its historical audit counts should be read with their dates. Retention and production migration-baseline issues remain open. |

See [roles and access](user-roles-and-access.md), [booking lifecycle](booking-rental-lifecycle.md), [vehicle condition](vehicle-condition-architecture.md), [maintenance](maintenance-architecture.md), [telematics architecture](telematics-architecture.md), and the [database audit](database-audit-erd-readiness.md) for the detailed rules and limits.

## Agreed handover rule

For testing, staff may start a self-drive handover only when `rental_start_at` falls on the **current calendar date in Asia/Manila**. The scheduled clock time need not have arrived. A future-date booking is not eligible. Laravel checks this date and the other handover requirements; the phone clock does not decide eligibility. This is the current implemented and agreed rule. Do not change it to exact-time or lead-window eligibility without a later decision. Start Handover begins setup only; the authorized Start Rental action remains the final vehicle-release step.

## Roadmap and evidence gate

| Stage | Status | Completion boundary |
| --- | --- | --- |
| Phase 1: telematics data foundation | Implemented in code | Setup sessions and attempts, geofence snapshots, one-trip constraint, location-point and significant-event storage. |
| Phase 2: staff handover and server-gated mobile access | Implemented in code | Staff starts an eligible handover; Laravel selects and explains the renter's applicable self-drive booking. |
| Phase 3: real device readiness | Implemented in code; **physical validation pending** | Device, motion permission, foreground/background location, fresh GPS, server-side geofence check, and phone mount must be checked on a real development build. The owner has not completed Android testing because an Android device is currently unavailable. iOS physical validation is also unconfirmed. Calibration remains pending and Start Rental remains blocked. |
| Phase 4: real calibration | Planned | Design and verify phone-to-vehicle orientation and the required stationary, forward, braking, left-turn, and right-turn checks. Do not mark setup ready through simulated results. |
| Phase 5: active-trip collection and fleet data | Planned | After authorized release and informed consent, design location/motion collection, interruptions, offline handling, retention, and live fleet presentation. Backend trip endpoints and tables alone do not complete this phase. |
| Phase 6: labeled driving dataset | Planned | Collect and label real, safely obtained examples across trips, drivers, and devices where feasible; keep evaluation trips separate from training trips. |
| Phase 7: AI driving-event classification | **Main capstone goal; planned** | Define event classes and acceptance criteria from actual data, train an explainable baseline such as Random Forest, evaluate per-class results, and integrate defensible significant events through Laravel. No trained model or classifier currently exists. |
| Phase 8: event analytics | Planned | Present validated event trends and context. A driver score is a separate product and fairness decision, not implied by classification. |

The immediate evidence gate is Phase 3 physical testing, using the [Android checklist](telematics-device-test-checklist.md). Until a device is available, its result stays **pending**. Planning the later phases is useful, but implementation claims must follow real device and data evidence. Multi-zone geofences, parked mode, realtime transport, and offline queues need their own designs when the relevant phase begins.

## Rules for future project updates

- Record whether a capability is implemented in code, physically verified, or planned. Do not infer operational readiness from a schema, enum, endpoint, or mock screen.
- Keep self-drive telematics separate from assigned-Driver services and keep setup separate from the post-release trip.
- Do not store ordinary GPS route points as significant events or introduce raw motion streams, AI tables, or classifications before their phase has an approved data and privacy design.
- Recheck the repository and relevant domain guide before changing behavior. Update this page when a decision or phase status changes, and update the detailed guide when its contract changes.
