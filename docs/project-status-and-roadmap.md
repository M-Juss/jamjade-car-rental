# JamJade project status and roadmap

Last reviewed: 2026-10-14. This page is the entry point for the current project direction. It summarizes decisions and implementation status; the linked domain guides and repository code define the detailed contracts. The earlier master project context is study history where it disagrees with this page or the current repository. The dated browser, Android emulator, backend, and integration results below are historical records attributed to their recorded dates; this documentation sync did not rerun them or establish physical-device verification.

## Product direction

JamJade has a Laravel API, a Next.js management website, and an Expo mobile app for Customers and assigned Drivers. Laravel remains authoritative for validation, authorization, booking transitions, payments, inspections, and telematics outcomes. The capstone's intended main feature is **AI driving-event classification for self-drive rentals**. That goal is agreed, but the classifier and the data collection it needs are not implemented yet.

Video recording, sending, uploads, auditing, and dashcam offerings are outside project scope. AI classification must use a separately designed, consent-based telematics data flow; it does not depend on video. A classified event is an observation, not an automatic fault finding, financial charge, or driver score. Marketing driving-insights copy is aspirational product presentation and is not evidence that a classifier or live trip feed exists.

## Current system

| Area | Current state |
| --- | --- |
| Accounts | Admin, Staff, Driver, and Customer are the current roles. Staff and Driver are fixed separate roles; Admin/Owner separation is deferred. Admin manages Staff and Driver accounts in Personnel. |
| Delivery pricing | Server road-distance quotes, customer route selection, separate staff toll review, and admin-only Management → Delivery Pricing are implemented. Google-reported toll routes require staff approval; routes without Google toll information issue a complete PHP 0 toll quote immediately under the 2026-10-13 decision. Prior local server, browser, and Android-emulator records dated 2026-10-13 report the configured garage/Maps integration, route selection, admin review queue, route map, and the no-toll path through Review Booking. Live approval of a tolled route, payment checkout, and iOS verification remain unverified. See [delivery pricing](delivery-pricing.md). |
| Booking and payment | Booking and payment states are separate. In standard mode, Start Rental requires a confirmed booking, full Customer payment, finalized Outgoing Inspection and required signatures, an eligible vehicle/operator, and ready telematics setup for Self Drive. Local/testing handover mode relaxes selected payment/inspection gates for flow testing while retaining real mount evidence and operational vehicle/conflict checks. Return-charge review and completion are explicit staff actions. |
| Verification | Staff manually review the required Customer documents. Booking minimum age is 18. Self Drive requires only approved driver's license and proof of address. License numbers use uppercase letters/digits (maximum 11, excluding display hyphens), formatted like `N03-12-123456`. License front/back images are required; proof of address requires a main image with an optional back image. Address evidence may be a recent utility bill, billing statement, or official document showing the Customer's name and current residential address. Legacy passport records are preserved but no longer required or offered for upload. |
| Condition and maintenance | Current, Outgoing, and Incoming vehicle inspections are distinct snapshots. Maintenance plans and work records are implemented. |
| Geofences | Website-managed default circle/polygon monitoring zones apply automatically at self-drive release. Admin can add custom booking zones before release; multiple zones are frozen for rental history. Backend entry/exit detection and booking activity are implemented; continuous mobile tracking and realtime alerts remain pending. |
| Telematics | Pre-release setup is separate from the single allowed post-release trip. Six device-readiness checks are implemented in code; five calibration step types exist but calibration capture is not implemented. Standard mode therefore remains blocked before release; local/testing handover mode can exercise release after a real passing phone-mount attempt without fabricating other results. Trip and location backend capacity exists, but the mobile app does not run active-trip telemetry. |
| Fleet Tracker | The management screen exists and can display a map, but its fleet and behavior data are mock data, not a live trip feed. |
| Database | The migration files in this checkout are the source for the current schema. ERD diagrams and audits are dated documentation snapshots, and their historical table/column counts must not be read as current runtime counts. Retention and production migration-baseline issues remain open. |

See [roles and access](user-roles-and-access.md), [booking lifecycle](booking-rental-lifecycle.md), [vehicle condition](vehicle-condition-architecture.md), [maintenance](maintenance-architecture.md), [telematics architecture](telematics-architecture.md), and the [database audit](database-audit-erd-readiness.md) for the detailed rules and limits.

A temporary local handover test mode can relax readiness gates for flow testing without fabricating check results. See [the test-mode sequence](telematics-handover-lifecycle.md#temporary-local-handover-testing). It does not complete calibration or active-trip collection.

## Agreed handover rule

In standard mode, staff may start a self-drive handover only when `rental_start_at` falls on the **current calendar date in Asia/Manila**. The scheduled clock time need not have arrived. A future-date booking is not eligible. Laravel checks this date and the other handover requirements; the phone clock does not decide eligibility. Local/testing handover test mode explicitly relaxes this date and selected readiness gates for flow testing; it is not a production rule. Do not change the standard date rule to exact-time or lead-window eligibility without a later decision. Start Handover begins setup only; the authorized Start Rental action remains the final vehicle-release step.

## Roadmap and evidence gate

| Stage | Status | Completion boundary |
| --- | --- | --- |
| Phase 1: telematics data foundation | Implemented in code | Setup sessions and attempts, geofence snapshots, one-trip constraint, location-point and significant-event storage. |
| Phase 2: staff handover and server-gated mobile access | Implemented in code | Staff starts an eligible handover; Laravel selects and explains the renter's applicable self-drive booking. |
| Phase 3: real device readiness | Implemented in code; **physical validation pending** | Device, motion permission, foreground/background location, fresh GPS and phone mount must be checked on a real development build. No physical Android or iOS verification is recorded: Android testing was pending device availability and iOS validation is unconfirmed. Standard mode remains blocked by pending calibration; local/testing handover mode is the documented test exception. |
| Phase 4: real calibration | Planned | Design and verify phone-to-vehicle orientation and the required stationary, forward, braking, left-turn, and right-turn checks. Do not mark setup ready through simulated results. |
| Phase 5: active-trip collection and fleet data | Planned | After authorized release and informed consent, design location/motion collection, interruptions, offline handling, retention, and live fleet presentation. Backend trip endpoints and tables alone do not complete this phase. |
| Phase 6: labeled driving dataset | Planned | Collect and label real, safely obtained examples across trips, drivers, and devices where feasible; keep evaluation trips separate from training trips. |
| Phase 7: AI driving-event classification | **Main capstone goal; planned** | Define event classes and acceptance criteria from actual data, train an explainable baseline such as Random Forest, evaluate per-class results, and integrate defensible significant events through Laravel. No trained model or classifier currently exists. |
| Phase 8: event analytics | Planned | Present validated event trends and context. A driver score is a separate product and fairness decision, not implied by classification. |

The immediate evidence gate is Phase 3 physical testing, using the [Android and iOS checklist](telematics-device-test-checklist.md). Until those checks are run and recorded on physical devices, their result stays **pending**. Planning the later phases is useful, but implementation claims must follow real device and data evidence. Parked mode, realtime transport, and offline queues need their own designs when the relevant phase begins.

## Rules for future project updates

- Record whether a capability is implemented in code, physically verified, or planned. Do not infer operational readiness from a schema, enum, endpoint, or mock screen.
- Keep self-drive telematics separate from assigned-Driver services and keep setup separate from the post-release trip.
- Do not store ordinary GPS route points as significant events or introduce raw motion streams, AI tables, or classifications before their phase has an approved data and privacy design.
- Recheck the repository and relevant domain guide before changing behavior. Update this page when a decision or phase status changes, and update the detailed guide when its contract changes.
