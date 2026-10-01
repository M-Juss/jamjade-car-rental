# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

For telematics work, read `../docs/telematics-architecture.md`, `../docs/telematics-handover-lifecycle.md`, and `../docs/telematics-device-location.md`. Phase 3 permits only the documented setup-readiness calls through `services/telematics`; do not call Expo sensor/location APIs from screens, fake coordinates or results, subscribe to sensors, register active location updates, upload telemetry, create trips, or implement calibration. Any active-trip collection needs separately approved consent, retention, background-execution, and platform verification work.

Keep the Telematics tab stable, but never decide availability from cached profile or booking state. Render the server's telematics handover eligibility and locked reason; only show Phase 3 actions when it returns `canWorkSetup`.
