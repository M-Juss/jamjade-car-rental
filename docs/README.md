# JamJade documentation map

This directory is the navigation layer for JamJade's current contracts. Laravel code, Form Requests, Resources, services, and migration files remain authoritative; these guides explain the boundaries and evidence needed to work safely across the backend, web app, and mobile app.

## Sync note — 2026-10-14

This review reconciled the domain guides with the current repository code and migration source. It was documentation-only: it did not change application code, configuration, assets, persisted data, or external systems, and it did not rerun browser, emulator, provider, payment, or physical-device checks. Dated test and audit records remain attributed historical evidence. The current migration set is the source for schema direction; ERD counts and live-database snapshots are historical unless a guide explicitly records a later query.

## Start here

| Need | Guide |
| --- | --- |
| Current product direction, implementation boundaries, and capstone phases | [Project status and roadmap](project-status-and-roadmap.md) |
| Personnel roles, account lifecycle, and access rules | [User roles and access](user-roles-and-access.md) |
| Booking, payment, inspection, handover, return, and completion state | [Booking rental lifecycle](booking-rental-lifecycle.md) |

## Domain guides

| Guide | Read when | Current boundary |
| --- | --- | --- |
| [Delivery pricing](delivery-pricing.md) | Changing delivery routes, toll review, pricing, Maps retention, or quote consumption | Implemented in code; historical server/browser/Android checks are dated; live tolled approval, payment checkout, and iOS map verification remain unverified |
| [Geofence monitoring](geofence-monitoring.md) | Changing default zones, custom booking zones, release snapshots, or entry/exit events | Default/custom zones and server-side event evaluation are implemented; mobile collection, realtime alerts, and live Fleet Tracker remain pending |
| [Telematics architecture](telematics-architecture.md) | Changing the data boundary, setup/trip lifecycle, privacy, or AI readiness | Setup/trip foundation and six Phase 3 checks exist in code; calibration, active-trip mobile collection, and classification are planned |
| [Telematics handover lifecycle](telematics-handover-lifecycle.md) | Changing staff Start Handover, mobile setup reads/attempts, release, or local test mode | Staff-gated flow exists; standard mode remains calibration-gated, while local/testing mode is a bounded flow-testing exception |
| [Telematics device and location readiness](telematics-device-location.md) | Changing Expo permissions, GPS quality, background-task readiness, or setup evidence | Native readiness abstractions exist; no active tracking or calibration is implemented |
| [Physical telematics readiness checklist](telematics-device-test-checklist.md) | Recording Android or iOS device evidence | Evidence plan only; physical Android and iOS results remain pending |
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
| Booking creation, payment, return charges, or completion | [Booking rental lifecycle](booking-rental-lifecycle.md) → [Delivery pricing](delivery-pricing.md) when delivery is involved |
| Self-drive handover or release | [Booking rental lifecycle](booking-rental-lifecycle.md) → [Telematics handover](telematics-handover-lifecycle.md) → [Telematics architecture](telematics-architecture.md) |
| Mobile readiness, permissions, GPS, or physical testing | [Device and location readiness](telematics-device-location.md) → [Physical checklist](telematics-device-test-checklist.md) → [Handover lifecycle](telematics-handover-lifecycle.md) |
| Monitoring zones or crossing events | [Geofence monitoring](geofence-monitoring.md) → [Telematics architecture](telematics-architecture.md) → [Handover lifecycle](telematics-handover-lifecycle.md) |
| Vehicle inspections or current condition | [Vehicle condition architecture](vehicle-condition-architecture.md) → [Booking rental lifecycle](booking-rental-lifecycle.md) |
| Maintenance scheduling or completion | [Maintenance architecture](maintenance-architecture.md) → [Vehicle condition architecture](vehicle-condition-architecture.md) |
| Schema, migration, ERD, or retention work | [Canonical database ERD](ERD.md) → [Database audit](database-audit-erd-readiness.md) → [Normalization](database-normalization.md); use [ERD relationships](ERD-relationships.md) and [Presentation ERD](ERD-summary.md) for communication |

## Implemented and planned boundaries

Implemented in code: booking/payment lifecycle, Staff/Driver separation and account safeguards, Customer document verification contracts, immutable vehicle-condition snapshots, maintenance plans and records, delivery quotes and staff toll review, default/custom monitoring zones with release-time freezing, server-side crossing evaluation, and the pre-release telematics setup foundation.

Evidence or future work: physical Android/iOS readiness, real calibration capture, consented active-trip mobile collection, realtime/offline fleet presentation, labeled driving data, AI driving-event classification, and production retention/migration-baseline closure. The Fleet Tracker screen currently uses mock fleet/activity data. Video recording, uploads, auditing, and dashcam offerings remain out of scope.

When updating a guide, label a capability as implemented in code, physically verified, or planned. Preserve dates and attribution for historical browser, device, integration, and database checks, and update both the domain guide and this map when a contract or phase boundary changes.
