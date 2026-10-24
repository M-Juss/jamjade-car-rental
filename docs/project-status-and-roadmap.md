# Project status and roadmap

Last reconciled for telematics: **2026-10-24**. This documentation update does not
change application code, business rules, saved data, or native configuration.

## Product direction

JamJade uses Laravel for its authoritative API/domain layer, Next.js for Admin/Staff
management, and an Android-only Expo app for Customers and assigned Drivers.
iOS and mobile-browser targets are retired; the Next.js website remains supported.
See [Android-only scope](android-only-mobile.md).

The capstone's agreed telematics direction is an RC-validated motion-classification
prototype: reliable collection, inspectable raw/processed recordings, supervised
ML maneuver classification, website alerts, and an explainable post-drive score
and mobile report notification. Real-car rental operations remain separate from
RC experimental claims. No trained classifier or behavior score exists in the
inspected implementation.

**The [central telematics guide](telematics-master-plan.md) owns the complete
baseline, agreed requirements, target pipeline, UI, data contracts, implementation
sequence, and verification gates.** Earlier telematics phase narratives are
historical and archived; do not use them as competing plans.

## Current system

The business-domain rows below are retained from the existing roadmap; inspect
their domain guides and source before changing them. Telemetry rows were reconciled
during the current source review. Dated checks in other guides are not rerun here.

| Area | Current state |
| --- | --- |
| Accounts | Admin, Staff, Driver, and Customer are the current roles. Staff and Driver are fixed separate roles; Admin/Owner separation is deferred. Admin manages Staff and Driver accounts in Personnel. |
| Delivery pricing | Updated 2026-10-17: customer location confirmation returns one automatic driving estimate and ready quote. Customer maps show the fixed pin only; actual tolls are disclosed before booking and charged through the existing return-charge flow. Web Toll Reviews is removed. Accepted historical amounts remain fixed. See [delivery pricing](delivery-pricing.md) for verification and platform limits. |
| Booking and payment | Seat-based configurable late-return pricing, accepted booking policy snapshots, explicit physical receipt/late-charge review, dashboard attention and scheduled return reminders are implemented; see [late returns](late-return-workflow.md). Booking and payment states are separate. In standard mode, Start Rental requires a confirmed booking, full Customer payment, finalized Outgoing Inspection and required signatures, an eligible vehicle/operator, and ready telematics setup for both rental types. Local/testing handover mode relaxes selected Self Drive gates for flow testing while retaining real mount evidence and operational vehicle/conflict checks. Return-charge review and completion are explicit staff actions. |
| Verification | Staff manually review the required Customer documents in a centered Customer Verification dialog. Customer information appears first, and each document's metadata appears above its immediately visible front/back images; wider screens show both sides together, and phones stack them. Booking minimum age is 18. Self Drive requires only approved driver's license and proof of address. License numbers use uppercase letters/digits (maximum 11, excluding display hyphens), formatted like `N03-12-123456`. License front/back images are required; proof of address requires a main image with an optional back image. Address evidence may be a recent utility bill, billing statement, or official document showing the Customer's name and current residential address. Legacy passport records are preserved but no longer required or offered for upload. |
| Condition and maintenance | Current, Outgoing, and Incoming vehicle inspections are distinct snapshots. Maintenance plans and work records are implemented. Vehicle Management Configure provides an Admin-only shared option library with checklist-version checks and preserved historical labels; see [vehicle configuration](vehicle-configuration.md). |
| Geofences | Website-managed default circle/polygon monitoring zones apply automatically at release for both supported rental types. Admin can add custom booking zones before release; multiple zones are frozen for rental history. Updated 2026-10-19: consent version 3 connects foreground/background latest GPS to backend crossing detection, website activity and named Customer in-app alerts. No route history is collected. Physical crossing verification and phone push remain pending; see [geofences](geofence-monitoring.md). |
| Telematics | Existing setup/calibration and consented latest-GPS sharing are implemented; the research recorder is foreground/memory-only. Native durable motion recording, the web inspector, ML classification, scoring and reports are agreed targets, not implemented. See the [central guide](telematics-master-plan.md). |
| Fleet Monitoring | Ongoing-rental reads, authorized latest-location map and private Reverb invalidations are implemented. Connected AI event alerts are planned; physical end-to-end verification remains a separate gate. See [fleet baseline](telematics-master-plan.md#existing-fleet-monitoring). |
| Database | The migration files in this checkout are the source for the current schema. ERD diagrams and audits are dated documentation snapshots, and their historical table/column counts must not be read as current runtime counts. Retention and production migration-baseline issues remain open. |

See the [documentation index](README.md) for domain ownership. Booking payment,
inspection/signature, document, vehicle, role, and staff-release rules remain in
force. RC research does not require fabricated bookings or relaxed release gates.

## Financial document and payment policy

Payment-only issuance now creates an immutable Rental Information and Payment Receipt pair per successful Customer payment; existing historical documents are retained. Cancellation refunds are Admin decisions recorded separately from actual external money return; there is no required reference or PayPal refund integration. Staff-confirmed no-shows require the full unused rental interval to have ended and retain rental payments. New partial-payment deadlines are the beginning of the rental date in Asia/Manila. See [financial documents](booking-financial-documents.md) and [cancellation policy](booking-cancellation-policy.md).

## Telematics delivery sequence

| Increment | Status | Completion boundary |
| --- | --- | --- |
| Native acquisition and recording contract | Agreed target | Durable, versioned original sensor recordings; actual Redmi screen-lock/interruption checks |
| Recording inspection workflow | Agreed target | Unlabeled save, protected sample reads, waveform/quality review, observable upload states |
| Processing and export | Agreed target | Reproducible references, synchronization, filters, features and manifests |
| Dataset and classifier | Agreed target | Independent observed labels/session splits, baseline comparison, held-out metrics and automatic-reverse evaluation |
| Live events, report and score | Agreed target | Server-owned inference events, website alerts, deduplication, late-data finalization and report notification |

The first milestone is a real recording preserved through screen lock/network
loss, uploaded, and inspected on the website. October 31 is the working-prototype
target, not a model-accuracy guarantee. October 26 checking, the November mock,
and December defense are planning checkpoints recorded in the central guide.

## Evidence and update rules

- Distinguish implemented code, agreed direction, experimental settings, historical
  evidence, and pending verification. Do not mark a stage complete from schema or UI alone.
- Update the central guide and source contracts together; keep this roadmap a summary.
- Preserve Customer/assigned-Driver ownership, pre-release versus released-trip
  boundaries, one-trip behavior, frozen zones, and explicit collection consent.
- No current physical RC/model/background-motion validation was established in the
  source review. A limited historical stationary Android smoke result is attributed
  in the [central evidence section](telematics-master-plan.md#verification-and-historical-evidence).
- Video/audio recording and dashcam offerings remain outside scope. AI classifications
  and a project behavior score do not establish fault, accident probability, or charges.
