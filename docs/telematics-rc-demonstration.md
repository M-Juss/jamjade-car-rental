# RC-car telematics demonstration and validation

## Forward acceleration threshold — revision 5

RC revision 5 retains the first horizontal acceleration sample reaching 3 m/s²
through later fluctuations. Its Forward window has one sample and zero duration,
with no gyro/yaw gate. The capture still needs one second of valid observation
and shared sensor-quality checks. Stationary checks and
the separate 0.5 m/s² braking criterion are unchanged. This is a local/testing RC
workflow threshold, not a validated limit for full-size vehicles.

Status — 2026-10-17: profile isolation and provenance are implemented. RC revision
2 uses short, permissive movement confirmations for workflow demonstration.
These limits are **not learned, tuned or physically validated**. Stationary keeps
its existing parked checks; a timer alone cannot pass later exercises.
Active-trip collection and AI classification remain future work.

Status update — 2026-10-18: RC revision 3 preserves revision-2 movement limits
and uses evidence-based early completion after at least 1,000 ms of observation.
Three seconds is now the maximum timeout for steps 2–5; Stationary remains six
seconds. Quality coverage/count use actual elapsed movement time. All five
server-confirmed passes have a success animation before the next idle exercise.
Disclosure acceptance is remembered per Customer/rental/profile/disclosure version.
Physical validation remains pending; see [the current contract](telematics-calibration.md#evidence-based-completion-and-remembered-disclosure--2026-10-18).
The revision-2 section below is historical timing behavior.

## Defense scope

The measurement source is the **smartphone mounted on the RC car**, not an
independent sensor inside the RC vehicle. These are real phone measurements
under a scale-vehicle test condition. A suitable scope statement is:

> We evaluate the prototype using a smartphone mounted on an RC car. The trials
> assess motion capture, calibration and the application workflow under controlled
> conditions. Full-size rental-vehicle validation remains future work.

Use “demonstrated” only for flows actually observed. Describe a failing trial as
a failing trial. An RC result does not establish full-size vehicle thresholds,
safe-driving detection, behavior classification accuracy or road-scale GPS
accuracy. Any later AI evaluation using RC-only data must report that data scope.

Scale testbeds have research precedent, for example [F1TENTH's 1:10 research and
education platform](https://korea-race.f1tenth.org/getting_started.html). That
precedent does not validate JamJade's thresholds or imply dynamic equivalence
between this RC car and a rental vehicle.

## Implemented profiles

| Profile | Availability | Current limits | Meaning |
| --- | --- | --- | --- |
| `standard` | All environments; default | Existing provisional calibration configuration | Standard evaluation rules; still requires physical vehicle validation |
| `rc_demo` revision 5 | Laravel `local` or `testing` only | Unchanged Stationary; first Forward sample ≥3 m/s² retained; movement capture has a three-second maximum | Workflow demonstration, not validated calibration or a driving-quality label |
| `legacy` | Read-only released history without a saved profile | Original parameter snapshot unavailable | Historical test platform cannot be established; do not relabel as RC or full-size vehicle data |

Set the backend's local `.env` value, then clear configuration:

```dotenv
TELEMATICS_CALIBRATION_PROFILE=rc_demo
TELEMATICS_HANDOVER_TEST_MODE=false
```

```sh
cd backend
php artisan config:clear
```

Reload the mobile development client after the backend change. The existing
same-start-date timing-only flag is independent; it does not change motion rules.
To return to standard evaluation set `TELEMATICS_CALIBRATION_PROFILE=standard`
and clear configuration again. Staging, production and other environments always
resolve to `standard`, even if the environment variable requests `rc_demo`.

`backend/config/telematics.php` owns `calibration_rc_overrides`. Revision 2 is an
explicit temporary workflow demonstration exception to the initial unchanged
pilot. Later data-based revisions must cite the trial set, rationale and
held-out validation results. Do not add a client profile picker or a
“pass anyway” action. Standard profile values stay separate from RC overrides.

## Short RC movement confirmations — revision 2

The user requested a permissive path through steps 2–5 while research data is
pending. Each explicitly started recording measures a full three-second window
after fresh-stream warmup. A brief qualifying movement within that window is
enough; braking or acceleration need not continue for the entire recording.
Stationary remains six seconds and preserves every original parked-noise cap.

| Criterion | RC demonstration setting |
| --- | --- |
| Forward acceleration | `max(3 m/s², 3 × parked horizontal RMS)` |
| Forward trigger | First qualifying sample retained; duration 0, sample count 1, coherence 1 |
| Forward gyro/yaw | Not used as a Forward movement gate in RC revision 5 |
| Movement position cap | Maximum observed and mean-gravity tilt at most 60° for steps 2–5 |
| Braking | Existing longitudinal minimum at most −0.5 m/s² |
| Left/right turn | Requested angular travel at least 10°; opposite travel at most 20°; requested travel at least 1.5 times opposite travel |

The 3 m/s² threshold, shortened duration and permissive caps are developer-selected demonstration
settings. Forward still needs a qualifying horizontal acceleration sample, valid
sensor evidence and a stable phone position. Braking remains an extremum
check and can be affected by vibration; it does not establish sustained braking
or independent ground truth. Forward cannot independently distinguish a
supervised forward start from reversing while learning its initial direction.
The existing sample coverage/count/gap, freshness, gravity, summary consistency,
consent, ordering, ownership and staff-release checks all remain active.

The API adds server-owned `calibration.movementLimits` for feedback; submission
protocol 3 and stored bounded-summary keys remain unchanged. Only the local
live-reading object adds braking magnitude and separate left/right totals from
the existing accumulator. No raw samples or new research dataset are saved.

Steps 2–5 use an animated direction guide, elapsed-time ring and neutral live
sensor values. A locally recognized movement turns the relevant reading green;
it is not yet a pass. Laravel confirms the full recording, then success remains
visible for about 1.6 seconds before advancing. The final success returns to
setup overview and waits for staff release. Interrupted readings, absent or
opposite movement and excessive position changes still require recovery/retry.
No recording or following exercise starts without its own manual start.

Revision 2 changes the profile fingerprint. Unreleased revision-1 references
and results must restart at Stationary; prior attempts remain immutable. Already
released revision-1 records retain their original settings and durations.

## Provenance, consent and release

Laravel selects the profile. Each newly evaluated passed **or failed** calibration
attempt receives a server-owned `calibration_profile` snapshot in its existing
bounded evidence: ID, revision, resolved settings and SHA-256 fingerprint. The
fingerprint binds the profile identity/revision and settings. The API returns
only profile identity, revision and fingerprint alongside the existing guidance
limits. Clients cannot submit or overwrite the snapshot. Raw sample arrays,
customer identity and location history are not part of the trial record.

The opaque submission context includes the active profile fingerprint. Changing
profile or settings rejects an in-flight stale submission and invalidates
unreleased calibration progress, reference and noise baseline. Prior attempts
remain stored. A previously ready session projects as in progress and can repeat
Stationary under the new profile; it cannot release using incompatible results.
Already released history retains its original profile and timestamps.

Existing unprofiled attempts remain compatible with standard historical rules;
switching to RC requires fresh calibration. Their physical test platform is
unknown. Do not include them in an RC validation set merely because the current
environment selects RC.

The mobile entry disclosure identifies RC prototype recordings when that profile
is active. A profile/settings change clears the accepted disclosure scope;
fresh profile confirmation is checked before starting sensors. Per-exercise
Start recording, cancellation and foreground-only collection remain unchanged.

All six device checks and five effective calibration results remain required
when broad handover test mode is disabled. Staff still perform Start Rental;
there is no customer release action. RC mode supplies no fabricated results,
permission bypass, background tracking or trained classifier.

## Trial preparation

### Mobile Admin entry

The initial RC Research screen is an empty, protected mobile page with its title
and the existing sign-out control. It contains no research data, charts, sensor
subscriptions, recording controls or sample records.

With the local/testing `rc_demo` profile enabled, use the normal mobile **Sign in**
with an existing active JamJade Admin account. The app opens RC Research
automatically. There is one shared sign-in form; no account-type selector,
separate Admin login, default research credentials or new account is created.
Customer/Driver destinations and the web cookie/CSRF session remain unchanged.

`POST /api/mobile/login` keeps the existing login contract and throttle. After
checking the credentials and active account, Laravel selects the scope from
the account's roles. Admin accounts receive an eight-hour Sanctum token with
only the `rc-research` ability when local/testing RC mode is enabled. Admin takes
priority for mixed-role accounts and cannot obtain ordinary mobile access when
RC mode is disabled. Customer/Driver tokens retain their existing `mobile`
ability. Research tokens use a separate device-name namespace; signing in
replaces only that device's previous research token. The existing secure token
abstraction stores the mobile session. The separate research login and public
availability endpoints were removed.

`GET /api/mobile/rc-research` confirms access with a null data payload. Research
tokens may access only that authenticated endpoint, `/mobile/me` and
`/mobile/logout`. Laravel rechecks the active Admin role and local RC profile;
ordinary mobile tokens and web sessions cannot open the research endpoint.
Disabling RC mode or removing the role denies session restoration, while logout
can still revoke the research token. The page checks access on focus and return
to the foreground, and offers retry for connection failures.

This increment does not define or implement research sessions, trial labels,
raw sample storage, export, retention or model training. Agree that data contract
before adding capture controls.

Planning follow-up — 2026-10-18: the
[RC Research data contract and collection protocol](rc-research-data-protocol.md)
records the agreed fixed-load normal/harsh collection direction and proposes the
separate research dataset and future training pipeline. It does not implement
capture or relax the existing calibration/rental data boundaries; unresolved
protocol, physical-device and retention/security decisions are listed there.

Collection follow-up — 2026-10-18: the protected research page now has Data /
Collect / Logout tabs with Collect in the center, matching the Driver bar.
Session setup, movement dropdowns, recording and trial review switch in place
inside Collect. Recording stops only through the tester's Stop reading action;
there is no automatic timer or save. The separate research API stores reviewed
raw motion in private encrypted files and exposes owner-bound summaries and
explicit deletion. Retention is until the owning Admin deletes the recording.
Physical Android/iOS collection/upload checks, export and training remain pending.
See the [current protocol](rc-research-data-protocol.md) for implementation bounds.

## Controlled trial sequence

1. Run real device setup and accept the RC calibration disclosure. Record
   Stationary with the RC car powered as it will be during the demonstration,
   stopped on the test surface. Do not describe an electric RC motor at rest
   as a full-size engine idling.
2. Repeat parked baseline trials before tuning. As an initial collection plan,
   collect five tuning trials and five separate validation trials per condition;
   this is a pilot target, not a statistical sufficiency claim.
3. After an accepted Stationary reference, record short straight starts from
   rest, coasting, then controlled stops. Keep intended motion and observed
   result separate. Repeat no-movement controls too. A commanded forward start
   is not an automatically verified forward ground truth.
4. Restart calibration explicitly between Forward trials after a pass, or
   between complete sequences. The ordered workflow must not be bypassed.
   A failed Forward trial can be retried under its existing Stationary reference.
   Record when a reference changes instead of pooling baselines silently.
5. Once Forward genuinely qualifies, test gentle braking and left/right turns
   in order. Include no-braking and opposite-turn controls where applicable.
   Forward learns its direction from the first qualifying horizontal movement;
   reversing during that learning step is **not** a negative control that the
   current algorithm can independently identify and reject.
6. Stop if the mount comes loose or readings are interrupted. Retain the failure
   and retry after recovery; do not trim the failed interval or invent evidence.

The initial strict pilot may stop at Forward, as current RC attempts have done.
That is evidence for the next computation/threshold review, not a complete
five-exercise validation. Do not bypass the earlier exercise to claim later
exercises have been validated. Native capture changes require separate review.

## Trial worksheet

Copy this row for every attempted recording. Keep the worksheet local/private
with the technical results, and omit customer names, booking codes, tokens and
GPS coordinates from defense material.

| Trial | Block / split | Commanded motion | Expected result and reason | Capture time | Saved result / message | Reference changed? | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| … | … | … | … | … | … | … | … |

For analysis, correlate the trial with its private bounded setup-step summary:
count, sensor span, gap, acceleration RMS/horizontal RMS, rotation RMS/peak,
tilt, separate yaw totals, Forward window duration/count/mean/coherence, outcome,
and the profile snapshot. The current customer API intentionally does not expose
private attempt evidence or database IDs; use authorized backend inspection.
Manual block/trial conditions are worksheet annotations, not fields collected
or verified automatically by the app. This phase adds no raw telemetry dataset.

## Choosing and validating RC limits

Analyze sampling/transport failures separately from motion failures. A missing
stream is not evidence of weak acceleration. Retain full-capture quality
statistics when a candidate window resets.

Compare parked and controlled moving trials, then identify which criterion
rejects otherwise reproducible movement. Gyro peak combines all three axes;
body pitch/roll and vibration can raise it without demonstrating a sustained
turn. A tilt estimate does not by itself distinguish phone slippage, body tilt
or errors in the platform gravity estimate. Existing aggregate summaries cannot
reconstruct vibration frequency or justify a particular filter cutoff.

Do not multiply thresholds by the vehicle scale, set a gyro limit from one
70°/s peak, or lower coherence until a selected run passes. If a filtering or
motion-window redesign is required, document the computation and test it
separately while preserving sampling integrity and profile provenance.

Freeze candidate RC settings before using the held-out trials. Report the
number of expected-valid accepted/rejected trials, expected-invalid accepted/
rejected trials, interrupted captures and recovery outcomes. Explain ambiguous
or unsupported controls rather than scoring them as verified detections.
Keep tuning and validation results separate. Record all settings revisions;
changing them invalidates the current calibration and requires a new reference.

## Sources of implementation truth

- [Calibration computation and sensor fusion](telematics-calibration-computation.md)
- [Calibration workflow and verification](telematics-calibration.md)
- [Profile service](../backend/app/Services/TelematicsCalibrationProfileService.php)
- [Calibration evaluation](../backend/app/Services/TelematicsCalibrationService.php)
- [Server configuration](../backend/config/telematics.php)

## Verification — 2026-10-17

RC revision 2 passed all 653 backend tests (3,665 assertions), including 76
calibration cases. Fifty-eight focused mobile calibration/capture/workflow tests,
mobile lint and TypeScript, PHP formatting, documentation checks, and Android/iOS
bundle exports passed. Tests exercise actual three-second capture timers and
aggregate feedback on both platform adapters, wrong/missing movement rejection,
unchanged Stationary/standard limits and retained staff release. Local runtime
inspection confirmed RC revision 2, six-second Stationary and three-second
recordings for steps 2–5. Controlled physical RC trials and visual/device smoke
tests remain pending; automated tests do not validate the demonstration thresholds.

The unified sign-in follow-up passed all 640 backend tests (3,557 assertions),
including 64 focused login/mobile API cases. Six mobile service/navigation tests,
mobile lint and TypeScript, PHP formatting, and Android/iOS bundle exports passed.
Admin sign-in now uses the existing mobile endpoint and form; the separate entry
and availability endpoints are removed. Physical-device sign-in remains pending.

The subsequent empty Admin-entry increment passed all 638 backend tests (3,561
assertions), including 29 dedicated research-access cases. Six focused mobile
service/navigation tests, mobile lint and TypeScript, PHP formatting, and Android
and iOS bundle exports passed. Sign-in and the empty screen still require
physical-device smoke testing. No research recording or dataset is implemented.

The full backend `composer test` run passed 609 tests (3,459 assertions), using a
temporary CLI-only 512 MB memory configuration. Seventy focused mobile telematics
Node tests passed. Mobile/web lint and TypeScript checks, PHP formatting and
documentation link/diff checks passed. Backend regressions cover environment
isolation, server-owned provenance on both outcomes, RC-only overrides, stale
contexts, incompatible ready-state recovery, production release protection and
immutable released profile/timestamp history. Mobile tests cover disclosure-scope
changes before capture and server-owned outcomes under RC mode.
The focused calibration run passed 63 cases (416 assertions), including booking
summary recovery so staff actions agree with the effective calibration status.

Local runtime inspection confirmed `rc_demo` selected, unchanged limits, broad
handover test mode disabled, and the backend responding. The Android phone was
no longer connected over ADB when this profile was activated, so device reload
and the new disclosure/Stationary copy could not be physically checked. iOS and
controlled RC trial results remain pending; synthetic tests do not validate the
numerical thresholds or complete the defense experiment.
