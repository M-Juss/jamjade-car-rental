# JamJade Car Rental Agent Guide

## Scope

This file defines repository-wide instructions for JamJade Car Rental. A more specific `AGENTS.md` inside an application adds to these rules and takes precedence only for that application when instructions conflict.

The repository contains three independent codebases:

- `backend/`: Laravel API and shared backend for both frontends.
- `web-frontend/`: Next.js website for administrators and staff.
- `mobile-frontend/`: Expo and React Native application for customers and assigned Drivers.

The applications share one repository but are not one package-manager workspace. Run commands from the application directory they belong to, and do not assume dependencies, types, or runtime code are shared between applications.

Read `docs/project-status-and-roadmap.md` for current project decisions, phase status, and the capstone's AI classification goal. Use the domain guides below for detailed contracts and inspect code before assuming a documented feature is operational.

## Product Architecture

- Laravel is the authoritative backend, data-access layer, validation boundary, and authorization boundary.
- Read `docs/user-roles-and-access.md` before changing personnel roles, account lifecycle, or Staff/Driver authorization. Admin/Owner separation is deferred.
- The web frontend uses Laravel's stateful session, cookie, and CSRF authentication flow.
- The mobile frontend uses Laravel Sanctum bearer tokens stored through the existing secure storage abstraction.
- Both frontends communicate with Laravel through the existing API service layers. Do not call backend URLs directly from presentation components when a service module should own the request.
- Treat Laravel Form Requests as request contracts and Laravel API Resources as response contracts.
- A contract change is not complete until every affected backend endpoint, web client, mobile client, type, validation schema, mapping, and test has been reviewed.

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
- Support both Android and iOS. Do not design or verify for only one platform.
- Use `react-native-safe-area-context` insets or safe-area components for status bars, display cutouts, the iOS home indicator, and Android system navigation.
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
- Smoke-test affected user flows on both iOS and Android when the change is platform-sensitive. State clearly when a device, simulator, build, permission, or external service prevents a check.

### General Verification

- Add regression coverage for fixed bugs when a stable automated test is possible.
- Test success and important failure paths, especially validation, authorization, network failures, and empty data.
- Do not hide failures by weakening tests, disabling lint rules, adding broad type escapes, or skipping hooks.
- Do not claim a check passed unless it was actually run and completed successfully.
- Documentation-only changes require content review and `git diff --check`; application builds are not required unless documentation changes executable configuration or generated content.

## Future Telematics Readiness

GPS, geofencing, accelerometer/gyroscope readiness, phone mounting, and calibration remain in the self-drive telematics scope. Active-trip collection and calibration capture require their own implementation phases; do not implement them as part of unrelated cleanup.

Video recording, sending/uploads, auditing, and dashcam offerings are outside project scope. Do not reintroduce them.

- Isolate collection, permission handling, storage, upload, and presentation behind clear domain interfaces so UI code does not directly manage sensors.
- Expect background execution and some native APIs to require Expo development builds, EAS configuration, native permissions, and platform-specific testing rather than Expo Go.
- Obtain explicit, informed user consent before collecting location or motion data. Provide understandable permission and collection states.
- Design for least-privilege permissions, data minimization, encryption in transit and at rest, retention limits, deletion, access control, and auditability.
- Account for battery usage, sampling rates, accuracy, device limitations, offline buffering, retries, duplicate events, timestamps, and interrupted uploads.
- Never start hidden or unexpected telemetry collection. Review applicable privacy and data-protection requirements before active-trip monitoring is released.
- Keep raw high-volume telemetry out of ordinary request and UI paths. Plan ingestion, aggregation, retention, and access separately before implementation.

### Established telematics data boundary

- Telematics applies only to self-drive bookings. One booking has at most one post-release `telematics_trip`; pauses and resumes stay within that trip.
- Pre-release readiness belongs to `telematics_setup_sessions` and retryable `telematics_setup_steps`, never to `booking_assignments`. The existing authorized Start Rental action remains the final release action.
- Reusable circles belong to `geofences`. Copy their values into immutable `booking_geofences` snapshots; never read a historical rental boundary dynamically from an editable template.
- `telematics_location_points` is high-volume route history. `telematics_trips` current-location fields are intentional latest-state cache. `telematics_events` contains significant occurrences only.
- Do not add raw accelerometer or gyroscope sample tables, encode streams in JSON, or introduce driver-behavior/AI classifications without a separately approved design.
- Read `docs/telematics-architecture.md` before changing telematics data, client behavior, or release logic; read `docs/telematics-handover-lifecycle.md` before changing handover endpoints or staff operations; read `docs/telematics-device-location.md` before changing native setup checks, permissions, GPS policy, or geofence evaluation.
- Handover is staff-controlled: only `setup_required -> in_progress` may start it, and the existing authorized Start Rental action is the only `ready_for_release -> released` release path. Phase 3 mobile setup may submit only typed real readiness evidence through its native abstraction; Laravel determines the outcome. It must not simulate data, subscribe to sensors, start active location updates, upload telemetry, create trips, or implement calibration.
- Telematics navigation is not telematics eligibility. Keep the tab server-gated through the authoritative handover eligibility read model; only an owning self-drive booking may be selected, and setup mutations additionally require verified documents, `confirmed`, the server-checked current `Asia/Manila` calendar date of `rental_start_at`, and `in_progress` handover.

## Vehicle Condition Snapshots

Before changing vehicle inspections, current condition, or future outgoing/incoming booking workflows, read `docs/vehicle-condition-architecture.md`. Finalized inspection snapshots are immutable internal records, and the public/mobile vehicle resource must not expose their checklist, marker, comment, history, or signature data.

## Existing Technical Debt

The current repository does not yet satisfy every rule above. Known gaps include non-centralized color literals, inconsistent frontend validation placement, a manually validated web form, different Zod API conventions, incomplete dark-mode support, and missing frontend test foundations.

- Treat these as explicit technical debt, not permission to expand an unrelated task.
- When a touched area can be brought into compliance safely within scope, do so and verify it.
- When compliance requires a migration or broad refactor, describe the gap and propose a separate task rather than mixing it into the current change.
