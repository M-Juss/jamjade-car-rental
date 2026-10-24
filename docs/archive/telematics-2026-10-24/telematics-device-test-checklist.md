> **Historical archive — 2026-10-24.** This is a superseded working-copy snapshot, not current coding guidance. Read the [central implementation guide](../../telematics-master-plan.md). Historical plans, exclusions, platform targets, and verification statements below retain their original dates; relative Markdown links were rebased for this archive.

# Physical telematics readiness checklist

Android-only scope — 2026-10-24: `mobile-frontend` now targets Android only; iOS and mobile-browser support are retired. Earlier dated multi-platform descriptions and results below are historical. Shared Laravel contracts, saved records and the separate Next.js website are unchanged. Current physical verification is required on Android. See [Android-only mobile scope](../../android-only-mobile.md).

This checklist is an evidence plan for device readiness and the subsequent supervised calibration stage. The repository currently records the implementation, but full physical Android readiness remains pending. Mark each check only after a real device run and attach the date, device/OS, development-build identifier, booking context, and observed result. Backend integration tests with synthetic coordinates do not satisfy this checklist.

## Shared setup

1. Build and install the internal Expo development client. Expo Go is not sufficient for background-location readiness verification. For Android, use `npx expo prebuild --platform android --no-install`, `npx expo run:android --device`, and `npx expo start --dev-client` from `mobile-frontend`.
2. Sign in as the renter who owns a confirmed Self Drive booking with finalized Outgoing Inspection and staff-started handover. Monitoring zones are optional and are not setup prerequisites; they are not assigned through the mobile flow.
3. Open Telematics and confirm the authoritative session is `in_progress`. Verify that calibration has not yet passed and is presented as the next stage only after device readiness. The standard-mode session must remain blocked from Start Rental after the six available checks; local/testing handover mode is a separate test exception.
4. Select **Check setup** once. The app runs the six available checks in order and shows each server-confirmed result or local native failure. It stops at the first failure in standard mode; resolve the failure and run the action again. The phone-mount step pauses for an explicit confirmation.
5. Verify the sequence and evidence below. Do not invent native results or coordinates. A failed OS permission or GPS check should be retried after changing the device state. If typed evidence is submitted, its failed result remains an append-only server record; a native exception that produces no evidence remains local and is never replaced with a fabricated result.

## Android verification

1. Device check: confirm real accelerometer, gyroscope, and location-services capability results. Turn off Android location services and run **Check setup** again to verify a recoverable device-check failure.
2. Motion permission: verify the normal grant result and, where Android exposes denial, confirm the failure message and Settings recovery.
3. Foreground location: deny it once, verify the GPS step cannot proceed, then grant it through the prompt or Settings and retry.
4. Background location: confirm foreground location is required first. On Android versions that route to Settings, grant the required access and return to the app. Verify that this readiness step creates no notification, location update, trip, upload, or route history.
5. GPS check: with location services and foreground access enabled, request a fresh high-accuracy fix in a clear area. Use backend integration coverage for stale/poor-accuracy cases rather than fabricated mobile coordinates.
6. Phone mount: safely park, secure the phone in a fixed vehicle mount, and confirm the prompt. This is a manual attestation; the app does not detect the holder automatically.
7. Repeat with a valid GPS fix outside any monitoring zone and with no zones configured. Setup must still evaluate independently of zone membership; no zone check or assignment should appear and exact coordinates must remain absent from setup responses.


## Evidence and privacy checks

1. In standard mode, confirm that the six available checks and the explicit mount confirmation still leave the session `in_progress` until all five real calibration checks also pass. In local/testing handover mode only, a real passing mount attempt may make the session `ready_for_release`; other check outcomes must remain truthful and no calibration result may be fabricated.
2. Inspect API responses and activity logs for both platforms. They must contain no raw latitude/longitude, sensor stream, token, or other sensitive payload. Setup evidence may expose only the server-sanitized quality/result summary.
3. Record the outcome as **passed**, **failed**, or **blocked**, with the date and reason. Do not call a platform physically verified from a simulator, emulator, browser smoke check, code inspection, or backend test alone.

## Supervised calibration verification

Use [the calibration procedure](telematics-calibration.md) in a controlled area
with Staff present. A demo screen can verify native capture and UI behavior but
does not establish full rental handover or moving-calibration readiness.

1. Verify both consent confirmations and that unchecked confirmations block capture.
2. While parked, record stationary calibration. Check sample coverage, actual
   native availability, flat, upright and tilted mount references and truthful failure/retry behavior.
3. Start each movement recording while parked; keep the mounted phone untouched
   while Staff directs gentle forward movement, braking, left and right turns.
   Validate actual axis signs and quality limits on Android.
4. Cancel a capture, leave the screen, and background the app. Verify immediate
   unsubscription, no later evidence submission and no background recording.
5. Re-run stationary calibration and a device check. Verify later calibration
   projections become pending while their previous attempts remain retained.
6. Confirm all eleven checks produce `ready_for_release` in standard mode;
   authorized Staff Start Rental must remain the only release action.
7. Verify stale contexts, offline capture completion, expired rental intervals,
   competing handovers and server failures do not fabricate successful results.

Physical moving calibration and full Android readiness remain
pending until their individual evidence is recorded; do not infer them from a
stationary sensor smoke test or a successful native bundle.

## Physical Android smoke evidence — 2026-10-16

- Device: Redmi Note 8 Pro, Android 11, installed JamJade development client
  (`com.anonymous.jamjadecarrental`, version 1.0.0, versionCode 1).
- Context: isolated temporary demo bundle; synthetic booking labels; no live
  booking mutation, payment, GPS request, trip or server calibration submission.
- Explicit user consent was obtained for one six-second foreground motion test.
- Result: actual DeviceMotion capture completed with 91 readings over 5.89 seconds,
  maximum observed gap 88 ms and acceleration RMS 0.107 m/s². The capture ended
  automatically and the test button returned. This verifies native capture on
  this device, not vehicle calibration or all device-readiness permissions.
- The guided calibration UI rendered natively. The test exposed duplicate React
  keys for sibling calibration/results components; distinct keys fixed the warning
  before the motion run.
- Still pending: vehicle mount and moving direction/sign/threshold validation,
  full real-booking standard handover and staff release, physical interruption
  paths and full Android permission/GPS readiness. The earlier iOS validation goal was retired on 2026-10-24.
