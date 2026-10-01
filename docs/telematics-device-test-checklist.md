# Android development-build telematics checklist

Use an Android physical device and the internal Expo development client. Expo Go is not sufficient for background-location readiness verification.

1. From `mobile-frontend`, run `npx expo prebuild --clean`, then `npx expo run:android --device`, and start Metro with `npx expo start --dev-client`.
2. Sign in as the renter who owns a confirmed Self Drive booking with finalized outgoing inspection, an immutable booking geofence, and staff-started handover.
3. Open Telematics and confirm the authoritative session is `in_progress`; verify all calibration steps visibly remain next-phase/pending.
4. Run Device check. Confirm real accelerometer, gyroscope, and location-services capability results are reported; turn off Android location services and retry to verify a recoverable failure.
5. Run Motion permission. Test the normal grant result and, where Android exposes denial, confirm the failure message and Settings recovery.
6. Run foreground location. Deny it once, verify no GPS check can succeed, then grant it through the app or Settings and retry.
7. Run background location. Confirm foreground location is required first; on Android versions that route to Settings, grant the required access and return. Verify no notification, location update, trip, upload, or route history is created by this readiness step.
8. With clear sky and foreground access, run GPS check. Verify a fresh high-accuracy fix passes; test stale/poor accuracy using backend integration coverage rather than fabricated mobile coordinates.
9. Test geofence verification at an authorized inside location and an outside location only with consent. Confirm the UI shows only inside/outside, distance, and radius—not coordinates.
10. Confirm phone mount, then verify the setup session still remains `in_progress` because calibration is not part of Phase 3 and Start Rental is still blocked.
11. Inspect API responses and activity logs to confirm they contain no raw latitude/longitude, sensor stream, token, or other sensitive payload.
