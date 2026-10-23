# JamJade documentation map

This directory is the navigation layer for JamJade's current contracts. Laravel code, Form Requests, Resources, services, and migration files remain authoritative; these guides explain the boundaries and evidence needed to work safely across the backend, web app, and mobile app.

## Sync note — 2026-10-14

This review reconciled the domain guides with the current repository code and migration source. It was documentation-only: it did not change application code, configuration, assets, persisted data, or external systems, and it did not rerun browser, emulator, provider, payment, or physical-device checks. Dated test and audit records remain attributed historical evidence. The current migration set is the source for schema direction; ERD counts and live-database snapshots are historical unless a guide explicitly records a later query.

## Start here

See [Mobile notifications](mobile-notifications.md) for the shared Customer/Driver preview, cursor pagination, and unread-count contracts.

Pending mobile booking screen refinements are recorded in
[Mobile booking form follow-up](mobile-booking-ui-follow-up.md), with the
2026-10-16 delivery-map crash investigation and the requested refactor scope.

| Need | Guide |
| --- | --- |
| Current product direction, implementation boundaries, and capstone phases | [Project status and roadmap](project-status-and-roadmap.md) |
| Personnel roles, account lifecycle, access rules, and management navigation counts | [User roles and access](user-roles-and-access.md) |
| Booking, payment, inspection, handover, return, and completion state; shared inspection/handover/release timing and the local/testing same-start-date allowance for both rental types | [Booking rental lifecycle](booking-rental-lifecycle.md) |

## Domain guides

Current mobile UI — 2026-10-19: [Telematics drawer and prepared GPS startup](telematics-mobile-dashboard.md) documents the dedicated screen, setup dialogs, booking activity and one-use consented startup after staff release. Physical Android/iOS validation remains pending.

With Assigned Driver adaptation — 2026-10-19: the assigned Driver enters the
shared telematics setup/activity flow from Services; the Customer remains the
operator for Self Drive. Staff release remains required, reassignment invalidates
operator readiness, and Customer terms disclose latest-location sharing. Physical
Driver-device validation remains pending; see [handover lifecycle](telematics-handover-lifecycle.md).

| Guide | Read when | Current boundary |
| --- | --- | --- |
| [Rental information and payment receipts](booking-financial-documents.md) | Changing rental-information/receipt generation, Customer mobile receipt access/download, payment email delivery, resends, or document retention | A matching Rental Information and Payment Receipt pair per successful payment, immutable private copies and preserved historical documents, Customer-owned mobile receipt reads/downloads, and per-payment delivery tracking; live email-provider checks remain separate |
| [Booking cancellation and refunds](booking-cancellation-policy.md) | Changing cancellation, no-show findings or external refund recording | Admin decides each cancellation refund; actual money return is recorded separately, without a required reference |
| [Late returns and booking attention](late-return-workflow.md) | Changing hourly pricing, physical receipt, overdue alerts, follow-up, or return charge review | Implemented in code; seat-based price snapshots, explicit receipt/review, guarded editing/deletion of ordinary open-review charges, atomic charge-finalization/return action, dashboard attention queue, and scheduled in-app reminders; physical mobile/payment verification remains separate |
| [Delivery pricing](delivery-pricing.md) | Changing delivery confirmation, estimates, pricing, toll charges, retention or quote consumption | One automatic estimate, pin-only customer map, deferred actual tolls and preserved accepted financial amounts; current verification is recorded in the domain guide |
| [Geofence monitoring](geofence-monitoring.md) | Changing default zones, custom booking zones, release snapshots, or entry/exit events | Default/custom release snapshots and latest-GPS entry/exit evaluation for both rental types are implemented; Customer and assigned Driver in-app alerts are implemented; physical crossing verification and phone push remain pending; polygons have no application-level point maximum |
| [Telematics architecture](telematics-architecture.md) | Changing the data boundary, setup/trip lifecycle, privacy, or AI readiness | Self Drive and assigned Driver setup/trip foundation, six Phase 3 checks, and foreground calibration captures exist in code; physical calibration/device validation and classification remain pending |
| [Fleet Monitoring](fleet-tracker.md) | Changing ongoing rental reads, tracking status, search/filter/pagination, or the management fleet screen | Real ongoing rentals, authorized latest-point map and private Reverb notices are implemented; physical end-to-end verification remains pending; explicit background mode is implemented |
| [Fleet map and realtime updates](fleet-monitoring-realtime.md) | Changing map reads, Reverb, private-channel authorization, sockets or deployment | Latest-point map, empty queued invalidations and authorized rereads; local Reverb transport verified |
| [Background latest-location sharing](telematics-background-sharing.md) | Changing native rental tasks, sharing modes, background consent or stop/restart behavior | Explicit background collection implemented; physical Android/iOS validation pending; no automatic cold restart |
| [Background-location permission preparation](telematics-background-permissions.md) | Changing released-rental background permission disclosure, ordering or recovery | Permission-only preparation; active collection is a separate explicit sharing action |
| [Foreground latest-location sharing](telematics-foreground-location.md) | Changing released-rental GPS consent, collection, latest-point storage, interruptions or expiry | Consented foreground GPS and encrypted latest-only updates are implemented; physical Android/iOS validation remains pending; explicit background mode and latest-point web map are implemented |
| [Telematics handover lifecycle](telematics-handover-lifecycle.md) | Changing staff Start Handover, Customer/Driver mobile setup reads/attempts, release, or local test mode | Staff-gated setup for both rental types; Customer Telematics tab and assigned Driver Services entry; standard mode remains calibration-gated; background collection is pending |
| [Telematics device and location readiness](telematics-device-location.md) | Changing Expo permissions, GPS quality, background-task readiness, or setup evidence | Six native readiness checks lead to separately consented foreground calibration; active tracking remains pending |
| [Telematics calibration](telematics-calibration.md) | Changing supervised pre-release calibration, motion summaries, mount reference, ordering, or retries | Five consented foreground capture steps and server evaluation exist in code; physical validation remains an evidence gate |
| [Calibration computation and sensor fusion](telematics-calibration-computation.md) | Explaining equations, units, parked noise, thresholds, sampling, or sensor-fusion claims | Protocol 3 mathematical reference; platform-processed inputs and geometric combination, without a custom continuous fusion estimator; physical threshold validation pending |
| [RC-car demonstration and validation](telematics-rc-demonstration.md) | Preparing the defense test platform, RC profile, trial conditions or evaluation claims | Local/testing RC revision 5: unchanged Stationary, first Forward sample ≥3 m/s² retained, evidence-based movement completion and server-owned provenance; physical validation pending |
| [RC Research data contract and collection protocol](rc-research-data-protocol.md) | Planning Admin research recording, labels, private datasets, export and future AI training | Single-page Data/Collect/Logout workflow, manually stopped foreground capture, private encrypted trial storage and explicit deletion implemented in code; physical verification, export and training remain pending |
| [Physical telematics readiness checklist](telematics-device-test-checklist.md) | Recording Android or iOS device evidence | Evidence plan only; physical Android and iOS results remain pending |
| [Vehicle configuration](vehicle-configuration.md) | Changing vehicle choice lists, checklist definitions, or Configure access | Admin-only persistent library; retained vehicle values, versioned checklist submissions, and immutable inspection labels |
| [Vehicle condition architecture](vehicle-condition-architecture.md) | Changing inspections, current condition, snapshots, signatures, or condition privacy | Immutable inspection snapshot architecture is implemented |
| [Maintenance architecture](maintenance-architecture.md) | Changing maintenance plans, work records, due state, availability, or condition-linked completion | Maintenance plan/record workflow is implemented; condition verification remains a separate snapshot transaction |

## Database and schema guides

| Guide | Use | Provenance |
| --- | --- | --- |
| [Canonical database ERD](ERD.md) | Full persisted relationship and bounded-context reference | Dated live-schema audit plus migration-source reconciliation; read its dates before treating counts as evidence |
| [Presentation ERD](ERD-summary.md) | A compact diagram for reports and presentations | Simplified view; live counts and source-inferred counts are explicitly dated |
| [ERD relationship guide](ERD-relationships.md) | Plain-language relationship lookup | Relationship prose; verify against the migration source when schema work changes |
| [Database audit and ERD readiness](database-audit-erd-readiness.md) | Column/index inventory, retention findings, and migration-baseline concerns | Historical audit and follow-up records; not a substitute for a current migration or database query |
| [Database normalization](database-normalization.md) | Why facts live in their current tables and which values are intentional projections | Design rationale; development-only migration policy and future production work are called out in the guide |

## Read by task

| Task | Read first |
| --- | --- |
| Account credentials, roles, personnel, or authorization | [User roles and access](user-roles-and-access.md) → [Project status](project-status-and-roadmap.md) |
| Booking creation, payment, return charges, or completion | [Late returns and booking attention](late-return-workflow.md) → [Booking rental lifecycle](booking-rental-lifecycle.md) → [Delivery pricing](delivery-pricing.md) when delivery is involved |
| Self-drive or With Assigned Driver handover/release | [Booking rental lifecycle](booking-rental-lifecycle.md) → [Telematics handover](telematics-handover-lifecycle.md) → [Telematics architecture](telematics-architecture.md) |
| Mobile readiness, permissions, GPS, or physical testing | [Device and location readiness](telematics-device-location.md) → [Physical checklist](telematics-device-test-checklist.md) → [Handover lifecycle](telematics-handover-lifecycle.md) |
| Calibration formulas, noise thresholds, sensor fusion, or methodology | [Calibration computation](telematics-calibration-computation.md) → [Calibration workflow and verification](telematics-calibration.md) |
| Monitoring zones or crossing events | [Geofence monitoring](geofence-monitoring.md) → [Telematics architecture](telematics-architecture.md) → [Handover lifecycle](telematics-handover-lifecycle.md) |
| Vehicle inspections or current condition | [Vehicle condition architecture](vehicle-condition-architecture.md) → [Booking rental lifecycle](booking-rental-lifecycle.md) |
| Maintenance scheduling or completion | [Maintenance architecture](maintenance-architecture.md) → [Vehicle condition architecture](vehicle-condition-architecture.md) |
| Schema, migration, ERD, or retention work | [Canonical database ERD](ERD.md) → [Database audit](database-audit-erd-readiness.md) → [Normalization](database-normalization.md); use [ERD relationships](ERD-relationships.md) and [Presentation ERD](ERD-summary.md) for communication |

## Implemented and planned boundaries

Implemented in code: booking/payment lifecycle, Staff/Driver separation and account safeguards, Customer document verification contracts, immutable vehicle-condition snapshots, maintenance plans and records, automatic delivery quotes and deferred actual toll charges, default/custom monitoring zones with release-time freezing, server-side crossing evaluation, and the shared Self Drive/With Assigned Driver telematics setup foundation.

Evidence or future work: physical Android/iOS readiness, physical calibration validation, physical foreground-GPS verification, consented background collection, realtime/offline fleet presentation, labeled driving data, AI driving-event classification, and production retention/migration-baseline closure. Fleet Monitoring now lists real ongoing rentals and saved tracking state; its map remains unavailable pending location collection and map integration. Video recording, uploads, auditing, and dashcam offerings remain out of scope.

When updating a guide, label a capability as implemented in code, physically verified, or planned. Preserve dates and attribution for historical browser, device, integration, and database checks, and update both the domain guide and this map when a contract or phase boundary changes.

Calibration UI update — 2026-10-17: the Stationary visual guide, live aggregate feedback, fresh-stream startup fix and confirmed-success transition are implemented in code. Forward now has its own visual guide; exercises 3–5 visual refinements and physical verification remain pending; see [calibration](telematics-calibration.md).

Historical Stationary timing update — 2026-10-17 (superseded): the earlier
continuous-valid-window timer reset after movement or stream loss. Protocol 3
below replaces that behavior with a complete parked measurement; see
[calibration](telematics-calibration.md).

Parked-noise update — 2026-10-17: protocol 3 measures a complete Stationary
interval, validates bounded noise statistics, and derives the Forward minimum
from an accepted baseline without loosening mount-quality caps. Earlier
continuous-green Stationary timing is superseded. Physical validation remains
pending; see [calibration](telematics-calibration.md).

Forward candidate retry fix — 2026-10-17: an inconsistent early window no longer
locks the learner; it keeps looking for a qualifying movement while preserving
all whole-capture quality evidence. Server limits remain unchanged; see
[calibration](telematics-calibration.md#forward-candidate-retries--2026-10-17).

Calibration update — 2026-10-18: movement captures finish once valid movement and
sampling evidence qualify, while Stationary retains its full measurement. All
five confirmed passes show a success animation; disclosure acceptance is remembered
per Customer/rental/profile/disclosure version. Implemented in code; physical
validation pending. See [calibration](telematics-calibration.md).
