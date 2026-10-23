# RC Research data contract and collection protocol

Status — 2026-10-18: the mobile Admin RC Research workflow and isolated
Laravel session/trial storage are implemented in code for local/testing RC mode.
Physical Android/iOS sensor and end-to-end upload verification remain pending.
The user chose manual stop only and server retention until explicit Admin delete.
The requested 50 Hz interval and quality checks are pilot settings, not validated
classification thresholds. Export and model training are future work.

UI update — 2026-10-19: session setup now keeps session context and intended
movement/intensity in one card. Phone model, RC model, mounting method and RC
configuration are not collected in the setup UI; legacy session fields remain
nullable. Consent remains explicit through the “Agree & create session” action.

## Single-page interface

One protected `rc-research` route uses the same floating navigation surface as
Driver: **Data / Collect / Logout**, with Collect featured in the middle.
All collection stages stay inside Collect:

1. **Session setup:** metadata, movement/intensity dropdowns and collection consent.
   **Create session** saves physical setup metadata and opens Recording. Going
   back preserves the form; movement-only changes reuse the physical session.
2. **Recording:** compact expandable session details, elapsed time and motion
   readings. **Start reading** explicitly requests motion permission and starts
   foreground capture. **Stop reading** finishes it; **Review** then opens review.
   There is no countdown, automatic recording timer, or automatic save.
3. **Trial review:** reading summary, observed movement/intensity, certainty,
   quality, event interval and notes. **Save trial** uploads the reviewed recording;
   success appears only after Laravel acknowledges it. Network failure keeps the
   recording in memory for retry with the same trial ID.

Back navigation appears at the upper left. Setup and review drafts survive
back/forward transitions and tab changes. Navigation is disabled during capture
and submission. Leaving the foreground cancels active capture. Unsaved raw data
is memory-only: closing the app loses it; logout warns before discarding it.

Data lists the owning Admin's saved trials with pagination, inline trial detail,
reading summaries, refresh/retry/empty states and explicit permanent deletion.
Recording controls stay pinned above the tabs while readings scroll.
Plots, filters, export, persistent offline drafts and annotation revisions are
not implemented. Logout opens the shared confirmation. Access is rechecked on
focus/foreground and before each explicit recording start.

## Goal and boundary

Collect labeled smartphone motion recordings from a secured RC-car mount to
develop and evaluate a driving-event classifier. The phone is the measurement
source. An event is a motion observation, not evidence of driver fault, intent,
unsafe conduct, liability or a financial charge.

This is a separate Admin research workflow under the existing local/testing
RC access gate. It does not use customer bookings, setup attempts, rental
trips, location history or significant-event tables as dataset storage.
Existing calibration still saves bounded summaries only; its demonstration
pass/fail limits must not become research labels. Research raw recordings use
the separately approved boundary described here; rental collection is unchanged.
Video, audio, GPS and background recording are outside this initial dataset.
RC load configurations do not establish equivalence to cars or vans.

## What the AI will read and what we will use

```text
Explicit foreground recording in the mobile Admin page
  -> timestamped motion samples + separate trial annotations
  -> reviewed private dataset (implemented)
  -> future versioned Laravel export
  -> Python quality checks, coordinate conversion and time windows
  -> numeric features + confirmed training labels
  -> train and evaluate a Random Forest baseline
  -> future predictions on new motion windows
```

| Part | Proposed tool | Purpose |
| --- | --- | --- |
| Capture and review | Existing Expo SDK 54 / React Native app, `expo-sensors` DeviceMotion | Sample phone motion behind a dedicated research service; render recording and review states |
| Pending recordings | In-memory capture buffer (implemented) | Preserve pending review/upload during the current app session; persistent encrypted offline drafts need a separate extension |
| Access and persistence | Existing Laravel API, database metadata and private file storage | Recheck Admin/RC access, validate bounded uploads, store provenance, authorize reads/deletion/export |
| Portable dataset | CSV samples and annotations, JSON manifest | Inspect independently and reproduce dataset versions |
| Analysis and training | Separate Python environment with NumPy, pandas, scikit-learn and Matplotlib | Validate recordings, compute features, train models, plot signals and report results |
| First learned model | scikit-learn `RandomForestClassifier` | Fit numeric window features to reviewed labels; compare with a majority-class baseline |

Capture, review and encrypted server storage reuse installed dependencies.
Export and Python tools are proposals, not newly installed dependencies. Pin the Python
environment when training is implemented. Start with offline training and
evaluation. Choosing an inference service or on-device runtime comes after a
useful model exists; the mobile app continues to communicate through Laravel.
The classifier is a supervised numeric model; it does not require a language
model or sending recordings to a chat service.

The first model reads features such as acceleration/rotation means, standard
deviations, RMS values, signed extrema, magnitudes and duration, with yaw-related
features only after axis/reference validation. Preserve sample-level readings
so feature definitions or later sequence models can be evaluated without
repeating every trial. DeviceMotion values are platform-processed measurements,
not unprocessed hardware sensor output.

Training receives `X = numeric features` and `y = reviewed labels`. Prediction
receives only features available at that time. Intended maneuver, confirmed
label, observer notes, trial/session identifiers, test split, timestamps of day
and surface names are not classifier inputs in this baseline. Metadata remains
available for grouping and error analysis. Quality checks run before inference;
an unusable recording must not silently become a normal prediction.

## Collection labels and prediction targets

Store movement and intensity separately, then derive the following collection
labels. `normal` and `harsh` apply to acceleration, braking and turns; stationary
and steady movement use intensity `not_applicable`.

| Movement | Collection labels |
| --- | --- |
| Stationary | `stationary` |
| Steady straight movement | `steady_movement` |
| Acceleration | `normal_acceleration`, `harsh_acceleration` |
| Braking | `normal_braking`, `harsh_braking` |
| Left turn | `normal_left_turn`, `harsh_left_turn` |
| Right turn | `normal_right_turn`, `harsh_right_turn` |

The proposed first classifier has five targets: `non_harsh_motion`,
`harsh_acceleration`, `harsh_braking`, `harsh_left_turn`, `harsh_right_turn`.
Map reviewed normal maneuvers and stationary/steady references to
`non_harsh_motion`. Retain all ten collection labels for finer evaluation and
later experiments. This mapping is an initial modeling proposal, not a claim
that all five targets are already identifiable.

Motion alone does not reliably distinguish stationary from smooth constant
velocity. Keep those labels as observer annotations; do not claim speed or a
moving/stopped detector without an independent measurement. Validate physical
left/right signs and the forward reference before assigning longitudinal or
directional features. Record whether a stop used braking, coasting or reverse
throttle; do not equate these actions silently.

Future comparison trials should use a separate `trial_kind = comparison` and observed
condition: `bump_crossing`, `rough_surface_travel` or `stationary_vibration`.
Ordinary maneuvers use `trial_kind = maneuver`. Surface is still session context;
a turn on rough concrete remains a turn. Comparison trials carry their event
intervals and are retained for false-alarm evaluation; their mapping into model
training must be explicit in each dataset manifest. A bump is not automatically
a harsh-driving label. Mixed or unclear events require uncertain annotations
and are excluded from the initial supervised set.

Phone handling/mount disturbance is a quality flag, not a normal/harsh class.
Keep interrupted and rejected trial counts, with reasons, rather than silently
discarding failures. Never use a model prediction as its own confirmed label.

## Proposed data contract

The table below is the intended full research design. The first implementation
has `rc_research_sessions` and `rc_research_trials`, authoritative Laravel Form
Requests/Resources and matching mobile Zod setup/review schemas. It implements
session metadata, consent, intended/observed maneuver labels, quality, event
intervals and server-computed reading summaries. Comparison classes, saved
forward references, annotation revision history and export manifests remain
future extensions; do not infer their availability from the design table.
Use snake_case at the API boundary and explicit enums/versioned protocols.

| Record | Required content |
| --- | --- |
| Session | Opaque ID, neutral name, owner (server-owned), platform/app/source version, surface, slope, mount orientation, battery condition, `added_load_g = 0`, capture-protocol version and consent version/time. Legacy phone model, RC model, mounting method and RC configuration fields are optional and are not collected by the current setup UI. |
| Trial | Opaque retry/idempotency ID, session ID, trial kind, intended movement/intensity, capture start/end, stop reason, requested interval, actual duration/count/rate/gaps, sensor/adapter versions, reference ID and sample-file checksum |
| Samples | Sequential index, capture-relative arrival time, individual native sensor timestamps, linear acceleration XYZ, acceleration-including-gravity XYZ, rotation-rate XYZ and screen orientation; nullable/missing channels are flagged, never replaced with zero |
| Annotation | Observed movement/intensity or comparison condition, event start/end in capture-relative milliseconds, label state (`pending`, `confirmed`, `uncertain`), quality reasons, optional bounded note, reviewer and annotation revision/time |
| Export manifest | Schema/protocol/feature/label-mapping versions, selected annotation revisions, trial counts/exclusions, files/checksums, train/tune/test session assignments and export timestamp |

Use UTC ISO-8601 for wall-clock metadata; display in Asia/Manila without visible
timezone suffixes. Preserve individual monotonic sensor timestamps in seconds
and normalize relative timing in milliseconds. Never treat clock time or callback
order as proof that sensor channels are synchronized. Acceleration is in m/s²;
canonical rotation rate is in degrees/second about device X/Y/Z. Preserve source
channel names and conversion version so normalized axes can be reproduced.

The installed Expo Sensors 15.0.8 native sources and the existing
`rotationAxes` helper show a platform-specific rotation-rate ordering. Inspect
and physically verify the adapter on both platforms rather than trusting alpha,
beta and gamma names as portable X/Y/Z. Gravity can be derived from paired
including-gravity minus linear acceleration only after timing checks. Derive
mount-relative signals with a saved research reference and versioned transform;
do not couple the dataset to a customer's calibration attempt. An orientation
change or remount starts a new session/reference. Optional attitude fields
require a separately specified unit/convention; screen rotation is not attitude.

Implemented transport: a bounded multipart `samples_json` text field plus trial
metadata. Laravel decodes/validates it and writes an encrypted private file;
raw samples are never stored in database JSON or rental evidence.
Laravel validates finite values, enums, bounds, sample order/timing, ownership,
file content/count/size, annotation intervals and supported protocol versions.
Saved files are immutable. Editing annotations is not exposed; future edits need revisions.
Checksums detect file changes, not the truth of a label or authenticity of motion.

## Pilot collection procedure

1. Use a controlled test area, fixed secure mount, one smooth level surface and
   no added load. Record actual configuration; include phone/mount mass in the
   physical setup description. Start a new session when conditions change.
2. Explain foreground motion collection and private retention; accept disclosure
   before sensor subscriptions. Verify motion permission, required channels and
   storage availability. Do not request location for this experiment.
3. In the future reference workflow, capture stationary/forward references with explicit starts. Check
   axes with known gentle maneuvers. This establishes a reference, not AI labels
   or a rental release result.
4. Select the intended maneuver and intensity. Start reading, perform one clear
   maneuver with context before and after, then stop reading manually. Preselect an independent
   pilot/tuning or held-out evaluation session; vary maneuver order within each.
5. Review the reading summary and mark the observed event interval. Record what happened even
   when it differs from the instruction. Confirm the label or mark uncertainty;
   record interruption/mount problems separately. Save only after an explicit
   review action; pending recordings remain visibly pending.
6. Repeat comparable normal/harsh trials across separate sessions. Review sample
   quality and observer consistency before expanding to terrain; add measured
   load configurations later. Repeat both intensities under each condition.

Current pilot settings request 20 ms updates (50 readings per second).
The tester stops recording manually; elapsed time is informational. Minimum
accepted capture is one second with at least eight samples. Fresh-stream startup
has a three-second failure timeout, which never produces a completed recording.
Raw buffers are bounded to 10,000 samples and 4,000,000 JSON bytes; exceeding
capacity fails the trial rather than automatically saving a partial recording.
These are resource bounds, not an automatic recording duration. Server timing
validation has a defensive 24-hour ceiling. Keep individual trials short enough
to review one maneuver. Do not treat this foreground recorder as continuous
trip monitoring.

Actual rates, synchronization, gaps and suitable trial lengths need physical
Android/iOS validation. Preserve timestamps; never manufacture a perfect 50 Hz
stream or fill missing readings with zero. The server flags average rates below
8 Hz, gaps over 250 ms or coverage below 85%. These provisional quality checks
control dataset eligibility, not normal/harsh labels. A trial also needs confirmed
labels and usable quality to be eligible; the flag is not an AI classification.

Normal means the planned smooth/gradual maneuver; harsh means its planned
abrupt counterpart under a documented RC procedure. Before labeling a training
dataset, write the per-maneuver approach, control action, turn path and observation
criteria; confirm the RC can actually execute braking. An observer should record
the actual maneuver and a neutral operator code where multiple operators exist.
Record label basis and observer uncertainty. Observer labels remain subjective
without independent reference instrumentation; agreement checks and repeatable
instructions reduce uncertainty but do not prove driver-caused harshness. Do not
derive ground truth solely from thresholds applied to the same model inputs.

## Saving, access and retention

Implemented lifecycle: consented session -> memory-only recording -> reviewed
pending upload -> server-confirmed saved. The same client trial ID/content is
idempotent; changed content or a deleted ID returns 409. No local raw file,
offline queue, crash recovery or automatic retry is implemented. A failed upload
can be retried while the screen/app remains open. Backgrounding cancels an
active capture and releases sensors; it never resumes or joins fragments.

Every endpoint requires the existing restricted research token, active Admin,
local/testing environment and RC profile. Session and trial reads/mutations are
owner-bound. API routes are:

- `POST /mobile/rc-research/sessions`
- `POST /mobile/rc-research/sessions/{session}/trials`
- `GET /mobile/rc-research/trials` (paginated metadata/summaries only)
- `DELETE /mobile/rc-research/trials/{trial}`

Private Laravel local storage holds encrypted immutable sample files using the
application encryption key. Protect/back up that key; losing it makes recordings
unreadable. Neither API Resources nor list requests expose samples, filesystem
paths, checksums or owner identifiers. Files are not public or downloadable.
Payloads contain no GPS, customer/booking references or video. Raw streams are
separate from ordinary rental APIs and database summaries.

**Retention:** saved recordings remain until the owning Admin explicitly deletes
them. There is no age-based purge. Delete removes ciphertext and clears notes
and summaries; a minimal tombstone (IDs/hash, labels/times and session linkage)
remains to prevent an interrupted upload from recreating the deleted recording.
Session metadata also remains. If filesystem deletion fails, return an error and
keep the record visible and retain its private path so deletion can be retried. Infrastructure backups follow
operator policy; the app cannot promise deletion of external backups or copies.
Authenticated export, backup deletion policy, model/export provenance deletion
and production storage quotas must be designed before expanding beyond this
local/testing collector.

## Training and evaluation plan

Start offline with NumPy/pandas, a majority-class `DummyClassifier` and a
Random Forest baseline. Use trial/event timing to create reproducible windows;
two-second windows with a one-second stride are pilot candidates, not fixed
requirements. Specify event-overlap labeling and exclude ambiguous boundary
windows before comparing models. Do not label an entire recording
harsh when the event occupies only a small part of it.

Split whole sessions before creating windows. Keep all related trials/windows
and augmented copies in one partition; use grouped cross-validation only when
there are enough independent sessions/classes. Keep a final evaluation set
untouched by feature, threshold and model selection. Where feasible, also test
held-out days/operators/devices/conditions and state which generalization was
actually tested. Fit preprocessing on training data only. Record seeds, package
versions, feature order, label mapping, split manifest and model checksum.

Report trial/session/class counts, rejected/uncertain trials, per-class precision,
recall and F1, macro-F1 and a confusion matrix. Inspect false harsh alarms on
normal terrain-disturbed trials. A later continuous detector additionally needs
event-level timing, duplicate suppression and false alarms per monitoring time;
good trial-window accuracy alone does not demonstrate that detector. Scores from
Random Forest are model estimates, not verified probabilities of driver fault.
Any abstention threshold needs tuning and evaluation; low confidence is not a
complete unknown-event detector.

The model bundle must bind preprocessing, features, label mapping and protocol
compatibility. A later prediction record needs model version, time window,
predicted event, score and quality/abstention state. Real-time rental integration,
background motion and production inference require separate design and physical
validation. RC-only metrics must remain labeled RC-only; full-size cars/vans,
their loads and real operating conditions require their own validation.

## Remaining work and verification boundary

Physical Android/iOS trials must verify permissions, real delivered sampling,
axis signs, mounting, gaps, foreground interruptions, safe areas and end-to-end
uploads. Define repeatable normal/harsh procedures and independent evaluation
sessions before treating the pilot as a training dataset. Reference transforms,
comparison trials, versioned export and offline training are subsequent work.
The classifier and production rental integration are not implemented.

The manual capture regression tests use synthetic native events for Android and
iOS. They demonstrate no automatic completion after ten seconds, manual stop,
longer-than-40-second capture, startup/permission errors, resource bounds and
interruption cleanup. They do not establish physical sensor accuracy.

The collection implementation reuses shared fields, section cards, telemetry
reading presentation, toast/logout patterns and a shared Driver tab-bar surface.
Research navigation does not fetch customer notifications. The isolated browser
component harness used synthetic readings to check setup validation/dropdowns,
review submission, compact session details, disabled tabs and the pinned Stop
reading action at 320 × 640, 390 × 844 and 768 × 1024. It did not collect motion,
use an authenticated session or exercise a real upload. Native keyboard metrics
were shimmed in the temporary browser harness only. Temporary sources were
removed and the local preview stopped.

Final checks on 2026-10-18: mobile lint and TypeScript passed; 62 focused mobile
checks passed, including the existing calibration/access regressions. Android
and iOS bundle exports passed. Laravel's full suite passed 832 tests / 4,824
assertions with a temporary 512 MB CLI memory setting; the default 128 MB run
exhausted memory in an existing payment-document test. `vendor/bin/pint --test`
and `git diff --check` passed. The additive research migration was applied to
the local MySQL database without applying unrelated pending migrations.

A web export attempt remains blocked by the existing native-only
`react-native-maps` import through `DeliveryPointMap` in the booking flow.
Research recording is native-only. Physical Android/iOS permissions, sensor
values, background cancellation, safe areas, text scaling and end-to-end save
checks remain unverified; successful bundles and synthetic tests do not replace
those device checks.

## References and implementation evidence

- [RC access and demonstration boundary](telematics-rc-demonstration.md)
- [Telematics architecture](telematics-architecture.md)
- [Research capture service](../mobile-frontend/services/telematics/rc-research-capture.ts), [API mapping](../mobile-frontend/services/api/rc-research-records.service.ts) and [Laravel storage service](../backend/app/Services/RcResearchService.php): implemented collector and storage contracts.
- [Existing capture abstraction](../mobile-frontend/services/telematics/calibration-capture.ts) and [axis adapter](../mobile-frontend/lib/telematics/calibration.ts): summary-only calibration precedents, not a research recorder.
- [Expo SDK 54 DeviceMotion source](https://github.com/expo/expo/blob/sdk-54/packages/expo-sensors/src/DeviceMotion.ts): versioned API reference; SDK 54 documentation URLs redirected to latest when checked, so installed 15.0.8 types/native source were also inspected.
- [Expo SDK 54 FileSystem documentation source](https://github.com/expo/expo/blob/sdk-54/docs/pages/versions/v54.0.0/sdk/filesystem.mdx): local files; secure retention remains application work.
- [RandomForestClassifier](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html), [DummyClassifier](https://scikit-learn.org/stable/modules/generated/sklearn.dummy.DummyClassifier.html), [grouped stratification](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.StratifiedGroupKFold.html) and [evaluation metrics](https://scikit-learn.org/stable/modules/model_evaluation.html): official training/evaluation capabilities; this project's model choices and pilot settings are proposals.
