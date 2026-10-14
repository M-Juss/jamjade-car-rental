# Telematics device and location readiness

## Phase 3 boundary

Phase 3 is a consent-led, pre-release readiness workflow for a renter's own Self Drive booking. The read model may describe an ongoing booking, but setup mutations are accepted only for the owning confirmed booking while its handover is `in_progress`. It implements only:

- device capability checks for accelerometer, gyroscope, and location services;
- motion, foreground-location, and background-location permission readiness;
- one explicit foreground GPS fix for setup quality;
- renter confirmation that the phone is safely mounted.

It does not subscribe to motion sensors, call `startLocationUpdatesAsync`, collect location in the background, persist a mobile location cache, upload telemetry, create a trip, perform calibration, or score driving. The background task is globally defined but deliberately inert; it cannot execute tracking work because no location updates are registered.

## Native dependencies and build context

The Expo SDK 54 application uses `expo-location`, `expo-task-manager`, `expo-sensors`, `expo-network`, and `expo-dev-client`. The app config declares the iOS location/motion explanations and iOS/Android background-location capability. The `development` EAS profile builds an internal development client.

Expo Go is not a valid verification target for background-location readiness. Build and run a development client after changing native configuration:

```sh
cd mobile-frontend
npx expo prebuild --clean
npx expo run:android --device
npx expo start --dev-client
```

For an EAS build, use the configured `development` profile through the team's authenticated EAS workflow. Never add a production background-tracking feature to this setup flow without a new consent and release review.

## Permission and readiness sequence

The screen explains each purpose before the renter selects **Check setup**. That single action runs the available checks in this order, showing each server-confirmed result and stopping at the first failure in standard mode:

1. Check device capabilities without subscribing to sensors.
2. Request motion access where the platform exposes it. A denial or unavailable result fails only that step and provides retry/settings recovery.
3. Request foreground location. A denial prevents later GPS operations.
4. Request background location only after foreground access is granted. Android may route the renter to system settings. The app checks TaskManager availability and that the globally defined inert task exists, but does not register it for updates.
5. Obtain one fresh foreground location fix only after location services and foreground access are confirmed.
6. Submit that fix for server-side GPS quality evaluation.
7. Ask the renter to explicitly confirm a secure phone mount. This is a manual attestation, not holder detection or sensor-based mounting verification. Choosing **Not yet** submits `confirmed: false`; dismissing the confirmation submits no mount evidence.

Running **Check setup** again performs fresh checks from the beginning; already granted OS permissions do not imply a new permission grant. Leaving the tab stops further checks and submissions once any pending native operation returns. Local handover test mode may continue past real device failures as documented in the handover guide, but never invents evidence or a passed result.

Every action checks network state before attempting to synchronize its evidence. Native APIs are isolated in `mobile-frontend/services/telematics`; screens do not call Expo Location, Sensors, TaskManager, or Network directly.

## GPS readiness policy

Laravel accepts only a fresh, plausible setup coordinate: latitude `-90..90`, longitude `-180..180`, enabled location services, capture timestamp no more than 60 seconds old, timestamp no more than 10 seconds in the future, and horizontal accuracy no worse than 50 meters. These defaults live in `backend/config/telematics.php` and must remain configuration-driven.

GPS quality is independent of geofence membership. Being outside a zone, or having no zones configured, never fails a setup check. Geofence setup attempts are no longer accepted and phone mount depends on the GPS check. The mobile setup sequence has six device-readiness checks.

Monitoring zones are managed exclusively through the website. Admin controls default zones and optional custom booking zones; Staff has read access. Defaults apply automatically and zone geometry/preferences are frozen at rental release. Entry/exit observations belong to the active-trip backend, not setup. See [geofence monitoring](geofence-monitoring.md).

## Server contract and recovery

`POST /mobile/bookings/{booking}/telematics-setup/steps/{step}/attempt` is restricted to the owning renter's eligible Self Drive booking and an `in_progress` setup session. It accepts typed evidence for only the six Phase 3 steps. `status` is prohibited in both the request and evidence; Laravel produces the recorded pass/fail result and appends retry history. Standard mode enforces dependencies in order, so callers cannot skip earlier checks; local/testing handover mode deliberately removes that prerequisite gate for flow testing.

Failure is recoverable: the app shows the server reason or local permission/location failure, offers device Settings, and allows a new attempt. Business activity logs record the step and server result only—never raw coordinates or sensor payloads. In standard mode, the final calibration steps remain pending in this phase, therefore session status stays `in_progress` and Start Rental remains blocked. Local/testing handover mode may project release readiness from a real passing phone-mount attempt as documented in [the handover guide](telematics-handover-lifecycle.md); it still records no fabricated evidence.
