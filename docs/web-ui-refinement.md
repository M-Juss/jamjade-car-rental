# Web interface refinement

Updated: 2026-11-06. Scope: the Next.js website only, including Admin and Staff
management, login, detail views, shared controls and dialogs. Public landing-page
source, content and layout are excluded at the user’s request for the mock defense.
The approved Personnel preview establishes the direction for this refinement.

## Shared visual rules

- Keep Poppins, the solid JamJade logo, primary blue, dark blue ink and pale page
  background. Public informational headings and rental instructions remain.
- Use readable secondary text, sentence-case labels and headers, and consistent
  text sizes. Small supporting text starts at 12 px; records and controls use
  14 px on desktop, with 16 px editable controls on small screens.
- Group records in bordered surfaces. Keep operational counts in `SummaryList`;
  retain `KpiCard` for dashboard and report metrics. Metric icons are bare, quiet
  symbols rather than colored decorative tiles.
- Keep search and filters with their records where they share one surface.
  Tables wrap variable content, retain pagination and become stacked records on
  phones. Personnel groups name/ID and email/phone within each record.
- Use dividers and spacing for related detail fields instead of nested cards for
  every value. Preserve boundaries for distinct tasks, documents, maps and forms.
- Separate metadata with aligned fields or main/supporting text, rather than
  concatenating values with middle dots. Reuse `MetadataList` for compact labeled
  groups; keep dates, durations, statuses and their explanations distinct. Select
  options can provide a separate description while preserving their original values.
  Use normal sentences for instructions and retain meaningful scientific notation.
- Use `shadow-dialog` for floating dialogs, sheets, menus and chart tooltips.
  Ordinary cards and actions do not have decorative shadows or gradient fills.
- Preserve keyboard focus, visible labels, field errors, loading/empty/error
  feedback and access to all actions. Controls retain appropriate touch sizes.

## Sources of truth

| Concern | Source |
| --- | --- |
| Palette, contrast, calendar and responsive tables | `web-frontend/src/app/globals.css` |
| Cards, actions, inputs, overlays and menus | `web-frontend/src/components/ui/` |
| Operational totals and metric cards | `web-frontend/src/components/common/data-display/` |
| Compact labeled record metadata | `web-frontend/src/components/common/data-display/MetadataList.tsx` |
| Labeled fields and dialog composition | `web-frontend/src/components/common/forms/` |
| Table surfaces, row menus and pagination | `web-frontend/src/components/common/tables/` |
| Page headings and navigation | `web-frontend/src/modules/management/shell/` |

Legitimate page differences remain: Dashboard centers on the rental calendar and
attention queue; Fleet Monitoring uses a map and selectable rental list; research
retains its current inspection tabs, signal selection and experimental processing
controls. These pages are not forced into a generic table layout.

## Landing-page boundary

The original public landing page, fleet carousel, booking steps, driving-insight
copy, testimonials and download dialog are retained for the mock-defense demo.
Do not add demo, unverified, coming-soon or in-development labels to those sections
as part of this refactor. Public content will be revisited after the remaining
work is complete. Login remains in scope for the shared control refinement.

## Functional boundary

This change does not modify Laravel, database records, authentication/session rules,
permissions, service requests, validation schemas, payload mappings, booking action
sequencing, monitoring geometry, inspection snapshots or research calculations.
Existing account and workflow forms, their server-error mapping and outcome toasts
remain authoritative. Date presentation uses the established Asia/Manila convention.

## Verification

Required code checks are web lint, TypeScript, the production build and
`git diff --check`. Review changed mutation callbacks and confirm this refactor does
not change services, schemas or backend behavior. A task explicitly covering both
frontends must also follow the mobile guide. Preserve unrelated mobile/native work
in the shared checkout.

Browser verification must cover desktop and phone widths; long names, labels and
emails; loading, empty and error states; filter/reset/pagination; row menus; and
forms with validation errors and visible footer actions. Code checks alone do not
establish that every responsive screen has been visually verified.

At this pass, local browser access was disabled. The computer-use tool also blocked
access to Work itself, preventing the agent from enabling that setting. Browser
smoke verification remains a separate pending check; user permission alone did not
change the tool setting.

### Code checks for this pass

- Web lint and TypeScript checks passed using the installed Node 24 runtime.
- The production build passed for all public, Admin and Staff route entries;
  `git diff --check` passed. The build used network access for the existing Poppins
  font download and did not change dependencies.
- A TypeScript AST comparison found all 289 existing submit/change/action callbacks
  preserved across 86 modified TSX files. The existing Personnel clear handler is
  reused by its empty state; its reset operations are unchanged.
- Marketing sources, backend files, service modules, validation schemas, booking
  action sequencing and dependency files have no changes from this refactor.
- Secondary text on white is 5.41:1; subtle text is 4.76:1. The input border is
  3.16:1 against the field surface. Existing primary white-on-blue (4.46:1) and
  destructive text on its pale surface (4.42:1) remain below a 4.5:1 normal-text
  target; the specified brand/status values were retained. This is not a claim of
  complete contrast or accessibility conformance.
- Browser smoke checks are pending for the reason above.

### Metadata presentation follow-up, 2026-11-06

The approved metadata refactor covers both frontends. Shared `MetadataList`
components group labeled values, dates and durations use separate positions,
status notes use supporting text, and selects support distinct option descriptions.
Frontend-owned UI text no longer uses middle dots to concatenate metadata.
Stored values, scientific notation, the three mobile Profile cards and the public
web landing-page sources are preserved.

Both frontend lint/type checks, all 261 existing mobile Node checks, the Android
export and the web production build passed. The web build needed network access
for the existing Poppins font. Callback fingerprints across 361 UI files and 591
protected application files matched the starting snapshot. Browser access remains
disabled; browser and Android visual verification are still pending.
