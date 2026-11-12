# Project status and roadmap

Last reconciled for telematics: **2026-11-10**. Phase 1 definitions are complete;
**Phase 2 pilot collection is implemented** in native/mobile/Laravel code, with
Collect/Recordings, durable sessions/mount versions, consented bounded setup evidence,
versioned protocols, compact aliases and separately saved/synced observations.
Catalog v5 offers Lane Change and uses the same Normal or Harsh attempt selector
for left/right turns and obstacle-avoidance swerves. Reviewed severity remains an
independent annotation. Catalog v6 adds Mixed Drive for continuous replay
evaluation with separate review labels for each maneuver.
See the [central guide](telematics-master-plan.md#phase-2-pilot-implementation-current-runtime-boundary)
for active DTOs and limitations. Installation/physical acceptance on the Redmi,
validated alignment/check limits, explicit server session closure/reopening,
separate v2 confidence and general web dataset approval/export remain pending. The web review now uses
Check recording → Prepare signals → Label and review, with owner-bound collection/
observation/reference checks and Details for diagnostics. New guided mobile
maneuver captures require a prior local forward reference for the active mount;
this does not certify alignment or data usability.
FSS and normal-LT draft timestamp proposals are available in the website label editor;
operators still select event judgments and explicitly save. No capture is
automatically accepted for training.

The collection phase is closed at the operator's request. The selected capstone
baseline is the frozen 35-feature random forest trained on 353 development
intervals from 144 recordings. Frozen pilot v3 holds 76 evaluation recordings
from S04/S06/S08. Its saved evaluation classified 197/201 manually bounded
intervals correctly (98.01% accuracy, 0.9545 macro F1). Session 10 provides
limited continuous-replay checks and informed experimental alert grouping,
swerve separation and braking ambiguity handling. Those replay results have
a different scope from the isolated-interval evaluation.
See the [central baseline](telematics-master-plan.md#capstone-baseline-collection-close--2026-11-10)
for fixed settings, evidence, limits and integration work.

Current implemented telematics includes native v2 collection,
explicit resumable upload, server verification, protected native signal review
and stationary/forward-reference preparation with automatic interval suggestions,
separate Signals/Prepare data tabs, and saved bounded server processing runs with run-specific
references and experimental reuse for a separate maneuver trial, plus encrypted
revisioned interval labels with explicit source and uncertainty. Reusable accepted
calibration, validated filter settings, general full-recording processing/export,
Admin RC Drive Monitoring now connects native filtered windows to the frozen
forest, encrypted session/batch receipts and grouped website events. Its updated
standalone APK is installed. The first rental RC integration now binds separately
consented motion segments to the existing released trip and shows events in Fleet
Monitoring. Physical rental acceptance and dynamic remount realignment remain
pending; see the central rental motion contract. An offline changing-gravity
experiment reduced resting shifts but changed moving peaks; it has not replaced
the app pipeline. See the central guide for the 035 held-press/release evidence.
Rental-release behavior is unchanged.

Rental calibration checklist update — 2026-11-09: six device checks now lead to
stationary and forward reference only, with profile revisions standard 5 / RC 6.
The shorter checklist still requires Staff Start Rental for release. Retired
braking/turn attempts remain historical; new captures for those rental steps are
rejected. The pre-release capture now uses native Android sensors through
protocol 4 and profile revisions standard 6 / RC 7. Physical verification,
the first connected rental motion/AI integration is implemented with separate
consent; physical rental acceptance remains pending. See the
[native calibration contract](telematics-master-plan.md#native-pre-release-calibration).

## Product direction

Deployment preparation — 2026-11-12: the selected target is BerryPanel using the
existing repository's `main` branch and `jamjadecarrental.tech` with Hostinger DNS.
Hosted RC Research/Model Explorer/motion require the explicit opt-in documented
in the [central guide](telematics-master-plan.md#hosted-rc-demo-deployment--2026-11-12).
The [deployment guide](deployment-berrypanel.md) records setup and pending host
capabilities; this is not a completed public deployment.

JamJade uses Laravel for its authoritative API/domain layer, Next.js for Admin/Staff
management, and an Android-only Expo app for Customers and assigned Drivers.
iOS and mobile-browser targets are retired; the Next.js website remains supported.
See [Android-only scope](android-only-mobile.md).

The capstone's agreed telematics direction is an RC-validated motion-classification
prototype: reliable collection, inspectable raw/processed recordings, supervised
ML maneuver classification, website alerts, and an explainable post-drive score
and mobile report notification. Real-car rental operations remain separate from
RC experimental claims. Offline fitted classifier candidates now exist; live
inference is connected. Completed rentals with motion sessions get a saved RC
grade once sync closes or the upload deadline passes. The web detail and
operator overviews use final grades, and the main mobile inbox receives the
grade, calculation and summary. See [Final driving reports](telematics-master-plan.md#final-driving-reports--2026-11-12).

Admin Model Explorer now explains owner-bound saved development examples from
the pinned frozen split, including prepared signals, feature calculations,
observed class ranges and exact selected-tree traversal. It is local-only and
read-only; it does not retrain or alter the classifier. See the [central guide](telematics-master-plan.md#model-development-navigation--2026-11-11).
Drive Monitoring remains implemented but is temporarily hidden from the Admin
sidebar; see the [navigation note](telematics-master-plan.md#drive-monitoring-sidebar-visibility--2026-11-12).

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
| Accounts | Admin, Staff, Driver, and Customer are the current roles. Staff and Driver are fixed separate roles; The identified Owner also has Admin access; selected financial and pricing writes require owner email verification. Admin manages Staff and Driver accounts in Personnel. |
| Delivery pricing | Updated 2026-10-17: customer location confirmation returns one automatic driving estimate and ready quote. Customer maps show the fixed pin only; actual tolls are disclosed before booking and charged through the existing return-charge flow. Web Toll Reviews is removed. Accepted historical amounts remain fixed. See [delivery pricing](delivery-pricing.md) for verification and platform limits. |
| Booking and payment | Seat-based configurable late-return pricing, accepted booking policy snapshots, explicit physical receipt/late-charge review, dashboard attention and scheduled return reminders are implemented; see [late returns](late-return-workflow.md). Booking and payment states are separate. In standard mode, Start Rental requires a confirmed booking, full Customer payment, finalized Outgoing Inspection and required signatures, an eligible vehicle/operator, and ready telematics setup for both rental types. Local/testing handover mode relaxes selected Self Drive gates for flow testing while retaining real mount evidence and operational vehicle/conflict checks. Return-charge review and completion are explicit staff actions. |
| Verification | Staff manually review the required Customer documents in a centered Customer Verification dialog. Customer information appears first, and each document's metadata appears above its immediately visible front/back images; wider screens show both sides together, and phones stack them. Booking minimum age is 18. Self Drive requires an approved driver's license, approved proof of address, and an emergency contact with a name, relationship, and phone number. License numbers use uppercase letters/digits (maximum 11, excluding display hyphens), formatted like `N03-12-123456`. License front/back images are required; proof of address requires a main image with an optional back image. Address evidence may be a recent utility bill, billing statement, or official document showing the Customer's name and current residential address. Legacy passport records are preserved but no longer required or offered for upload. |
| Condition and maintenance | Current, Outgoing, and Incoming vehicle inspections are distinct snapshots. Maintenance plans and work records are implemented. Vehicle Management Configure provides an Admin-only shared option library with checklist-version checks and preserved historical labels; see [vehicle configuration](vehicle-configuration.md). |
| Geofences | Website-managed default circle/polygon monitoring zones apply automatically at release for both supported rental types. Admin can add custom booking zones before release; multiple zones are frozen for rental history. Updated 2026-10-19: consent version 3 connects foreground/background latest GPS to backend crossing detection, website activity and named Customer in-app alerts. No route history is collected. Physical crossing verification and phone push remain pending; see [geofences](geofence-monitoring.md). |
| Telematics | Existing rental setup/calibration and latest-GPS sharing are preserved. RC Collect uses native v2 recording, encrypted originals, explicit resumable upload and server verification. The owner-bound Admin inspector supports original signals/timing, experimental bounded processing and encrypted revisioned labels. A local encrypted frozen-pilot interval export is implemented. Labels remain separate from training approval. The first released-rental RC feature/AI connection is implemented with separate consent. Automatic raw-original transfer, general web dataset approval/export, scoring and reports remain targets; broader physical validation remains pending. See the [central guide](telematics-master-plan.md). |
| Fleet Monitoring | Ongoing-rental reads, authorized latest-location map and private Reverb invalidations are implemented. RC-sourced classifier events are connected in rental details; physical rental-flow verification remains a separate gate. See [fleet baseline](telematics-master-plan.md#existing-fleet-monitoring). |
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
| Processing and export | Reference preparation plus saved/versioned bounded synchronization → filtering → vehicle axes, experimental reference reuse, encrypted pilot export and 30-feature development interval statistics | Accepted reusable alignment, full-recording/live state, dynamic gravity correction, validated filters and general web dataset approval/export remain pending |
| Dataset and classifier | Frozen v3 data and 35-feature random forest selected, reserved interval evaluation completed, experimental continuous replay checked | Live integration, broader continuous evaluation and automatic-reverse evaluation remain pending |
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
- Automatic remount detection and unattended recalibration are outside the
  capstone scope. A user-initiated Stationary and Forward Reference check is
  planned for resuming scored motion after a remount. See the
  [remount limitation](telematics-master-plan.md#mid-trip-phone-remount).
