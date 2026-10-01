# Telematics device and location readiness

## Phase 3 boundary

Phase 3 is a consent-led, pre-release readiness workflow for a renter's own confirmed or ongoing Self Drive booking. It implements only:

- device capability checks for accelerometer, gyroscope, and location services;
- motion, foreground-location, and background-location permission readiness;
- one explicit foreground GPS fix for setup quality and circle or polygon geofence verification;
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

The screen explains each purpose before the corresponding user action. It requests in this order:

1. Check device capabilities without subscribing to sensors.
2. Request motion access where the platform exposes it. A denial or unavailable result fails only that step and provides retry/settings recovery.
3. Request foreground location. A denial prevents later GPS operations.
4. Request background location only after foreground access is granted. Android may route the renter to system settings. The app checks TaskManager availability and that the globally defined inert task exists, but does not register it for updates.
5. Obtain one fresh foreground location fix only after location services and foreground access are confirmed.
6. Submit that fix for server-side GPS quality or booking-geofence evaluation.
7. Let the renter explicitly confirm a secure phone mount.

Every action checks network state before attempting to synchronize its evidence. Native APIs are isolated in `mobile-frontend/services/telematics`; screens do not call Expo Location, Sensors, TaskManager, or Network directly.

## GPS and geofence policy

Laravel accepts only a fresh, plausible setup coordinate: latitude `-90..90`, longitude `-180..180`, enabled location services, capture timestamp no more than 60 seconds old, timestamp no more than 10 seconds in the future, and horizontal accuracy no worse than 50 meters. These defaults live in `backend/config/telematics.php` and must remain configuration-driven.

Laravel, not the client, evaluates the immutable `booking_geofences` snapshot. Circles use the Haversine distance formula and include their boundary; polygons use a point-in-polygon check and include points on their edges. The server stores only minimal setup evidence: GPS quality/age and the geofence result. It discards the submitted latitude and longitude after evaluation. The handover response exposes no raw setup evidence or submitted setup coordinates.

Reusable `geofences` are staff templates. Before handover, staff either select an active circle or polygon template or enter a custom circle; Laravel copies the geometry into one immutable booking snapshot. Changing or deactivating a source template later cannot alter an existing booking boundary. A used template cannot be deleted; unused templates are soft-deleted and retained for system history.

## Server contract and recovery

`POST /mobile/bookings/{booking}/telematics-setup/steps/{step}/attempt` is restricted to the owning renter's eligible Self Drive booking and an `in_progress` setup session. It accepts typed evidence for only the seven Phase 3 steps. `status` is prohibited in both the request and evidence; Laravel produces the recorded pass/fail result and appends retry history. Dependencies are enforced in order, so callers cannot skip earlier checks.

Failure is recoverable: the app shows the server reason or local permission/location failure, offers device Settings, and allows a new attempt. Business activity logs record the step and server result only—never raw coordinates or sensor payloads. The final calibration steps remain pending in this phase, therefore session status stays `in_progress` and Start Rental remains blocked.
