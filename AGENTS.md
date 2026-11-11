# JamJade Car Rental Agent Guide

## Scope

This file defines repository-wide instructions for JamJade Car Rental. A more specific `AGENTS.md` inside an application adds to these rules and takes precedence only for that application when instructions conflict.

The repository contains three independent codebases:

- `backend/`: Laravel API and shared backend for both frontends.
- `web-frontend/`: Next.js website for administrators and staff.
- `mobile-frontend/`: Android-only Expo and React Native application for customers and assigned Drivers.

The applications share one repository but are not one package-manager workspace. Run commands from the application directory they belong to, and do not assume dependencies, types, or runtime code are shared between applications.

Read `docs/README.md` for the documentation map, then `docs/project-status-and-roadmap.md` for current project decisions, phase status, and the capstone's AI classification goal. Use the domain guides below for detailed contracts and inspect code before assuming a documented feature is operational. For telematics and RC research, `docs/telematics-master-plan.md` is the single active guide; archived guides are historical only.

Keep the programmer's architecture reference at `docs/system-architecture-and-technologies.md` current when architecture, technologies, or application responsibilities change. For completed work, update the owning domain guide with what changed, why, how the implementation works, relevant source paths, checks actually run, and remaining limitations. Document technologies actually used and agreed future plans; clearly distinguish implemented, experimental, and planned work. Do not inventory unused alternatives or rejected options unless needed to explain a current implementation. Keep telematics details in its central guide and link to them rather than creating a competing plan.

## Product Architecture

- Laravel is the authoritative backend, data-access layer, validation boundary, and authorization boundary.
- Read `docs/user-roles-and-access.md` before changing personnel roles, account lifecycle, or Staff/Driver authorization. Admin/Owner separation is deferred.
- The web frontend uses Laravel's stateful session, cookie, and CSRF authentication flow.
- The mobile frontend uses Laravel Sanctum bearer tokens stored through the existing secure storage abstraction.
- Both frontends communicate with Laravel through the existing API service layers. Do not call backend URLs directly from presentation components when a service module should own the request.
- Treat Laravel Form Requests as request contracts and Laravel API Resources as response contracts.
- A contract change is not complete until every affected backend endpoint, web client, mobile client, type, validation schema, mapping, and test has been reviewed.

## Current Cross-Application Boundaries

- Delivery pricing is an administrator-only setting: the minimum fee, included distance, and per-kilometre rate are edited from the web management portal. The configured garage point remains backend delivery configuration and is not edited or overwritten by the Pricing Settings screen. Laravel automatically selects the quickest returned driving estimate and issues one complete delivery quote with zero upfront toll. Actual tolls are recorded through existing Additional Charges after Incoming Inspection; customer booking must disclose this before acceptance. Legacy unconsumed quotes require fresh confirmation, while accepted bookings keep their amounts. Customer booking creation accepts only a still-valid, complete quote; delivery quote expiry and booking-context validation remain server rules. Read `docs/delivery-pricing.md` before changing this flow.
- Self-drive monitoring uses the geofence library's active circle or polygon defaults plus optional booking-specific zones. Zones can be changed before release, but `Start Rental` copies and freezes every zone and its alert settings into the booking snapshot. Zone configuration and containment never gate setup checks or release. Read `docs/geofence-monitoring.md` before changing this flow.
- Self-drive verification requires an eligible age, approved driver's license and proof of billing, and a saved emergency contact with a name, relationship, and phone number. The mobile UI calls proof of billing “Proof of Address”. Backend storage and APIs use `proof_of_billing`. Passport is a historical document type for legacy customers.
- Mobile account credentials have separate endpoints and forms: `PUT /mobile/account/email` handles the new email plus current password, while `PUT /mobile/account/password` handles current password, new password, and confirmation. Keep these flows separate from personal-profile and onboarding saves.
- Web booking forms belong under `web-frontend/src/forms/booking/`. Booking action sequencing is owned by `web-frontend/src/modules/management/bookings/booking-next-action.ts` and `booking-workflow.ts`; API calls and payload mapping stay in `web-frontend/src/services/booking/`. Route entries should only compose the module.
- Web geofence editors use the singleton Google Maps loader at `web-frontend/src/lib/google-maps.ts`. Reuse `loadGoogleMaps` and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for new map consumers; Fleet Monitoring also uses this shared loader and its existing browser API key.

- Vehicle Management Configure is an Admin-only persistent option library. Read `docs/vehicle-configuration.md` before changing vehicle catalogs or inspection checklists; preserve saved vehicle values, checklist-version checks, and finalized snapshot labels.

## Working Principles

- Inspect the affected application's existing structure and nearby code before making changes.
- Make the smallest complete change that solves the requested problem. Do not perform unrelated refactors or cleanup.
- Preserve established behavior unless a behavior change is explicitly requested.
- Prefer installed framework capabilities and existing project dependencies over new packages.
- Check official documentation for the exact installed framework version before using unfamiliar or version-sensitive APIs. Mobile changes must also follow `mobile-frontend/AGENTS.md`.
- Do not add backward-compatibility layers without a concrete persisted-data, released-client, or external-consumer requirement.
- Keep business rules out of visual components. Keep network requests in services and reusable domain behavior in the appropriate feature, service, hook, or library module.
- Remove temporary logs, commented-out code, dead imports, and generated artifacts introduced by the change before finishing.
- Never expose credentials, tokens, private URLs, personal data, or location history in source code, public environment variables, logs, fixtures, or screenshots.

## Pre-Implementation Review

- Determine whether the user is requesting implementation, review, planning, or recommendations. Do not modify code when the user only asks for analysis or scrutiny.
- Before implementation, inspect the affected code and evaluate the request for unclear requirements, contradictions, unsafe assumptions, security concerns, data risks, API contract changes, platform limitations, and unnecessary complexity.
- Identify which applications and contracts are affected before editing.
- When meaningful ambiguity or risk exists, stop before implementation, explain the concern, recommend the safest approach, and ask concise targeted questions.
- Do not proceed with the ambiguous or risky portion until the user resolves it.
- When the request is clear and low-risk, proceed without requiring additional approval or asking unnecessary questions.
- Present a concise implementation plan before substantial, architectural, destructive, or multi-application changes.
- Suggest a better approach when it materially improves safety, maintainability, framework alignment, or future scalability.
- Interpret cleanup as removing issues introduced by the current change. Do not delete unrelated files, reset existing work, or perform destructive cleanup without explicit approval.
- After implementation, run the relevant lint, type-check, formatting, test, build, and smoke checks defined in this guide.
- If a required check cannot run, state why, report what was checked, and describe the remaining risk.

## Structure And Reuse

- Follow the existing framework-specific structure rather than introducing a second competing pattern.
- Group growing form and validation directories by domain, such as `auth`, `booking`, `vehicle`, `profile`, and `admin`.
- Search for an existing component, hook, helper, service, schema, or type before adding one.
- Reuse existing code when its behavior and API fit the requirement.
- Extract a shared abstraction when a meaningful pattern is repeated or is clearly shared across multiple screens. Do not create speculative wrappers for one-off markup.
- Prefer composition over large components with many mode flags.
- Keep page-specific components close to their page or feature. Promote them to shared locations only when they become genuinely reusable.
- Use clear domain names. Avoid vague buckets such as `misc`, `helpers2`, or `common-new`.
- Keep files focused, but do not split straightforward logic into unnecessary layers.

## Laravel Backend

- Keep controllers thin: authorize, accept validated input, call domain logic, and return a Resource or the established API response envelope.
- Put request validation and input normalization in domain-grouped Form Requests under `app/Http/Requests` and extend the existing base request where applicable.
- Put reusable business workflows in `app/Services`; do not hide substantial business logic in controllers, routes, or Resources.
- Use API Resources for externally returned models and collections. Do not expose database models or internal columns accidentally.
- Use policies and the existing permission system for authorization. Frontend route guards are user experience controls, not security boundaries.
- Preserve the existing authentication separation: mobile API routes use token authentication, while web admin routes use stateful cookie and CSRF authentication.
- Use transactions for multi-record operations that must succeed or fail together.
- Make migrations safe and reversible when practical. Do not delete or rewrite persisted data without explicit approval and a migration strategy.
- Avoid N+1 queries, unbounded collections, and loading columns or relationships that the response does not need.
- Use configuration and environment files for integration settings. Never call `env()` outside configuration files.
- Add or update Pest tests for changed backend behavior, validation, authorization, resources, and important failure paths.

## Contract-Aligned Validation

Laravel Form Requests are the authoritative source of truth for accepted request data. Zod provides immediate client feedback but never replaces server validation.

- Every data-submitting form in the Next.js and React Native applications must use a Zod schema from that application's validation directory.
- Web form components belong under `web-frontend/src/forms/<domain>/`, and their schemas belong under `web-frontend/src/validations/<domain>/`.
- Mobile form components belong under `mobile-frontend/forms/<domain>/`, and their schemas belong under `mobile-frontend/validation/<domain>/`.
- Existing files that do not yet follow these paths are technical debt. Migrate them only in a dedicated refactor or when the migration is directly required by the task.
- Zod schemas must mirror every client-verifiable Laravel rule, including field types, required/optional/nullability behavior, lengths, ranges, formats, enums, file limits, date rules, and cross-field conditions.
- Database- and authorization-dependent Laravel rules such as `unique`, `exists`, permissions, current vehicle availability, and other server state must remain authoritative on the backend. The frontend may provide hints but must still handle rejection from Laravel.
- Do not make a Zod schema reject a payload that the corresponding Laravel Form Request accepts unless the extra client restriction is an intentional user-experience requirement and is documented.
- Keep field naming and payload transformations explicit. UI state may use camelCase, but API request mapping to Laravel's expected snake_case belongs at the service or DTO boundary, not scattered through components.
- Infer frontend form types from Zod where practical instead of manually maintaining a second form type.
- Display Laravel `422` validation errors on the corresponding fields, including errors that could only be determined by the server. Preserve a form-level fallback for unmapped errors.
- When a Laravel Form Request changes, update all affected Zod schemas, forms, request types, service mappings, fixtures, and tests in the same change.
- When a Zod-backed form proposes a new field or rule, update and test the Laravel Form Request first or in the same change.
- Do not migrate the web application between Zod compatibility APIs as an unrelated change. Follow the local convention until a deliberate repository-wide migration is approved.

## Next.js Web Frontend

- Follow the App Router architecture under `web-frontend/src/app`.
- Prefer Server Components for static or server-safe rendering, and add `"use client"` only where browser state, effects, event handlers, or client-only libraries require it.
- Do not move authenticated fetching to the server without accounting for Laravel cookie and CSRF forwarding. Preserve the existing browser-based authentication flow unless an architectural change is requested.
- Use the existing centralized HTTP client and domain services. Keep API response and request mapping outside visual components.
- Use shadcn/ui primitives as the default web component foundation. Custom JamJade components may compose shadcn primitives, but do not add a competing UI component library.
- Do not force shadcn into concerns it does not cover. Native HTML semantics, Next.js APIs, and purpose-built application components remain appropriate.
- Keep shadcn primitives in `src/components/ui`, broadly reusable application components in the established shared/common locations, and feature-specific UI with its feature.
- Build every page responsively from small screens upward. Avoid fixed page widths, fixed sidebars without a mobile alternative, overflowing tables, and controls that depend on hover alone.
- Preserve semantic HTML, keyboard operation, visible focus, labels, useful alternative text, and sufficient contrast.
- Every form must use the established form controls, Zod validation, and React Hook Form unless a documented technical constraint requires another approach.
- Represent loading, empty, error, success, and permission-denied states intentionally.
- Use optimized framework features for links, images, fonts, metadata, and routing when applicable.

## Expo And React Native Mobile Frontend

- Use Expo Router and the existing route-group conventions. Route files should remain small when a reusable screen module owns substantial presentation or behavior.
- Consult the exact Expo SDK documentation required by `mobile-frontend/AGENTS.md` before changing Expo configuration or native-facing APIs.
- Support Android only. iOS and mobile-browser support were retired on 2026-10-24; do not reintroduce their configuration, runtime branches or dependencies. The separate Next.js website remains supported.
- Use `react-native-safe-area-context` insets or safe-area components for status bars, display cutouts, and Android system navigation.
- Do not use fixed top or bottom padding as a substitute for safe-area insets. Apply insets at the screen or navigation boundary and avoid double-padding nested content.
- Keep Android edge-to-edge behavior in mind when building full-screen layouts, modals, sheets, keyboards, and bottom actions.
- Use responsive measurements, flexible layout, sensible maximum widths, and scrolling where needed. Do not assume one phone size; consider small phones, large phones, and supported tablet layouts.
- Use NativeWind consistently for static utility styling where it is already appropriate. Use `StyleSheet`, animated styles, or calculated styles for dynamic, platform-specific, or performance-sensitive values rather than forcing everything into class strings.
- Use shared controls and screen frames before duplicating fields, buttons, cards, headers, loading states, or safe-area logic.
- Maintain accessible labels, hints, roles, touch targets, text scaling, contrast, and non-color status indicators.
- Handle keyboard avoidance, loading, empty, error, offline, retry, and interrupted-flow states where relevant.
- Request device permissions only when needed, explain why they are needed, and handle denied, restricted, and permanently denied states.
- Expo Go is the current development entry point, not a permanent guarantee for all future native capabilities. Do not assume background sensors, geofencing, or persistent tasks will work in Expo Go.

## Design System And Color

The recurring JamJade palette is the current baseline:

- Primary action: `#346EF6`
- Primary text/ink: `#17315F`
- Application background: `#F8FAFF`
- Soft border: `#DDE8FF`
- Surface: `#FFFFFF`

- Use semantic tokens such as `primary`, `background`, `surface`, `foreground`, `muted`, `border`, `success`, `warning`, and `destructive`; do not spread raw color literals through components.
- Web tokens belong in the Tailwind/shadcn CSS variable theme. Mobile tokens belong in the central theme constants and NativeWind theme configuration.
- Keep the semantic meaning and values aligned across the two frontends, while allowing platform-appropriate implementation details.
- Reuse the closest existing token when building new UI. Add a token only when the color has a stable semantic purpose.
- Check contrast and interaction states before selecting a color. Do not communicate status through color alone.
- Dark-mode scaffolding exists but full dark-mode behavior is not currently guaranteed. Do not claim dark-mode support or add isolated dark-mode behavior without a deliberate cross-screen implementation.

## Interface And User-Facing Copy

These rules apply to all future features and scoped changes in the website, mobile app, and Laravel-generated emails, notifications, messages, and PDFs. Preserve the current JamJade identity: inspect and reuse the nearest established layout, typography, component shapes, card treatments, icons, and interaction patterns. Minimal means focused content and deliberate placement within that identity. This is not authorization to replace the design with a generic minimal theme or flatten established components. The requested changes are solid branding in place of gradients and concise, relevant copy without unnecessary explanations. Existing screens and branding assets have not all been migrated; improve shared sources within the affected scope without expanding unrelated work into a system-wide redesign.

- Preserve JamJade's identity, existing typography, and semantic palette. Use solid `primary` (`#346EF6`) for blue branding and primary actions. Do not introduce or copy gradient logos, text, buttons, headers, decorative backgrounds, or chart fills. Use flat fills and solid translucent overlays when contrast requires them. Branding changes must preserve the logo's silhouette and proportions and use the existing asset-sync workflow.
- Give each page or screen one clear title. Each full web management module also has one short description beneath its heading explaining what the module offers or does. Use one direct sentence about its main purpose, without reminders, implementation details, slogans, or long explanations. Other screen and section descriptions remain optional and should add useful context.
- Preserve existing informational headings and descriptions on public landing/welcome, login/sign-in, and registration screens in both frontends. The concise-copy cleanup targets management and signed-in operational screens; do not remove or rewrite public information unless explicitly requested. Solid branding and the timezone display rule still apply across public and authenticated screens.
- Default to the title, relevant data, labeled controls, and actions. Do not add a reminder, explanatory paragraph, info banner, tooltip, or extra label merely because a feature was added. Include additional text only when the user needs it to complete the current task correctly; use the shortest wording that preserves its meaning and show it where and when it applies.
- Treat obvious local context and self-explanatory controls as understood. Do not add explanatory copy that only restates what the user can already see or reasonably knows from the task.
- Display dates and times in `Asia/Manila` without visible timezone labels or reminders such as `Philippine time`, `Asia/Manila`, `PHT`, or `UTC+8` in screens, field labels, messages, emails, or PDFs. For example, show `Oct 15, 2026, 2:30 PM`, without a timezone suffix. Keep timezone conversion, server-side date rules, timestamp offsets, API contracts, storage semantics, and technical documentation explicit and correct internally; this is a presentation rule, not a change to time handling.
- Use short, concrete domain labels and action verbs, such as `Bookings`, `Vehicles`, `Add vehicle`, and `Save changes`. Keep established terminology consistent. Avoid promotional slogans, generic introductions, repeated summaries, and claims such as seamless, effortless, or smart in operational interfaces.
- Keep implementation explanations out of user-facing content unless they help the user make a decision or recover from a problem. Describe the user's outcome or required action rather than backend storage, server checks, authenticated accounts, or internal workflow mechanics.
- Place guidance beside its subject: field requirements and validation below the field, status beside the relevant record, and action consequences near the action or in its confirmation. Avoid permanent page-wide explanation panels for local concerns.
- Preserve information needed for informed consent, payment consequences, document requirements, permissions, safety, validation, and destructive actions. Simplify its wording and placement without changing its meaning or hiding essential information behind tooltips.
- Organize layouts around the task: title and page actions, relevant search and filters, then the primary records or form. Keep equivalent actions and metadata in consistent positions and adapt the arrangement to each platform.
- Reuse established cards, borders, icons, badges, and shadows that form JamJade's visual identity. Do not strip them out simply to make a screen minimal. Avoid adding extra decorative containers, icon tiles, glows, repeated headings, or duplicate status indicators beyond the established pattern without a concrete task need.
- Reduce wasted space by removing redundant content, containers, and accumulated padding before shrinking typography or controls. Reuse established spacing and control tokens; preserve readable text, visible focus, touch targets, text scaling, keyboard access, and mobile safe areas.
- Match every capability claim to the implementation. Label mock data as demo data; do not describe previews, planned AI classification, or unconnected feeds as live, real-time, or operational. Review backend-generated copy alongside frontend copy when it appears in the same user flow.
- Before completing UI or copy work, review every visible label, description, container, and decorative treatment for a concrete purpose. Verify placement and density in the applicable populated, loading, empty, error, and validation states at relevant screen sizes.

## API, Security, And Privacy

- Validate, authorize, and normalize every untrusted request on Laravel even when the frontend already validated it.
- Keep API response shapes consistent with the established envelope and Resource conventions.
- Preserve status-code meaning. Do not convert validation, authorization, authentication, not-found, or conflict errors into generic successful responses.
- Use the existing web CSRF flow and mobile bearer-token flow. Do not store mobile authentication tokens in insecure general-purpose storage.
- Never place secrets in variables prefixed with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`; those values are public application configuration.
- Update the relevant environment example and setup documentation when adding a required environment variable. Do not commit local environment files.
- Minimize collection and exposure of personal information. Logs and analytics must not include tokens, identity documents or precise location history.
- Validate uploads by type, size, ownership, and authorization on the server. Treat client-provided MIME types and filenames as untrusted.
- Use safe user-facing error messages while preserving useful structured errors for client handling.

## Testing And Verification

Verification must match the application and behavior changed. Start with focused checks, then run broader checks needed to establish confidence.

### Backend

- Run targeted Pest tests while developing and `composer test` for completed backend changes when feasible.
- Run `vendor/bin/pint --test` for PHP formatting verification.
- Run `npm run build` when backend Vite assets are affected.

### Web Frontend

- Run `npm run lint`.
- Run `npx tsc --noEmit` until a dedicated type-check script is added.
- Run `npm run build` for changes affecting pages, routing, framework configuration, dependencies, or production behavior.
- The web test foundation is not configured yet. Establish Vitest and Testing Library in a dedicated task, following the installed Next.js version's guidance; after that, add and run targeted tests for changed behavior.

### Mobile Frontend

- Run `npm run lint`.
- Run `npx tsc --noEmit` until a dedicated type-check script is added.
- Run Expo dependency/configuration diagnostics when dependencies, Expo configuration, or native-facing packages change.
- The mobile test foundation is not configured yet. Establish the Expo-compatible Jest setup and React Native Testing Library in a dedicated task; after that, add and run targeted tests for changed behavior.
- Smoke-test affected user flows on Android when the change is platform-sensitive. State clearly when a device, simulator, build, permission, or external service prevents a check.

### General Verification

- Add regression coverage for fixed bugs when a stable automated test is possible.
- Test success and important failure paths, especially validation, authorization, network failures, and empty data.
- Do not hide failures by weakening tests, disabling lint rules, adding broad type escapes, or skipping hooks.
- Do not claim a check passed unless it was actually run and completed successfully.
- Documentation-only changes require content review and `git diff --check`; application builds are not required unless documentation changes executable configuration or generated content.

## Future Telematics Readiness

GPS, geofencing, accelerometer/gyroscope readiness, phone mounting, and calibration apply to Self Drive and With Assigned Driver through the owning Customer or assigned Driver operator flow. Setup, calibration capture, and consented latest-location collection are implemented in code; preserve their separate pre-release/released-rental boundaries, and use the roadmap's physical-validation gates before claiming they are operationally verified.

Video recording, sending/uploads, auditing, and dashcam offerings are outside project scope. Do not reintroduce them.

- Isolate collection, permission handling, storage, upload, and presentation behind clear domain interfaces so UI code does not directly manage sensors.
- Expect background execution and some native APIs to require Expo development builds, EAS configuration, native permissions, and platform-specific testing rather than Expo Go.
- Obtain explicit, informed user consent before collecting location or motion data. Provide understandable permission and collection states.
- Design for least-privilege permissions, data minimization, encryption in transit and at rest, retention limits, deletion, access control, and auditability.
- Account for battery usage, sampling rates, accuracy, device limitations, offline buffering, retries, duplicate events, timestamps, and interrupted uploads.
- Never start hidden or unexpected telemetry collection. Review applicable privacy and data-protection requirements before active-trip monitoring is released.
- Keep raw high-volume telemetry out of ordinary request and UI paths. Plan ingestion, aggregation, retention, and access separately before implementation.

### Telematics and RC research boundary

- Read `docs/telematics-master-plan.md` before changing telematics, native motion, RC research, calibration, GPS, fleet alerts, AI, scoring or report flows. It separates implemented behavior, agreed targets, experimental settings and verification. Do not use `docs/archive/` as current coding instructions or restore retired platforms from historical text.
- The central guide's **Collection workflow redesign: Phase 1 contract** and `docs/contracts/rc-collection-v1/` define the next research metadata/protocol design. The schema/specimen remain design-time artifacts; the central guide’s Phase 2 runtime section and Laravel Form Requests own the active pilot DTOs. Implement each affected Laravel/native/client contract together. Preserve original sensor protocol 2 and historical annotation v1 semantics; do not infer new research-session identity from native runtime session IDs or promote a stationary check into accepted alignment. The remount workflow tracks a new mount version within a research session; automatic realignment and numerical check tolerances remain unvalidated.
- Telematics applies to Self Drive and With Assigned Driver. The owning Customer operates Self Drive; the current assigned Driver operates With Assigned Driver. A booking has at most one post-release trip; pauses/resumes stay in that trip.
- Pre-release readiness belongs to setup sessions and retryable steps, never booking assignments. Laravel owns eligibility and outcomes. Staff starts handover and the existing authorized Start Rental action remains the only release action. Preserve server-time, operator, document, payment and inspection requirements; reassignment requires fresh setup by the new Driver.
- Monitoring zones are frozen at release; configuration and containment never gate setup/release. Read `docs/geofence-monitoring.md` for geometry, snapshots and crossing contracts.
- Current calibration is bounded foreground capture with summary-only evidence. Current released monitoring is consented latest GPS, including explicit background mode. The separate, explicitly consented RC rental motion integration now reuses the native feature pipeline and private forest after release; see the central guide for its pending physical acceptance and remount limits. Setup/calibration must not start rental GPS or create trips.
- Current RC Collect uses native v2 recording, encrypted originals/recovery, explicit resumable chunk upload and server verification. The owner-bound Admin inspector reads bounded original v2 windows, retains legacy v1 routes, and supports experimental saved server synchronization/filtering/fixed-frame runs with run-specific references and explicit unchanged-mount forward-reference reuse for separate maneuver trials. Automatic background transfer, remote v2 deletion UI, reusable accepted calibration, full-recording processing/dataset export, ML events and behavior score remain targets; broader physical validation remains pending. Do not treat older planning exclusions as a reason to block this agreed direction.
- Keep original research streams in a dedicated versioned file/ingestion boundary, not setup evidence, ordinary event metadata, raw-sample database tables, logs or public assets. Location-history tables are distinct from latest-state caches and significant events. Do not silently mix Expo v1 measurements with direct Android sensor conventions.
- Preserve existing booking/authentication behavior and historical data. Extend every affected Form Request, Resource, frontend schema/service/type, native adapter and test when contracts change. RC validation does not establish real-car accuracy; observer annotations are not live direction inputs.

## Vehicle Condition Snapshots

Before changing vehicle inspections, current condition, or future outgoing/incoming booking workflows, read `docs/vehicle-condition-architecture.md`. Finalized inspection snapshots are immutable internal records, and the public/mobile vehicle resource must not expose their checklist, marker, comment, history, or signature data.

## Existing Technical Debt

The current repository does not yet satisfy every rule above. Known gaps include non-centralized color literals, inconsistent frontend validation placement, different Zod API conventions, incomplete dark-mode support, and missing frontend test foundations.

- Treat these as explicit technical debt, not permission to expand an unrelated task.
- When a touched area can be brought into compliance safely within scope, do so and verify it.
- When compliance requires a migration or broad refactor, describe the gap and propose a separate task rather than mixing it into the current change.
