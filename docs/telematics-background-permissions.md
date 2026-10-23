# Rental background-location permission preparation

Current follow-up: [background latest-location sharing](telematics-background-sharing.md)
is now implemented as a separate explicit action. The preparation controls still
request permissions only; the historical preparation-only boundary below records
the initial increment.

## Approved increment — 2026-10-18

This increment prepares **permissions only** for future consented background
latest-location sharing. It does not register a task, obtain a GPS fix, start or
resume collection, create a trip, persist consent, or upload anything. Current
foreground sharing still stops on non-active AppState; the customer must resume
it manually. Background execution and its start/stop/retention/session design
remain a separate approved increment.

The existing setup `background_location` check already requests platform access.
This rental flow reuses its `getBackgroundLocationReadiness` and
`requestBackgroundLocationAccess` abstraction, leaving setup evidence and its
server rules unchanged. A previously allowed permission is displayed without
another system prompt. Permission state is not proof of active collection.

## Rental UI and flow

While an owning released rental can monitor and foreground sharing is inactive,
the existing Monitoring card adds **Background access**, with Allowed, Not
allowed, Location off, Unavailable, Not checked and checking states.
`RentalBackgroundLocationAccess` reuses InfoRow and ActionButton; the modal
follows the existing location-sharing disclosure's safe-area, scrollable-body,
fixed-action, information-icon and close-button pattern. No extra checkbox is
added. The Allowed message explicitly says sharing still pauses when minimized.

**Prepare background access** opens **Before background access**. It explains
the intended active-rental GPS purpose and authorized staff audience, platform
Settings instructions, current preparation-only limitation, declining/revoking
access and the separate future sharing action. Not now, backdrop, close and
Android Back dismiss it without a permission request or monitoring action.
**Continue to permissions** dismisses it before native work; iOS waits for modal
onDismiss and Android defers the work until after dismissal. Pending actions are
cleared if the app leaves the foreground before preparation starts.

Before requesting permissions, the hook rereads the existing monitoring endpoint
to verify the rental is still eligible. It requests foreground access first only
when needed and allowed to ask again. Background permission is requested only
after foreground access is granted. Rejected foreground permission prevents the
background request. Granted permission is reused; permanently denied access
provides Settings recovery. After a denied attempt, Settings is offered even if
the native API still claims another prompt is possible, covering iOS Allow Once.
Location services disabled, unsupported platform, Expo Go or unavailable native
TaskManager/background infrastructure never trigger permission prompts.

Android may open device Settings to **Allow all the time**. iOS requires
**Always**; choosing Allow Once can cause a later request to be denied without a
prompt, requiring Settings. Read-only rechecks run on screen focus and return to
active AppState. They never request permissions or resume sharing automatically.
Duplicate preparation taps are ignored; stale reads and responses after blur,
unmount or booking change are ignored. Native failures receive a safe retry
message rather than raw errors. OS prompts/Settings can interrupt foreground
state; the existing foreground sharing lifecycle is unchanged.

## Boundaries and contracts

- Native behavior is isolated in `services/telematics/background-location-access.ts`.
- Permission orchestration is in `hooks/telematics/useBackgroundLocationAccess.ts`.
- No request payload, Form Request, Zod schema or backend contract changes.
  The only backend call is the existing authorized read before preparation;
  these controls do not submit a new data form or telemetry consent record.
- No dependency, app configuration, native permission declaration, or native
  task definition is added. The existing readiness task remains inert.
- Foreground disclosure, consent version, in-memory collection token, encryption,
  retention, Reverb and latest-location map reads remain unchanged.
- Background permission alone must never activate future collection. That phase
  must define explicit collection consent and start/stop, persistent session
  protection, task execution, notification/indicator, receipt and logout cleanup,
  OS termination limitations and physical platform validation separately.

## Verification and manual check

29 focused Node checks passed: 13 new permission-adapter cases plus 16 existing
foreground session, adapter and API/schema cases. New cases cover both Android
and iOS granted/denied flows, permission ordering, unsupported platforms/Expo Go,
location services/native readiness and cancellation between prompts. Mock native
interfaces deliberately expose no location/watch/register/upload function.
Mobile lint and TypeScript passed; both Android and iOS Hermes exports passed.
Offline Expo dependency compatibility check reports up to date, with Expo's
usual offline-validation limitation. No new native build is required by this
JavaScript-only increment if the installed development build already has the
existing location/TaskManager permissions and configuration.

Synthetic browser layout checks render the actual disclosure and permission
panel using HTML native adapters, bundled Urbanist fonts and the mobile Tailwind
theme. They verify the 320 px dialog's fixed actions/scrolling body, platform
instructions and allowed/denied/unavailable panel copy. They do not verify native
modal/OS permission behavior, actual safe-area measurements or system Settings.
Physical Android and iOS permission prompts/Settings remain pending.

On a physical development build, safely parked:

1. Open the released rental. If currently sharing, use Stop sharing before
   preparing permissions; no active watcher should run during this check.
2. Inspect Background access. Existing granted access should say Allowed and
   explain that minimizing still pauses sharing.
3. If not allowed, open Prepare background access, cancel, and confirm no prompt.
4. Open it again and continue. Confirm foreground-before-background ordering and
   correct platform wording. Declining must leave ordinary foreground sharing
   usable; no background GPS updates should start.
5. If blocked, choose Open device settings, review the disclosure and continue,
   change access manually, return and verify
   the read-only status refresh without collection starting.
6. Resume ordinary foreground sharing separately; minimizing must still pause.

References checked against exact Expo SDK 54 sources:
[Location guide](https://github.com/expo/expo/blob/sdk-54/docs/pages/versions/v54.0.0/sdk/location.mdx),
[Location API](https://github.com/expo/expo/blob/sdk-54/packages/expo-location/src/Location.ts),
and [TaskManager guide](https://github.com/expo/expo/blob/sdk-54/docs/pages/versions/v54.0.0/sdk/task-manager.mdx).
