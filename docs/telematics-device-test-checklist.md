# Physical telematics readiness checklist

This checklist is an evidence plan for Phase 3. The repository currently records the implementation, but no physical Android or iOS readiness result is recorded. Mark each platform only after a real device run and attach the date, device/OS, development-build identifier, booking context, and observed result. Backend integration tests with synthetic coordinates do not satisfy this checklist.

## Shared setup

1. Build and install the internal Expo development client. Expo Go is not sufficient for background-location readiness verification. For Android, use `npx expo prebuild --clean`, `npx expo run:android --device`, and `npx expo start --dev-client` from `mobile-frontend`. For iOS, use the authenticated development EAS profile or `npx expo run:ios --device` where local Xcode supports it.
2. Sign in as the renter who owns a confirmed Self Drive booking with finalized Outgoing Inspection and staff-started handover. Monitoring zones are optional and are not setup prerequisites; they are not assigned through the mobile flow.
3. Open Telematics and confirm the authoritative session is `in_progress`. Verify the five calibration types visibly remain pending. The standard-mode session must remain blocked from Start Rental after the six available checks; local/testing handover mode is a separate test exception.
4. Select **Check setup** once. The app runs the six available checks in order and shows each server-confirmed result or local native failure. It stops at the first failure in standard mode; resolve the failure and run the action again. The phone-mount step pauses for an explicit confirmation.
5. Verify the sequence and evidence below. Do not invent native results or coordinates. A failed OS permission or GPS check should be retried after changing the device state. If typed evidence is submitted, its failed result remains an append-only server record; a native exception that produces no evidence remains local and is never replaced with a fabricated result.

## Android verification

1. Device check: confirm real accelerometer, gyroscope, and location-services capability results. Turn off Android location services and run **Check setup** again to verify a recoverable device-check failure.
2. Motion permission: verify the normal grant result and, where Android exposes denial, confirm the failure message and Settings recovery.
3. Foreground location: deny it once, verify the GPS step cannot proceed, then grant it through the prompt or Settings and retry.
4. Background location: confirm foreground location is required first. On Android versions that route to Settings, grant the required access and return to the app. Verify that this readiness step creates no notification, location update, trip, upload, or route history.
5. GPS check: with location services and foreground access enabled, request a fresh high-accuracy fix in a clear area. Use backend integration coverage for stale/poor-accuracy cases rather than fabricated mobile coordinates.
6. Phone mount: safely park, secure the phone upright in the vehicle mount with the screen facing the driver, and confirm the prompt. This is a manual attestation; the app does not detect the holder automatically.
7. Repeat with a valid GPS fix outside any monitoring zone and with no zones configured. Setup must still evaluate independently of zone membership; no zone check or assignment should appear and exact coordinates must remain absent from setup responses.

## iOS verification

1. Device check: confirm real accelerometer, gyroscope, and location-services capability results. Disable iOS Location Services and verify the app reports a recoverable failure, then restore the setting.
2. Motion permission: grant motion access when iOS presents the prompt. Deny it once where the OS permits, verify the server records a failed attempt, and use Settings recovery before retrying.
3. Foreground location: test the normal grant path and a denied/restricted path. Confirm GPS work does not proceed without foreground access and that the app explains how to recover in Settings.
4. Background location: after foreground access is granted, run the check and verify the iOS permission/task result returns to the app. Confirm no background location updates, trip, upload, or route history starts during readiness.
5. GPS check: with services and foreground access enabled, request one fresh high-accuracy fix outdoors or near a clear window. Use backend integration coverage for stale/poor-accuracy cases rather than fabricated mobile coordinates.
6. Phone mount: safely park, secure the phone upright in the vehicle mount with the screen facing the driver, and confirm the prompt. Record that this is a manual attestation rather than holder detection.
7. Repeat with a valid GPS fix outside any monitoring zone and with no zones configured. Setup must remain independent of zone membership, and exact coordinates must not appear in setup responses.

## Evidence and privacy checks

1. In standard mode, confirm that the six available checks and the explicit mount confirmation still leave the session `in_progress` because calibration is not implemented. In local/testing handover mode only, a real passing mount attempt may make the session `ready_for_release`; other check outcomes must remain truthful and no calibration result may be fabricated.
2. Inspect API responses and activity logs for both platforms. They must contain no raw latitude/longitude, sensor stream, token, or other sensitive payload. Setup evidence may expose only the server-sanitized quality/result summary.
3. Record the outcome as **passed**, **failed**, or **blocked**, with the date and reason. Do not call a platform physically verified from a simulator, emulator, browser smoke check, code inspection, or backend test alone.
