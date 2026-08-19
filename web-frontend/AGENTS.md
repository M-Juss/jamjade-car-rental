# JamJade Web Frontend Agent Guide

## Scope And Precedence

This file applies to all work inside `web-frontend/` and adds to the repository-root `AGENTS.md`. Follow both files. When instructions conflict, this file takes precedence for the web frontend.

The existing JamJade web application is the primary design and interaction reference. Treat its established components, layouts, styles, and behavior as product requirements, not as optional inspiration.

## Core Consistency Contract

- Before creating or changing any user interface, inspect the closest existing implementation in the application.
- When the requested design or behavior already exists, reuse the same component or imitate the complete established pattern. Do not invent a parallel design.
- "Same pattern" includes structure, component choice, dimensions, spacing, typography, colors, borders, radius, shadows, icons, states, responsive behavior, animation, wording style, and interaction behavior—not only general appearance.
- Extend an existing renderer or data-driven collection when adding another item of the same kind. Do not give a newly added item bespoke markup or styling.
- Prefer improving a shared source once over copying its class list into multiple files.
- A feature request does not authorize a redesign. Preserve the current visual language unless the user explicitly asks to change it.
- New code must look and behave as though it has always belonged to the same screen and system.

## Mandatory Pattern-Discovery Workflow

Before implementation, the agent must:

1. Identify every UI and behavior category affected, such as page header, KPI card, content card, form field, table, status badge, dialog, empty state, or pagination.
2. Search the repository for existing components and examples in each category. Use file and text search; do not rely on memory or assumptions.
3. Inspect the closest feature example and the underlying shared primitive before editing.
4. Choose a precedent using the hierarchy below and note it in the implementation plan or working update.
5. Reuse the precedent directly, extract a shared component when appropriate, or reproduce its full contract when it is intentionally feature-local.
6. Compare the completed result with the chosen precedent at relevant responsive sizes and in all affected states.

Do not start by writing new JSX and styling from scratch when a comparable component exists.

## Precedent Hierarchy

When several examples exist, use this order:

1. The exact shared component already used for the same purpose.
2. The same pattern in the same feature or screen.
3. The same pattern in the closest current management screen.
4. The primitive in `src/components/ui/` plus application composition in `src/components/common/` or the relevant `src/modules/` domain.
5. Semantic theme tokens and global typography in `src/app/globals.css` and `src/app/layout.tsx`.
6. A new pattern, only when no suitable precedent exists.

Prefer a current, working, accessible implementation over an older inconsistent instance. If equally relevant examples conflict, inspect repeated usage and select the dominant pattern. Do not combine unrelated parts into a new hybrid. If the choice would materially change the user experience, explain the conflict and ask the user before proceeding.

## Current Sources Of Truth

Start discovery in these locations, then inspect the closest feature-specific implementation:

- Theme, semantic colors, radii, and global typography: `src/app/globals.css` and `src/app/layout.tsx`
- Base UI primitives: `src/components/ui/`
- Labeled form controls: `src/components/common/forms/InputWithLabel.tsx`, `SelectWithLabel.tsx`, and `TextAreaWithLabel.tsx`
- Management filters and searches: `src/components/common/forms/FilterSelect.tsx` and `SearchInput.tsx`
- Table row actions: `src/components/common/TableActionMenu.tsx`
- Dashboard KPI cards and dashboard content cards: `src/modules/management/dashboard/DashboardModule.tsx`
- Analytics KPI cards, chart cards, and reporting tables: `src/modules/management/reports/ReportsModule.tsx`
- Management page headers, filters, summary cards, tables, and states: `src/modules/management/bookings/BookingsModule.tsx`, `src/modules/management/admin-access/AdminAccessModule.tsx`, and `src/modules/management/vehicles/VehiclesModule.tsx`
- Canonical form-dialog shell and actions: `src/components/common/FormDialogLayout.tsx`
- Complex form-body composition: `src/forms/admin/AdminForm.tsx` and `src/forms/vehicle/VehicleForm.tsx`
- Navigation shell and role layouts: `src/modules/management/shell/`, `src/app/admin/layout.tsx`, and `src/app/owner/layout.tsx`

This list is a discovery map, not permission to copy blindly. The closest equivalent in the touched feature remains the preferred precedent.

## Living Pattern Memory

- This guide preserves the rule for finding precedent; the current code preserves the latest design details. Reinspect both on every task because the system will evolve.
- Treat shared primitives, shared application components, theme tokens, and repeated current usage as the application's durable design memory.
- When a change intentionally establishes or replaces a canonical pattern, update the shared source first and update this discovery map in the same change if its guidance becomes stale.
- Do not preserve a superseded pattern by copying it into new code. Confirm which implementation is current through nearby usage and version history when necessary.
- Do not rely on screenshots, generated output, or recollection alone when the implementation can be inspected directly.

## File And Folder Ownership

Before creating or moving a file, identify its responsibility, search for the existing domain folder and comparable files, and place it in the narrowest established location that owns that responsibility.

- `src/app/` owns App Router route entries, layouts, loading and error boundaries, metadata, and lightweight route composition. Do not put substantial feature UI, form logic, validation schemas, API calls, or business rules in route files.
- `src/modules/<area>/<domain>/` owns feature-specific screens, orchestration, components, hooks, local data, and utilities that are too substantial for a route file but are not reusable across unrelated features.
- `src/forms/<domain>/` owns every data-submitting form, including a form presented inside a dialog, sheet, card, wizard, or feature screen. The presentation container does not change the form's ownership.
- `src/validations/<domain>/` owns Zod schemas, schema factories, shared form-validation helpers, and Zod-inferred form types.
- `src/services/<domain>/` owns API requests, domain request and response types, response mapping, and explicit camelCase-to-snake_case payload transformation.
- `src/components/ui/` owns shadcn primitives. Do not place feature-specific components or business behavior there.
- `src/components/common/` owns broadly reusable composed controls and interface patterns, such as labeled fields and table actions.
- `src/components/common/` owns genuinely cross-feature composed interface patterns. A component used by only one domain belongs in that domain's `src/modules/` folder, even if it might be reused later.
- `src/lib/` owns domain-independent utilities and application infrastructure. Do not hide feature business logic or API mappings there.

The agent must not:

- Create a new folder when an appropriate existing domain folder is available.
- Create duplicate organizational trees or vague buckets such as `misc`, `helpers2`, `new-components`, or `common-new`.
- Put a Zod schema beside a component merely for convenience when `src/validations/<domain>/` exists.
- Put an API request directly in a component, hook, form, or route file when `src/services/<domain>/` should own it.
- Create alternate-version filenames such as `NewForm`, `Form2`, `UpdatedTable`, or `BetterCard`.

Existing misplaced files are technical debt, not precedent for new placement. Move a touched file only when the move is directly required by the task, is safe for all consumers, and can be fully verified. Otherwise, keep the requested change scoped and report the organizational debt separately.

## Component Rules

### KPI And Summary Cards

- A KPI added to an existing KPI group must be another entry in that group's data model and must use the same map/render path as its siblings.
- Match the existing group's `Card` and `CardContent`, grid breakpoints, gap, radius, border, shadow, padding, icon container, icon size and stroke, value typography, label typography, ordering, animation, and loading behavior.
- Do not make one KPI visually unique unless its semantic state requires an already established status treatment or the user explicitly requests emphasis.
- For dashboard KPI work, `src/modules/management/dashboard/DashboardModule.tsx` is the direct precedent. Do not introduce a separately designed KPI component beside it.
- If KPI markup is needed in multiple features and a truly identical contract is emerging, extract one shared component and migrate the affected matching instances in the same scoped change. Do not create an abstraction that cannot preserve legitimate feature differences.

### Cards And Containers

- Use the shadcn `Card` family from `src/components/ui/card.tsx`; do not replace it with a plain `div` for an equivalent card.
- Match the nearest card's surface token, radius, border, shadow, padding, header spacing, and overflow behavior.
- Use `bg-surface`, `bg-card`, or the existing semantic class used by the precedent. Do not add another near-white literal.
- Preserve the established hierarchy between page background, primary content cards, nested sections, and interactive rows.

### Forms And Input Fields

- Use the existing common labeled controls when their API fits. Do not rebuild a label, icon, input, required indicator, and error message locally.
- Use `FilterSelect` for unlabeled toolbar filters and `SearchInput` for search controls. Module and form code must not import the raw select primitive directly; ESLint enforces this boundary.
- Use the `src/components/ui/` input, textarea, select, checkbox, and button primitives beneath application-level form controls.
- Match field height, radius, padding, label case and tracking, placeholder style, focus ring, disabled state, error state, help text, and vertical spacing from the closest form.
- Every data-submitting form must use React Hook Form with a Zod resolver and a schema from `src/validations/<domain>/`. Hand-written component-local validation is not an acceptable substitute.
- Preserve Laravel `422` field-error handling and the Laravel–Zod contract requirements below.
- New field types should follow the composition of the nearest existing field. Add a reusable variant to the shared control only when the variation has a stable, repeated purpose.

### Dialogs And Confirmations

- `src/components/common/FormDialogLayout.tsx` is the canonical composition for data-entry and action form dialogs. Use `FormDialogContent`, `FormDialogHeader`, and `FormDialogFooter` instead of rebuilding their structure and class lists.
- A form-dialog header contains only the domain icon, concise title, and close action. Do not add a subtitle, description, instructions, metadata, or status copy beneath the title.
- Keep the header and footer fixed within the modal and make only the body scrollable. Dialog content must stay within the viewport at supported responsive sizes; controls and actions must never be clipped behind the viewport edge.
- Form-dialog footers use two equal-width actions when both are present: Cancel or Back on the left and the primary action on the right. Use one full-width action for read-only dialogs. Do not right-align compact action buttons.
- Do not add a footer note such as "Fields marked * are required." Required state belongs on the relevant field label, and validation guidance belongs with the affected field and in the established toast feedback.
- Width may vary only for genuine content needs: compact for short actions, default for ordinary forms, and wide for complex or multi-section forms. Header, footer, spacing, radius, border, shadow, button height, and responsive behavior remain identical.
- Use `AlertDialog` for confirmations, especially destructive or irreversible actions. Confirmation descriptions are allowed and should remain when they explain consequences or protect the user from an unsafe action; their action footer must still follow the shared equal-width layout.

### Tables And Data Lists

- Use the table primitives from `src/components/ui/table.tsx` and the closest management table as the composition reference.
- Match container card treatment, header height and typography, row density, cell padding, hover behavior, status badges, action placement, horizontal overflow, pagination, and empty/loading/error states.
- Use `TableActionMenu` for equivalent row actions. Do not introduce a different action-menu style for a new table.
- Preserve the responsive strategy of the closest table. A table must remain usable on small screens rather than relying on desktop width.

### Buttons And Actions

- Use `Button` and its existing variants and sizes. Prefer an existing variant over class overrides.
- Match action hierarchy: primary, secondary, destructive, ghost, and icon-only actions must keep the same semantic meaning used elsewhere.
- Match loading, disabled, confirmation, and success/error feedback behavior—not only the idle button style.

### Icons

- Use `lucide-react`, which is the established application icon system. Do not introduce another icon library for a symbol Lucide provides.
- Reuse the same icon for the same action or domain concept when one is already established.
- Match the precedent's icon size, stroke width, color, container size, alignment, and accessible label treatment.
- Do not use emoji, text glyphs, or custom SVGs as substitutes for ordinary interface icons. Custom artwork is appropriate only when the domain requires it and no system icon is equivalent.

### Typography And Copy

- Poppins from `src/app/layout.tsx` is the application font. Do not add another font or set component-local font families.
- Match the closest page's established type role for page titles, descriptions, section titles, labels, body text, metadata, and values.
- Do not create a new arbitrary font size, weight, line height, capitalization, or tracking treatment when an equivalent text role exists nearby.
- Follow the application's concise administrative copy style and terminology. Reuse existing labels for the same concepts.

### Color, Borders, Radius, And Shadows

- Use semantic theme classes backed by `src/app/globals.css`, including `background`, `surface`, `foreground`, `muted`, `border`, `primary`, `success`, `warning`, and `destructive` roles.
- Reuse the closest semantic status treatment for statuses with the same meaning.
- Do not add raw color values or one-off shadows when an existing token or exact established pattern fits.
- Do not create slightly different versions of an existing radius, border, or shadow. Exact consistency is preferred over visual approximation.
- If a repeated raw value in existing code must be reused, first consider whether the scoped change should replace the affected repeated instances with a shared token or component.

### Layout, Responsiveness, And Motion

- Match the nearest page shell's content width, padding, section spacing, grid breakpoints, and stacking behavior.
- Build mobile-first and verify small, medium, and large layouts relevant to the changed component.
- Reuse existing motion timing and movement for equivalent content. Do not add animation to a component type that is otherwise static.
- Preserve visible focus, keyboard operation, touch target size, labels, contrast, reduced-motion expectations, and semantic HTML.

### Functional Behavior And States

- Existing behavior is precedent alongside visual design. Match data flow, validation timing, search/filter behavior, confirmation flows, pagination, notifications, and navigation patterns where the use case is equivalent.
- Every data-backed component must deliberately support the same applicable loading, empty, error, success, permission-denied, and disabled states as its closest equivalent.
- Reuse services, hooks, helpers, schemas, and types before introducing new ones. Presentation components must not bypass the established service layer.

## Laravel–Zod Validation Contract

Laravel Form Requests are the authoritative acceptance, normalization, authorization, and validation contract. Zod must provide the same client-verifiable validation semantics so the browser and server work as one contract rather than two independent rule sets.

Before implementing or changing a form, the agent must inspect the exact Laravel Form Request used by every affected create, update, or action endpoint. The review must cover:

- Required, optional, `sometimes`, present, and nullable behavior.
- String, integer, numeric, boolean, array, object, and file types.
- Minimums, maximums, lengths, formats, regular expressions, and enums.
- Date formats, allowed ranges, comparisons, and current-time restrictions.
- Conditional rules, cross-field rules, nested fields, arrays, and array items.
- File count, MIME or image requirements, and size limits.
- Differences between create, update, partial-update, and action-specific requests.
- Input normalization and defaults in `prepareForValidation()`.
- Client field names, Laravel field names, and service-layer payload transformations.

For every client-verifiable Laravel rule, the corresponding Zod schema must enforce the same accepted values and boundaries. Matching intent loosely is insufficient. For example, a Laravel `integer|min:1|max:20` rule requires Zod to enforce integer, minimum, and maximum behavior—not merely that the value can be converted to a positive number.

Database-, authorization-, and server-state-dependent rules such as `unique`, `exists`, permissions, current availability, ownership, and booking conflicts remain server-authoritative. The client may provide guidance but must not pretend to guarantee those rules.

The agent must also:

- Keep schemas and schema factories in `src/validations/<domain>/`, never embedded in visual components.
- Infer form value types from Zod where practical rather than maintaining a second manual form type.
- Use schema composition or separate schemas when Laravel create and update contracts differ. Do not force both operations through a schema that is too strict or too permissive.
- Keep camelCase UI fields and snake_case API fields connected through one explicit mapping in the domain service or DTO boundary.
- Mirror Laravel normalization when it is safe and client-verifiable, while still allowing Laravel to normalize and validate the final request.
- Map every recognized Laravel `422` field key back to its React Hook Form field, including nested fields, and preserve a form-level fallback for unmapped errors.
- Ensure Zod does not reject a payload the Form Request accepts unless the additional client restriction is a deliberate user-experience requirement documented beside the schema or in the task.
- Update the Laravel Form Request first or in the same change when a new client field or validation rule is proposed.
- Review all affected forms, schemas, service mappings, request types, fixtures, and tests whenever either side of the contract changes.

A form contract change is incomplete until validation parity has been checked field by field. The implementation handoff must name the Laravel Form Request and Zod schema reviewed and disclose any intentional server-only or client-only rules.

## Form Submission Feedback

Every final form submission attempt must give the user a clear outcome. Inline field messages and toasts serve different purposes and are both required where applicable.

- Use `appToast` from `src/lib/toast` as the canonical toast interface in new or touched form code. Do not call Sonner directly from those forms.
- A client-validation failure must show the field errors and one specific error toast telling the user what needs attention.
- A successful mutation must show exactly one action-specific success toast after the server confirms success.
- A Laravel `422` response must map recognized errors to their fields and show one understandable error toast summarizing why the form was not submitted.
- A non-validation API failure must show exactly one safe, action-specific error toast that identifies the failed operation and, when useful, tells the user how to recover.
- Generic success text such as "Action completed successfully" is not acceptable when the completed action is known.
- Do not expose raw exceptions, stack details, internal identifiers, credentials, personal data, or unsafe backend messages in a toast.
- The component or workflow that owns the mutation owns its outcome toast. Services must not display toasts, and parent and child components must not both toast the same outcome.
- Disable repeat submission while a request is pending and provide an action-specific pending label such as `Saving...`, `Scheduling...`, or `Updating...`.
- Cancel actions and intermediate wizard navigation are not successful submissions and must not show success toasts. An invalid attempt to continue may show the required validation toast.

Toast copy must be concise, specific, understandable without technical knowledge, and consistent with the application's terminology. Prefer messages such as "Vehicle added successfully," "Check the highlighted admin account fields," or "Maintenance could not be scheduled for the selected dates." Use a generic fallback only when the application genuinely has no safe actionable detail, and still identify the action that failed when possible.

## Reuse, Extraction, And Duplication

- Import and reuse an existing component when its behavior and API fit.
- If the existing component is nearly suitable, prefer a small backward-compatible variant or compositional prop over a duplicate component.
- Add a variant only for a real product distinction; do not accumulate mode flags merely to avoid thoughtful composition.
- When the same substantial UI contract would otherwise be copied to a second location, extract a focused shared component.
- Keep feature-specific components close to their feature until they are genuinely shared.
- Never create files named as alternate versions such as `NewCard`, `Card2`, `BetterTable`, or `UpdatedInput`.

## Deviation Gate

An agent may depart from an existing pattern only when at least one of these is true:

- The user explicitly requests a redesign or intentionally different behavior.
- The existing pattern cannot satisfy accessibility, security, correctness, or framework requirements.
- The new use case has a materially different semantic purpose.
- No relevant precedent exists after repository search.

When deviating, the agent must state the precedent inspected, why it is insufficient, and what new reusable rule or component will be introduced. A deviation should be narrow and should not silently redesign surrounding components.

Do not reproduce a known bug, accessibility failure, insecure behavior, invalid markup, or obsolete API merely for visual consistency. Preserve the intended design while correcting the defect in the smallest complete scope.

## Design-System Changes

- A deliberate redesign of a shared component requires reviewing all of its consumers.
- Update the shared primitive, token, or component first when the new rule is meant to apply system-wide.
- Do not update one instance to a new visual language while leaving equivalent instances behind unless the user explicitly approves a staged migration.
- Broad normalization of existing technical debt must be proposed as a separate task when it exceeds the requested scope.

## Required Verification And Handoff

For UI work, verification is incomplete until the agent has:

- Reviewed the diff for unnecessary new styles, raw colors, duplicated markup, and alternate components.
- Confirmed that every new or moved file follows the ownership rules in this guide.
- For every affected form, compared the Zod schema field by field with the exact Laravel Form Request and checked the service-layer payload mapping.
- Exercised invalid-client, successful, Laravel `422`, and non-validation failure submission paths and confirmed that each produces one appropriate toast without duplication.
- Run the web lint and TypeScript checks required by the root guide, plus a production build when the change affects production behavior.
- Compared the result with the selected precedent at the relevant responsive sizes.
- Checked the applicable loading, empty, error, populated, disabled, hover, focus, and validation states.
- Reported which existing component or screen served as the precedent, which Laravel Form Request and Zod schema were compared, and whether anything intentionally differs.

If visual or browser verification cannot be performed, state that limitation and the remaining risk. Do not claim consistency based only on compilation.
