# JamJade documentation map

Laravel source, Form Requests, Resources, services, and migrations establish the
implemented contracts. Documentation distinguishes implemented code, agreed plans,
experimental settings, and dated verification; none is evidence of another.

## Start here

| Need | Active guide |
| --- | --- |
| Project-wide direction and stage status | [Project status and roadmap](project-status-and-roadmap.md) |
| Telematics, RC research, collection/inspection UI, calibration, fleet monitoring, AI and scoring | [Telematics and RC Research: central implementation guide](telematics-master-plan.md) |
| Android-only configuration, builds, and dated platform checks | [Android-only mobile scope](android-only-mobile.md) |
| Roles and authorization | [User roles and access](user-roles-and-access.md) |
| Booking, inspection, handover, return, payment and completion | [Booking rental lifecycle](booking-rental-lifecycle.md) |

`mobile-frontend` supports Android only. iOS and mobile-browser targets are
retired; the separate Next.js website remains supported.

## Domain guides

The central telematics guide is the only active pipeline/roadmap reference for
that domain. Unrelated guides below remain authoritative for their own contracts.

Its [Phase 1 collection contract](telematics-master-plan.md#collection-workflow-redesign-phase-1-contract)
defines the agreed RC workflow redesign. The linked JSON catalog/schema/examples
remain machine-checked design artifacts. The central guide’s Phase 2 runtime
boundary records the implemented pilot collection flow and narrower authoritative
write DTOs; the three-step web review is implemented, while broader Redmi physical
acceptance, v2 label confidence/dataset decisions and export remain pending.

| Guide | Read when | Current boundary |
| --- | --- | --- |
| [Rental information and payment receipts](booking-financial-documents.md) | Changing rental-information/receipt generation, Customer mobile receipt access/download, payment email delivery, resends, or document retention | A matching Rental Information and Payment Receipt pair per successful payment, immutable private copies and preserved historical documents, Customer-owned mobile receipt reads/downloads, and per-payment delivery tracking; live email-provider checks remain separate |
| [Booking cancellation and refunds](booking-cancellation-policy.md) | Changing cancellation, no-show findings or external refund recording | Admin decides each cancellation refund; actual money return is recorded separately, without a required reference |
| [Late returns and booking attention](late-return-workflow.md) | Changing hourly pricing, physical receipt, overdue alerts, follow-up, or return charge review | Implemented in code; seat-based price snapshots, explicit receipt/review, guarded editing/deletion of ordinary open-review charges, atomic charge-finalization/return action, dashboard attention queue, and scheduled in-app reminders; physical mobile/payment verification remains separate |
| [Delivery pricing](delivery-pricing.md) | Changing delivery confirmation, estimates, pricing, toll charges, retention or quote consumption | One automatic estimate, pin-only customer map, deferred actual tolls and preserved accepted financial amounts; current verification is recorded in the domain guide |
| [Geofence monitoring](geofence-monitoring.md) | Changing default zones, custom booking zones, release snapshots, or entry/exit events | Default/custom release snapshots and latest-GPS entry/exit evaluation for both rental types are implemented; Customer and assigned Driver in-app alerts are implemented; physical crossing verification and phone push remain pending; polygons have no application-level point maximum |
| [Vehicle configuration](vehicle-configuration.md) | Changing vehicle choice lists, checklist definitions, or Configure access | Admin-only persistent library; retained vehicle values, versioned checklist submissions, and immutable inspection labels |
| [Vehicle condition architecture](vehicle-condition-architecture.md) | Changing inspections, current condition, snapshots, signatures, or condition privacy | Immutable inspection snapshot architecture is implemented |
| [Maintenance architecture](maintenance-architecture.md) | Changing maintenance plans, work records, due state, availability, or condition-linked completion | Maintenance plan/record workflow is implemented; condition verification remains a separate snapshot transaction |
| [Mobile notifications](mobile-notifications.md) | Changing Customer/Driver feeds, unread counts or booking activity | Existing in-app records; report-ready notifications and remote push are distinct planned capabilities |
| [Mobile booking UI follow-up](mobile-booking-ui-follow-up.md) | Reviewing pending booking-screen refinements | Dated investigation and requested UI follow-up; inspect current code before implementing |

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
| Website visual hierarchy, shared controls, responsive records or public presentation | [Web interface refinement](web-ui-refinement.md), then `web-frontend/AGENTS.md` and the affected domain guide |
| Telematics, native sensors, RC data, calibration, GPS, fleet alerts, AI, score or reports | [Central telematics guide](telematics-master-plan.md), then the applicable linked source files |
| Android configuration or native builds | [Android-only scope](android-only-mobile.md), application `AGENTS.md`, and exact installed Expo SDK documentation |
| Monitoring zones or crossing events | [Geofence monitoring](geofence-monitoring.md) and [existing telematics boundaries](telematics-master-plan.md#existing-rental-and-handover-boundaries) |
| Accounts, credentials, roles or personnel | [Roles and access](user-roles-and-access.md) |
| Booking, payment, return charges or completion | [Booking lifecycle](booking-rental-lifecycle.md), [late returns](late-return-workflow.md), and [delivery pricing](delivery-pricing.md) where applicable |
| Vehicle inspections or current condition | [Vehicle condition](vehicle-condition-architecture.md) and [booking lifecycle](booking-rental-lifecycle.md) |
| Vehicle catalogs and inspection definitions | [Vehicle configuration](vehicle-configuration.md) |
| Maintenance | [Maintenance architecture](maintenance-architecture.md) |
| Schema or migrations | [ERD](ERD.md), [database audit](database-audit-erd-readiness.md), and current migrations |

## Documentation maintenance

Update domain status and its source references together when implementation changes.
Keep this index short; do not append competing dated telematics plans here.
Historical result counts must retain their dates and must not be reported as newly run.

The fourteen prior telematics/research/fleet guides are retained in the
[historical archive](archive/telematics-2026-10-24/README.md). They are not required
coding input and cannot override the central guide or verified current contracts.
