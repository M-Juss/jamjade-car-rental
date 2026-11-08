# Project status and roadmap

Last reconciled for telematics: **2026-11-06**. Phase 1 definitions are complete;
**Phase 2 pilot collection is implemented** in native/mobile/Laravel code, with
Collect/Recordings, durable sessions/mount versions, consented bounded setup evidence,
versioned protocols, compact aliases and separately saved/synced observations.
Catalog v3 adds a Normal or Harsh attempt selection to Left and Right Turn
collection. Reviewed turn severity remains an independent annotation.
See the [central guide](telematics-master-plan.md#phase-2-pilot-implementation-current-runtime-boundary)
for active DTOs and limitations. Installation/physical acceptance on the Redmi,
validated alignment/check limits, explicit server session closure/reopening,
separate v2 confidence and dataset export remain pending. The web review now uses
Check recording → Prepare signals → Label and review, with owner-bound collection/
observation/reference checks and Details for diagnostics. New guided mobile
maneuver captures require a prior local forward reference for the active mount;
this does not certify alignment or data usability.
FSS and normal-LT draft timestamp proposals are available in the website label editor;
operators still select event judgments and explicitly save. No capture is
automatically accepted for training.

Current implemented telematics includes native v2 collection,
explicit resumable upload, server verification, protected native signal review
and stationary/forward-reference preparation with automatic interval suggestions,
separate Signals/Prepare data tabs, and saved bounded server processing runs with run-specific
references and experimental reuse for a separate maneuver trial, plus encrypted
revisioned interval labels with explicit source and uncertainty. Reusable accepted
calibration, validated filter settings, full-recording processing/export,
AI and broader Redmi validation remain pending. An offline changing-gravity
experiment reduced resting shifts but changed moving peaks; it has not replaced
the app pipeline. See the central guide for the 035 held-press/release evidence.
Rental-release behavior is unchanged.

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
| Telematics | Existing rental setup/calibration and latest-GPS sharing are preserved. RC Collect uses native v2 recording, encrypted originals, explicit resumable chunk upload and server verification. The owner-bound Admin inspector supports original signals/timing, experimental bounded saved processing and encrypted revisioned interval labels. Labels record source/uncertainty separately from training approval. The v1 tab and old local development v1 data were retired at the user's request, with a private encrypted recovery copy. Automatic background transfer, validated preprocessing, dataset export, ML, scoring and reports remain targets; broader physical validation remains pending. See the [central guide](telematics-master-plan.md). |
| Fleet Monitoring | Ongoing-rental reads, authorized latest-location map and private Reverb invalidations are implemented. Connected AI event alerts are planned; physical end-to-end verification remains a separate gate. See [fleet baseline](telematics-master-plan.md#existing-fleet-monitoring). |
| Database | The migration files in this checkout are the source for the current schema. ERD diagrams and audits are dated documentation snapshots, and their historical table/column counts must not be read as current runtime counts. Retention and production migration-baseline issues remain open. |

See the [documentation index](README.md) for domain ownership. Booking payment,
inspection/signature, document, vehicle, role, and staff-release rules remain in
force. RC research does not require fabricated bookings or relaxed release gates.

## Financial document and payment policy

Payment-only issuance now creates an immutable Rental Information and Payment Receipt pair per successful Customer payment; existing historical documents are retained. Cancellation refunds are Admin decisions recorded separately from actual external money return; there is no required reference or PayPal refund integration. Staff-confirmed no-shows require the full unused rental interval to have ended and retain rental payments. New partial-payment deadlines are the beginning of the rental date in Asia/Manila. See [financial documents](booking-financial-documents.md) and [cancellation policy](booking-cancellation-policy.md).

## Telematics delivery sequence

The collection-workflow redesign has its own five-phase delivery breakdown:
**1 contracts (defined), 2 mobile, 3 web review, 4 dataset export, 5 verification**.
This is separate from the broader capstone increments below. Contract schemas
are design artifacts, not active endpoints or physical-validation evidence.

| Increment | Status | Completion boundary |
| --- | --- | --- |
| Native acquisition and recording contract | Native v2 recorder/export APK, fixed preset, durable groups/numbering, phone power and short stationary/locked smoke checks | Physical axes, controlled noise characterization, longer background and interruption checks remain required |
| Recording inspection workflow | Native v2 original-signal inspection and revisioned interval-label editor are implemented; legacy v1 navigation retired | Explicit upload/retry, encrypted originals, bounded native windows and source/uncertainty-aware label revisions implemented; reviewed trial labels, automatic background transfer and remote deletion UI pending |
| Processing and export | Reference preparation plus saved/versioned bounded server synchronization → filtering → vehicle axes, including explicit experimental reference reuse for maneuver trials; Signals opens the latest result and exposes comparison on demand | Accepted reusable alignment, full-recording/live state, dynamic gravity correction, validated filters, features and export remain pending |
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
