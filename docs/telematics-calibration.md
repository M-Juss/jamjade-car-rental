# Supervised telematics calibration

Forward trigger update — 2026-10-19: standard revision 4 and RC revision 5 retain
the first horizontal acceleration reading at or above 3 m/s². Later acceleration
fluctuations do not reset it. Forward evidence has one sample and zero window
duration; the one-second capture minimum, sensor quality, mount, consent and
server evaluation still apply. Earlier sustained-window descriptions below
record previous behavior. Released snapshots keep their saved interpretation;
unreleased progress requires fresh calibration after the profile change.

Resume readiness follow-up — 2026-10-19: the [mobile Stationary resume check](telematics-mobile-dashboard.md#stationary-check-before-resume) reuses the bounded native capture and visuals for an explicitly started, local-only stability check on a released trip. It does not submit setup attempts, change any calibration/reference, require movement exercises, or persist/upload motion. The supervised pre-release calibration contract below is unchanged.

Implemented in code on 2026-10-16. Physical Android/iOS verification and threshold
validation are separate evidence gates. Active-trip collection and AI
classification remain outside this change.

For the current equations, units, sample/window rules, threshold provenance and
sensor-fusion distinction, use [Calibration computation and sensor
fusion](telematics-calibration-computation.md). That reference describes protocol
3; dated superseded sections below preserve implementation history.

## Evidence-based completion and remembered disclosure — 2026-10-18

Implemented in code; physical Android/iOS validation remains pending. Stationary
still measures the full six-second parked interval. Steps 2–5 stop capturing when
movement and sampling requirements are met, with the configured duration serving
as a maximum timeout (standard 12/12/15/15 seconds; RC three seconds each).
The provisional minimum movement observation is 1,000 ms. Sensor coverage is at
least 85% of actual elapsed time, with at least eight samples per elapsed second.
Existing movement, gravity, mount, gap, freshness and summary-consistency gates
remain authoritative in Laravel. A timeout does not pass missing movement.
No new filtering, sustained-braking detector or independent direction ground
truth is introduced. Physical trials must validate the shorter observations.

Standard profile revision 4 and RC revision 5 bind these settings into their
fingerprints; incompatible unreleased profiled progress restarts from Stationary.
Released snapshots and append-only attempt history remain intact. The handover
read adds `calibration.completionLimits`; request fields and protocol 3 are
unchanged. The web consumes only profile identity, so no web type change is needed.

All five exercises show a separate animated success result for 2.2 seconds only
after Laravel confirms a pass. Reduced motion uses a static success result with
the same pause. The next exercise opens idle; the final result returns to the
setup overview and still requires Staff Start Rental.

Disclosure version 2 is remembered on the device per signed-in Customer, rental
and profile identity, using existing Expo SecureStore (localStorage on web).
Reopening, backgrounding, navigating away, retrying or restarting the app does
not require another agreement. New rentals, another Customer, RC/standard scope
changes or a new disclosure version require agreement. A settings fingerprint
change alone does not change disclosure acceptance. Active screen permission,
server eligibility and manual Start recording remain mandatory; remembered
agreement never resumes or starts collection. Each start attests the current
parked/mounted/supervised conditions. Storage failures retain explicitly given
agreement in memory only; a fresh runtime with no readable saved value asks again.

Verification — 2026-10-18: all 842 backend tests (4,892 assertions), 102 mobile
telematics Node tests, PHP formatting, mobile lint/TypeScript, Android/iOS bundle
exports and diff checks passed. The isolated calibration test file depends on
helpers from the foundation suite, so focused backend verification used the
suite-wide `TelematicsCalibrationTest` filter (86 passing cases). A static browser
preview of the actual success component checked 320 px phone and 768 px tablet
wrapping and final completion copy; this does not validate native animation or
sensor behavior. Android has no connected ADB device and Xcode is unavailable,
so physical Android/iOS calibration, storage and navigation checks remain pending.
The Composer run emitted a local Herd PHP extension API mismatch warning but
completed all tests successfully; a temporary CLI-only memory override was used.

## RC demonstration profile — 2026-10-17

The approved defense test platform is a smartphone mounted on an RC car.
`rc_demo` is a separate local/testing profile with server-selected provenance,
parameter snapshots, context binding and incompatible-progress invalidation.
Released results retain their original profile. RC revision 5 uses three-second,
permissive movement confirmations for steps 2–5, requires at least 3 m/s² for
Forward, and keeps Stationary checks unchanged. Forward retains the first
qualifying horizontal acceleration sample and requires valid sensor, timing and mount
evidence; the RC Forward check does not gate on gyro rotation or yaw. These are temporary
workflow demonstration settings, not data-based thresholds. Selecting RC does
not auto-pass an exercise. See the
[RC demonstration procedure and worksheet](telematics-rc-demonstration.md).

Mobile consent identifies RC prototype recordings. Active screen state is bound
to the current profile fingerprint; saved disclosure acceptance is scoped as
described in the 2026-10-18 contract above. The handover projection adds `calibration.profile` (`id`, `revision`,
`fingerprint`), with the client types updated. Submission keys remain protocol 3;
the server alone adds `calibration_profile` to each evaluated attempt's evidence.
Legacy unprofiled history is preserved without claiming a known physical platform.

The handover projection also returns `calibration.movementLimits` for matching
RC feedback. Only Laravel confirms success; RC steps 2–5 then show a success
transition and advance to the next idle exercise. Sensor values stay neutral
until the expected movement is detected. Opposite/missing motion, unusable
readings and excessive position changes remain retry conditions. The final
success returns to the release overview; Staff Start Rental is still required.
Profile revision/fingerprint changes require a fresh Stationary reference.
See the [revision-5 settings and limitations](telematics-rc-demonstration.md#forward-acceleration-threshold--revision-5).

## Forward candidate retries — 2026-10-17

The Forward learner now retains the first **qualifying** sustained window.
Previously it froze the first sufficiently long candidate even when its direction
coherence or mean acceleration would fail server evaluation. Noisy early motion
could therefore prevent a later clean movement from being selected.

At a continuity break or the 750 ms target, the learner now checks the freshly
fetched server acceleration, minimum duration, minimum count and coherence limits.
An invalid candidate resets and searching continues within the same recording;
a qualifying window is retained through the subsequent stop. Only candidate sums
reset. Whole-capture statistics still include every accepted sample, rotation,
tilt and gap. An earlier sampling interruption or excessive tilt can still fail
the attempt even if a later Forward window qualifies. No mount/sampling limits
were relaxed, and no vibration filter or custom sensor-fusion estimator was added.
Flat mounted phones continue to use the learned gravity reference.

All four server Forward limits now reach the native capture abstraction and
accumulator, replacing the acceleration-only internal option. The request/API
shape and protocol 3 remain unchanged. The 750 ms target and 250 ms continuity
gap remain implementation constants; see the [computation reference](telematics-calibration-computation.md).

Verification: both new noisy-then-clean regression cases failed before the fix.
After the fix, 68 focused mobile telematics Node tests, mobile lint, TypeScript
and `git diff --check` passed. Tests cover Android/iOS capture and progress reset,
non-default server limits, retention through braking, rejected settings, and
preservation of whole-capture quality evidence. Vehicle-motion validation and
physical iOS verification remain pending; code tests do not establish that road
vibration or changed gravity estimates are within the current development caps.

## Current parked-noise policy — 2026-10-17

Protocol 3 supersedes the earlier continuous-green Stationary window described
in the historical sections below. Stationary now measures one full configured
six-second parked/idling interval after fresh-stream warmup. Small fluctuations
and spikes remain in the measurement; they do not silently restart or censor it.
The UI shows measurement time and accumulated acceleration RMS/rotation peak.
Laravel evaluates the complete interval against the existing RMS, peak, yaw,
tilt, gravity, coverage and gap caps. Excessive vibration fails the attempt;
it never earns looser mount-quality limits. Staff supervision and the parked,
untouched mount remain attestations, not automatic vehicle-motion proof.

The bounded accumulator adds linear and rotation mean vectors, composite
population standard deviations, horizontal acceleration RMS and rotation RMS.
These are running scalar statistics, without raw arrays or sensor streams.
Protocol 3 requires these ten scalar fields on every calibration summary.
Laravel checks RMS/mean/variance consistency, horizontal energy versus total
energy, and rotation RMS versus peak. Shape/bounds remain mirrored in Zod.

Only a passing Stationary attempt receives the server-derived `noise_baseline`.
The owning mobile handover read projects `noiseBaseline` with linear RMS,
horizontal RMS, linear variation, rotation RMS and rotation variation. Mean
vectors, individual readings and private setup evidence remain unexposed.
Forward displays the parked vibration beside its sensor guidance.

For Forward only, Laravel derives `forwardLimits.acceleration` as
`max(minimum_longitudinal_acceleration, parked_noise_multiplier * horizontalRms)`.
The initial multiplier is 3. This is an engineering RMS margin, **not** a
three-sigma probability guarantee or validated automotive standard. The configured
0.5 m/s² minimum is never lowered; the accepted Stationary RMS cap bounds the
baseline energy. The mobile learner and its live guide receive the same fresh
server threshold. Forward requires a sustained consistent window, and retains
all existing rotation, yaw, tilt, age and sampling checks. The gyro ceiling is
still 6°/s; Braking/turn criteria remain unchanged in this increment.

The accepted baseline stays fixed through subsequent attempts and exercises.
Repeating Stationary or a device prerequisite invalidates it and later progress,
without deleting history. In-progress protocol 1/2 histories project a fresh
Stationary requirement; ready-for-release/released legacy histories are retained.
Old clients cannot submit protocol 2 evidence. No migration or booking rewrite
is required. Consent remains an explicit entry disclosure plus manual Start
recording for each capture; Stop, blur and background cancellation remain active.

These caps and the margin are provisional development settings. Physical trials
must establish parked false-rejection and maneuver false-detection rates across
phones, mounts and vehicles before deployment or further threshold changes.
Neither a passing baseline nor a threshold crossing certifies safe driving or
confirms that a phone holder physically exists. Background collection and AI
classification remain outside this implementation.

## Agreed procedure

The Customer completes device readiness after Staff starts handover. Staff then
supervises calibration in a controlled area. Each recording starts while parked;
the phone stays secured in one fixed mount position (flat, upright or tilted)
and must not be touched while the vehicle moves. Staff directs gentle, low-speed
movements and stops the exercise when conditions are unsuitable. No sudden braking or
aggressive turns are required. Start Rental remains Staff's final release action.

The app presents one step at a time:

1. Stationary: six seconds of parked/idling vibration measurement establish the mount
   vertical reference from mean gravity. Forward remains unknown at this stage;
   there is no assumed phone axis or required upright orientation.
2. Forward: up to twelve seconds to learn the vehicle's forward direction from the
   first horizontal acceleration sample reaching 3 m/s², after removing the vertical
   component using the Stationary reference. The accumulator retains this sample
   through later fluctuations and stops once the capture-quality checks qualify.
   Staff must direct forward movement from rest; motion alone cannot prove that
   a vehicle moved forward rather than reversed.
3. Braking: up to twelve seconds to observe negative longitudinal acceleration.
4. Left turn: up to fifteen seconds to observe left yaw around the reference vertical.
5. Right turn: up to fifteen seconds to observe right yaw.

Selecting **Begin calibration**, **Continue calibration** or **Continue to calibration**
opens **Before calibration** when this Customer has not yet agreed for this rental and disclosure version. **Agree and
continue** explicitly consents to the five short motion recordings and confirms
Staff supervision, a parked vehicle and secure mount. It opens the exercise
without starting sensors. Disclosure acceptance is saved per Customer, rental, profile identity and disclosure
version. Leaving or backgrounding clears the active screen state and stops capture,
while the accepted disclosure is restored when calibration is opened again. Each exercise and retry
still requires **Start recording** while parked, without repeated checkboxes.
Supervision and mounting are attestations, not automatic presence/holder detection. Recordings stop
automatically, on cancellation, when leaving the screen, or on backgrounding.
Leaving/backgrounding discards unsent data; a new recording requires another
explicit start. An interrupted or unstable Stationary measurement must be retried
while parked; the app does not discard noisy sub-windows to manufacture a baseline.

## Native and storage boundary

`services/telematics/calibration-capture.ts` subscribes to the installed Expo
Sensors 15.0.8 DeviceMotion API at a requested 50 ms interval. It requires an
Android/iOS app, available motion hardware, existing granted motion permission
and foreground state. It does not request location, register location updates,
start a trip, upload route points, or keep an offline recording.

The installed iOS native module emits rotationRate in Z/Y/X order under
alpha/beta/gamma; Android emits X/Y/Z. `rotationAxes` normalizes them to XYZ.
This is checked against the exact installed native sources and covered by
synthetic unit tests. Physical axis/sign verification on both platforms remains
required before deployment.

The accumulator retains scalar sums, extrema and timing metadata only. It never
keeps a raw motion array. It submits sample count/span/gaps, acceleration RMS,
rotation peak, longitudinal extrema, separate left/right integrated yaw, maximum
tilt and mean gravity. Protocol 3 retains the bounded forward-window mean
vector, duration, sample count and direction coherence introduced in protocol 2,
and adds the mean/variation and RMS statistics described above. Exact raw sensor streams are neither uploaded nor stored.
Laravel saves these bounded summaries in the existing append-only setup-step
evidence. The normalized mount reference, accepted five-value noise baseline,
capture durations and feedback limits are projected for subsequent captures;
mean vectors, private evidence, step/session IDs and location history remain private.

## Contract and server evaluation

The existing attempt endpoint accepts the five calibration types. Its
`StoreSetupAttemptRequest::calibrationEvidenceRules()` contract is mirrored by
`validation/telematics/calibration.ts`. Extra evidence fields, raw samples,
client-selected status, absent consent and absent supervision are rejected.
Capture dates are UTC ISO timestamps with three fractional digits. The recording
form uses React Hook Form/Zod to validate the accepted disclosure consent for
every capture, displays consent/supervision errors beside the recording action,
and preserves a form-level fallback for other failures. The backend consent
and supervision requirements are unchanged.

Laravel rechecks ownership, Customer self-drive scope, confirmed booking,
documents, rental interval, staff-started session and competing customer
handover/rental state. A keyed opaque context binds submission to the current
set of attempts. A stale context or out-of-order step produces 422 without
creating an attempt. Stationary calibration may be explicitly restarted; its new
attempt invalidates all later calibration projections. A fresh device attempt
does the same. Previous attempts remain saved. Failed evaluated captures append
a real failed result; transport/native cancellation does not invent a result.

Initial quality limits in `backend/config/telematics.php` require at least eight
samples/second, 85% capture coverage, gaps at most 500 ms, plausible gravity,
consistent summary bounds, and at most ten degrees of tilt relative to the
established position. Stationary acceleration RMS is at most 0.35 m/s², rotation peak at most 6°/s,
and integrated yaw at most five degrees. Forward requires the server-derived
minimum of 3 m/s²; Braking retains a fixed 0.5 m/s² minimum in the
expected direction. Forward retains one qualifying horizontal sample with zero
window duration. Its energy must remain consistent with the full recording.
Standard Forward uses a 60°/s rotation cap and 180° yaw allowance; RC Forward
does not gate on rotation/yaw. Later acceleration fluctuations do not reset
the retained trigger. One second of valid capture is still required.
Braking uses the server-normalized learned direction with the opposite sign.
Turns require twenty degrees in the expected direction and at most ten in the opposite direction. Captures must have the configured
duration and end within sixty seconds of submission, allowing ten seconds of
future clock skew.

These are configurable initial engineering limits, not validated driving-event
thresholds or proof of driving quality. Mobile summary evidence is not hardware
attestation. Staff supervision and physical Android/iOS calibration testing are
necessary to validate mounting assumptions, sensor signs, noise and practical
capture windows. No driving classification, score, fault or charge is inferred.

All six device results and five effective, ordered calibration results must pass
in standard mode. The existing local/testing mode remains a documented
mount-only flow-testing exception and should be disabled to verify the complete
standard calibration gate. Setup never releases a vehicle or starts a trip.

## Dynamic mounting revision — 2026-10-17 (protocol 2 history)

This revision introduced protocol 2; protocol 3 above is now required for new
captures in Laravel and mobile validation. The projected
reference contains `down` and a nullable `forward`: Stationary saves only
`down`; a passing Forward attempt saves both axes. Later exercises require the
learned forward direction. The website consumes the effective step results and
readiness fields; it does not submit motion summaries or consume the mount
reference, so its contract needs no change.

Unfinished (`in_progress`) protocol 1 calibration projects as pending from
Stationary, without changing or deleting stored attempts. Already completed
ready-for-release or released histories retain their existing effective results.
No database migration, booking edit or history rewrite is performed.

A change in gravity direction beyond the tilt limit fails the capture. Gravity
alone cannot detect rotating a flat phone within the horizontal plane. If the
phone is repositioned, restart calibration explicitly. This remains a supervised
fixed-mount procedure, not automatic holder or remount detection.

Synthetic tests cover flat face-up/down, upright, tilted and landscape mounting,
forward learning without acceleration/braking cancellation, noise/spikes/gaps,
inconsistent direction, changed tilt, retry and legacy attempts. Physical
Android/iOS validation of this revision remains pending.

Verification: full backend `composer test` passed (572 tests, 3,224 assertions)
using the existing temporary 512 MB CLI configuration. Forty-four focused mobile
Node tests, mobile lint/TypeScript, PHP formatting and `git diff --check` passed.
The initial file-only backend command could not load cross-file fixture helpers;
the filtered run with the suite loaded and subsequent full run passed. No
physical device capture or vehicle exercise was performed for this revision.

## Stationary visual guide and fresh capture startup — 2026-10-17

Step 1 now has a dedicated mounted-phone illustration, native pulse/check
animations with Reduce Motion support, capture progress, accelerometer and gyroscope
readings, and text plus red/green feedback. The handover projection
adds `calibration.stationaryLimits` (`linearRms`, `rotationPeak`, `yawDegrees`,
`tiltDegrees`, `maxGapMs`) from Laravel configuration. Client feedback uses those
limits; only Laravel decides and persists the completed attempt outcome. Raw sample arrays, background
collection and active-trip behavior remain absent. The web consumes effective
results and readiness, and does not use these additive presentation limits.

Live feedback is throttled to five updates per second, with immediate range
transitions, and kept only in memory. Interrupted updates become a visible error indication. Capturing uses a
compact guide with Cancel/Stop fixed above the customer tab bar and safe-area
insets; consent remains explicit. After capture the screen waits for Laravel.
Only a confirmed passing Stationary result shows the success animation; after
1.6 seconds the existing Forward screen opens without starting another capture.
Navigation/backgrounding clears this transient state. The subsequent Forward
visual update is described below; Steps 3–5 retain their existing UI.

A physical Android retry exposed a startup bug: a 12-second recording had a
20–22-second sensor span, 8–10-second apparent gaps and about 183 readings. The
installed Expo Sensors 15.0.8 Android module retains its last sensor events
between subscriptions. Capture now waits for 200 ms of advancing timestamps
consistent with arrival timing, resetting startup on cached packets or jumps,
before starting the full configured recording window. Startup times out after
three seconds. Native subscriptions and both startup/capture timers are cleaned
up on cancellation, backgrounding and failure. The same abstraction serves iOS.
Real gaps after startup remain in the evidence for exercises 2–5 and continue
to fail the unchanged server quality limits. Stationary now discards a gapped
window and starts a fresh one as described below; no saved attempts were altered.

Verification: 50 focused mobile Node tests passed, including fresh startup on both
platform mappings, cached timestamps, genuine capture gaps, timeout, cancellation,
permission denial, live limits and server-only success. The full backend suite
passed 573 tests / 3,230 assertions. Synthetic browser review exercised actual
components with explicitly labeled demo values at 320/390 px phone and 768 px
tablet widths: consent errors, preparation, steady/excess movement, interruptions,
evaluation, retry, success and automatic advancement with no automatic recording.
Mobile lint/TypeScript, PHP formatting, diff checks and final Android/iOS
production JavaScript/Hermes exports passed. The temporary demo entry point and
loopback preview server were removed after review. Physical Android/iOS
validation of the new UI and startup fix remains pending.

## Android development-bundle diagnosis — 2026-10-17

The connected Android development app retained the earlier calibration module:
its summary lacked the protocol 2 forward fields, and a sensor-free flat-position
calculation still raised the earlier no-usable-readings error. The device's Expo
reverse forwarding targeted host port 8082 while Metro was running on 8081.
Forwarding was corrected and the development app explicitly reloaded.

After reload, synthetic flat and upright Stationary summaries passed the actual
loaded protocol 2 Zod schema inside the phone's Hermes runtime. These calculations
used fabricated inputs for debugging only: they did not start sensors, call the
setup API, save results or change a booking. This confirms current code delivery
and runtime validation, not physical sensor calibration. A fresh user-consented
recording was initially pending. The user subsequently reported that Stationary
passed on the physical Android phone. This is user-reported success for Step 1;
Forward, Braking, both turns, full release and physical iOS validation remain
pending. No application source or validation threshold changed during this
diagnosis.

## Verification record — 2026-10-16

- Full backend `composer test`: 515 tests, 2,932 assertions, using a temporary
  512 MB PHP CLI configuration for the test subprocess. The initial default
  128 MB run exhausted memory; the successful run changed no repository config.
- PHP formatting, mobile/web lint and TypeScript, and web production build passed.
- Twenty-three focused mobile Node tests cover stage gating, sensor axis mapping,
  summary math, schema bounds, cancellation/background cleanup, changed-step
  rejection, consent, offline completion and single submission. No frontend test
  framework or package dependency was introduced.
- Android and iOS production JavaScript/Hermes exports passed. Expo dependency
  validation used its bundled local map because networking was unavailable;
  online diagnostics were not established.
- Synthetic browser fixtures exercised loading, empty, error, waiting, device
  failure, calibration consent, recording, ready and released states. Phone
  widths of 320/390 px and a 768 px tablet layout were reviewed. Rental selection
  and collapsed results remain separate from the main task. This preview did
  not exercise actual OS permission prompts or the full authenticated shell.
- Full mobile web export remains blocked by an existing native-only
  `react-native-maps` import in the booking delivery form; the isolated
  Telematics browser preview exported successfully.
- On the connected Redmi Note 8 Pro/Android 11, the real capture adapter completed
  one explicitly consented six-second foreground motion test (91 readings over
  5.89 s). The isolated test changed no booking and submitted no calibration
  result. See [physical evidence](telematics-device-test-checklist.md).
- Moving vehicle calibration, mounting/direction/threshold validation, full
  real-booking handover/release, physical interruption paths and physical iOS
  validation remain pending. Successful code/tests/bundles do not close those
  evidence gates.

Calibration consent UX update — 2026-10-17: the single entry disclosure and
recording-only exercise action are implemented in code. Lint, TypeScript, the
50 focused telematics tests and Android/iOS production bundle exports passed.
A demo browser preview checked cancellation, agreement without recording,
explicit start and checkbox-free next exercise at phone/tablet widths; small
screens retain scrollable disclosure text and visible actions. Physical Android
and iOS modal/navigation checks remain pending.

## Continuous Stationary window — 2026-10-17 (superseded by parked-noise measurement)

Implemented in code: the circle measures one uninterrupted valid Stationary
window, rather than elapsed attempt time. Current acceleration magnitude and
rotation speed drive live red/green feedback using the server-projected limits.
Every usable sample is checked, including samples between UI updates. Any
out-of-range acceleration, rotation, accumulated tilt/yaw, or sensor gap resets
the circle to zero and discards that in-memory window. The first valid sample
starts a new window and a new gravity reference. A watchdog resets progress
when the stream stops, even without another sample. Duplicate/cached timestamps
cannot advance progress. This intentionally requires each live motion value to
stay within range; the backend still evaluates the final window's RMS and peak.

Completion requires a fresh, valid sample at or after the full configured steady
duration. Only that final window's actual start/end timestamps and bounded
summary are submitted once; rejected local windows are never appended as setup
attempts. Laravel retains its existing quality, eligibility and pass/fail checks.
The remaining four exercises retain their fixed capture periods and maneuver
evidence rules; this change does not require prolonged acceleration or turning.

A Stationary attempt stops after 45 seconds following sensor warmup if no valid
window completes. The disclosure explains this bound. Stop, navigation and
background cancellation also remove both deadline and gap-watchdog timers and
the subscription. No background collection, raw arrays or automatic next-step
recording are introduced. Physical Android/iOS validation remains pending.

Verification for this timing change: 60 focused mobile tests, lint, TypeScript,
Android/iOS production bundle exports and 34 backend calibration tests (222
assertions) passed. Synthetic capture tests cover both platform mappings,
continuous completion, movement immediately before completion, fresh window
summaries/timestamps, stream-loss recovery, cached samples, the attempt deadline,
and cancellation cleanup. Browser demo review confirmed a partial circle resets
to 0.0 on red, restarts at 0.4 after recovery, and uses text as well as color;
the 320 px layout had no horizontal overflow. These are synthetic checks, not
physical device evidence.

## Forward movement visual guide — 2026-10-17

Implemented in code: Step 2 uses a top-down vehicle and forward arrow with a
short native animation during recording. Reduce Motion disables animation.
Preparing, waiting, detecting movement, movement captured, turning, shifted
mount, interrupted readings, server evaluation, failure and confirmed success
have distinct text and visual states. Stop remains pinned above the customer
tab bar during preparation/recording, using the existing safe-area boundary.
The recording form remains manual and reuses the visit's disclosure consent.

`calibration.forwardLimits` projects the configured acceleration, minimum
window duration and coherence plus the fixed five-sample minimum. Existing
`stationaryLimits` supplies rotation, yaw, tilt and gap limits. These are
additive read-only response fields; the website continues to consume effective
results and readiness only. The attempt request, release gates and persisted
summaries are unchanged.

The native capture callback adds a transient `reading.forward` containing
current horizontal acceleration magnitude (using the Stationary down axis),
window mean magnitude, duration, coherence and sample count. It is not included
in submitted evidence. The same existing accumulator learns the first sustained
forward window; no full sensor stream is retained or uploaded. The movement
circle is separate from the fixed recording-time bar. Coasting/stopping after
movement detection keeps the captured indication, with an instruction to stop
safely and no request to accelerate again. Turning, remounting or stream gaps
suppress that indication. This is guidance, not proof of actual forward travel
or a client-side passed result; staff must direct forward movement from rest.

Only a server-confirmed passing result displays **Forward direction set**.
After 1.6 seconds the Braking screen opens with its recording stopped. No next
exercise starts automatically. Braking and both turn visuals remain separate
incremental work; physical Android/iOS motion and mounting validation are pending.

Verification: 64 focused mobile tests and the full backend suite (574 tests,
3,237 assertions) passed, as did PHP formatting. Synthetic native-adapter tests
cover Android/iOS horizontal feedback and retention of captured movement after
stopping; domain tests cover threshold changes, incomplete evidence, straightness,
mount movement and gaps. Browser demo checks at 320/390 px phone and 768 px tablet
widths reviewed preparation, waiting, building, captured, warning, evaluation,
retry/restart and confirmed-success states. The actual component advanced to
Braking after confirmation while the demo recording count stayed unchanged.
The temporary demo entry point/server were removed after review. This does not
constitute a physical moving-vehicle or native modal/navigation test.

Final mobile lint, TypeScript and Android/iOS production bundle exports passed
for the Forward visual update. No dependencies or native configuration changed.

## Parked-noise verification — 2026-10-17

The full backend suite passed 591 tests / 3,333 assertions, including 52 focused
calibration cases. Sixty-one focused mobile Node tests passed. These cover
uncensored parked fluctuations and spikes, bias versus variation, horizontal
energy, platform axis mapping, server-derived Forward thresholds, rejected noise
and inconsistent summaries, retry/invalidation, old protocol rejection, retained
completed history, consent, interruption cleanup and no submission while offline.
Mobile lint and TypeScript, PHP formatting and Android/iOS production bundle
exports passed. No package dependencies, native permissions or schema migrations
were added.

The new browser preview was not run: automatic approval review could not
complete for the temporary loopback-only demo server because its usage limit
was reached. The server did not start, and the temporary demo entry point was
removed. Updated UI layout, authenticated phone flow, physical parked/idling
noise and gentle maneuver validation remain pending on Android and iOS. Test
and bundle success do not validate the engineering margin or noise caps.
