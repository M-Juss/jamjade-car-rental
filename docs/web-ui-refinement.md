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

## Self-drive verification dialog — 2026-11-11

Self-drive verification dialog follow-up — 2026-11-11: the existing
`FormDialogHeader` now shows the customer's name and reuses its `endContent`
slot for the server-derived review/eligibility badge beside Close. The duplicate
customer-summary card was removed. Both document types use three metadata
columns above their previews at `sm` and wider, stacking on smaller screens;
rejection reasons span the metadata grid. Implemented in
`src/modules/management/verification/VerificationModule.tsx`. Review actions,
document previews and API contracts are unchanged. Visual confirmation is left
for the user's manual review. TypeScript and scoped ESLint checks passed.
The Admin-only Edit verification menu item appears only when at least one
document is approved, in both desktop and mobile web lists. View customer
retains pending-document review actions for Admin and Staff, so customers with
no approved documents can still have their submissions reviewed.

## Uniform web tabs — 2026-11-11

The vehicle-detail section navigation is the approved visual reference for all
website tabs: a full-width white surface with soft border, rounded strip and
rounded pale-blue selected item, blue selected text, muted inactive text and
consistent semibold typography/padding. `components/ui/tab-styles.ts` owns the
shared list and trigger classes. Radix `TabsList`/`TabsTrigger` and vehicle
route links reuse those classes; feature-level size, fill and grid overrides
were removed so they cannot drift independently.

Applied to Maintenance, Driving Analysis, Reports, Fleet detail tabs, booking
details, native recording review and legacy recording review, plus the vehicle
route navigation itself. Route links retain href/aria-current navigation;
Radix tabs retain controlled values, panel associations, keyboard handling,
disabled states and visible focus. Lists distribute available width equally;
long labels scroll horizontally on narrow screens instead of shrinking text
or overflowing the page. Booking's existing short mobile labels remain.
Backend contracts, route destinations, selected-tab values and mobile app UI
are unchanged. No additional library or APK rebuild is required.

Verification: web lint, TypeScript, production build and diff checks passed.
Signed-in browser checks confirmed the Maintenance tabs have equal desktop
widths and the selected item uses the existing muted fill/primary text tokens.
Maintenance selection and Driving Analysis Rentals/Operators switching worked.
At 390 px, Driving Analysis had no page overflow, the six Reports tabs scrolled
inside their 356 px strip, and the booking dialog's four tabs fit its 322 px
strip. ArrowRight selected Rental and opened its matching booking panel.
The temporary viewport override was reset and Maintenance was left open.
Other consumers inherit the same shared source and compiled successfully;
not every module's individual data state was exercised in the browser.

## Calendar-centered dashboard — 2026-11-11

The dashboard keeps the rental calendar as its main surface: approximately three
quarters of the wide desktop content area, with a 660 px base calendar height and
additional height for busy dates. The secondary rail contains the existing booking
attention queue plus fleet status, pending follow-ups and outstanding customer
balances. Today's pickups/remaining returns and the shared maintenance totals sit
below. Smaller layouts stack the surfaces; the calendar scrolls within its own
container without widening the page.

The existing `KpiCard`, `FilterSelect`, `SummaryList`, content-card, dialog and
booking-link patterns are reused. The top metrics are today's pickups, today's
outstanding returns, active rentals and current-month gross receipts. Confirmed
bookings remain as supporting context. Vehicle/status/rental-type filters apply to
the visible calendar; daily operations and receipts retain their own explicit
periods. Calendar event labels include the plate, and the event dialog links to
the existing booking details/workflow. Pending bookings are labeled awaiting
payment because successful payment automatically confirms them. The booking list
accepts a validated initial `status` query parameter for this shortcut.

`DashboardOverviewService` adds an `overview` read model to the established
`GET /admin/dashboard?start=...&end=...` response. It restricts operation rows and
balances to `manage bookings`, document counts to `review documents`, fleet totals
to `manage vehicles`, and maintenance totals to `manage maintenance`; unavailable
modules return null. Pending documents count the required customer documents,
not files or historical passports. Customer additional charges already contribute
to `remaining_balance`, so they are not added again. Cancelled/rejected/completed
bookings and pending payment attempts are excluded from collectible balances.
Fleet totals describe saved operational status, not a guarantee of availability
for a requested future interval. Maintenance reuses the existing summary contract.

The calendar date range, current-month receipt range, today queries and visible
dates use Asia/Manila. Browser calendar fields are projected into Manila wall-clock
time for the existing date-fns localizer. Scheduled confirmed/ongoing returns are
excluded once physical receipt is recorded. Operation results are chronological,
capped at 20, with the full total supplied separately. Refresh failures retain the
last loaded data and expose retry; a successful refresh clears the error.

Sources: `backend/app/Services/DashboardOverviewService.php`,
`backend/app/Services/ReportService.php`,
`backend/app/Http/Controllers/Web/Admin/DashboardController.php`,
`web-frontend/src/services/report/types.ts`, and
`web-frontend/src/modules/management/dashboard/`. The request contract remains
`DashboardRequest` (`start` and `end`); the new calendar filters are local read
controls and introduce no submission form or Zod contract.

Verification: 36 focused dashboard/report/late-return tests passed (180 assertions).
Web lint, TypeScript and production build passed using the installed Node 24
runtime; the default Node 25 executable has a missing system library. The build
needed network access for the existing Google Poppins font. Browser checks covered
calendar filtering/empty state, month navigation, refresh, calendar-to-booking
navigation and the pending-payment filter shortcut. Desktop and 390 px phone
layouts were inspected; document width remained 390 px while the calendar stayed
inside its horizontal scroll container. The full backend run passed 1,194 of
1,199 tests (7,391 assertions): two date-label expectations in `BookingTimezoneTest`
and three active-booking availability expectations in
`SelfDriveBookingAvailabilityTest` failed outside these dashboard paths. No live
bookings or customer data were changed during verification.

`DashboardSnapshot.tsx` shows the four Maintenance counts on separate rows with
right-aligned values. Fleet status uses tighter legend spacing and wraps whole
entries on narrow cards so labels stay on one line. Web lint and TypeScript
passed. Browser verification was unavailable because local browser use is disabled.

## Reports and Analytics — 2026-11-11

Reports and Analytics appears in the management navigation for Admin and Staff
with `view reports`. The heading shows the selected date range. The toolbar
starts with search, followed by the date picker, period, vehicle, and rental
type. Search matches booking codes, customer names, and vehicle details and
applies to charts, tables, and CSV. Maintenance records match vehicle details.
Month is the default. The API converts the selected Manila calendar interval
to UTC and uses an exclusive end. Charts group by hour for Day, day for Week
and Month, and month for Year. Weeks begin on Monday. Current-period charts
show elapsed time through the current interval. Detail tables use the shared
10-record page size.

`ReportAnalyticsService` reads completed PHP receipts by payment completion
time and returned refunds by the recorded refund time. Historical receipts
without a completion time use the existing creation-time fallback. Booking
activity uses booking creation and status event timestamps. No-shows come from
cancellation records. Fleet hours use the overlap of actual release and
physical return with the period. Late returns compare physical return with the
scheduled rental end. Maintenance completions use the vehicle filter and appear
when all rental types are selected. Customer classification uses each renter's
first completed rental across their history. Telematics uses started monitoring
trips and recorded geofence exits and interruptions. The Driving Analysis link
uses the same permissions as the destination.

The CSV endpoint streams the selected tab's full filtered result using the same
data sources as the report. Overview exports interval totals. Dates in CSV use
Manila ISO timestamps and money is represented as numeric PHP values. The
report view uses the existing JamJade tabs, cards, filters, charts and responsive
tables. The report request is a set of read filters with server-side validation.

Sources include `backend/app/Support/ReportPeriod.php`,
`backend/app/Services/ReportAnalyticsService.php`,
`backend/app/Http/Requests/Admin/Report/ReportAnalyticsRequest.php`, and
`web-frontend/src/modules/management/reports/ReportsModule.tsx`.

Verification covered all six report queries against local MySQL in a read-only
transaction. The local database has payment, booking lifecycle, physical return,
maintenance and monitoring start records. Its geofence exit and interruption
log was empty. All 14 focused report and dashboard tests passed. PHP formatting,
web lint, TypeScript and the production build passed. Browser checks used a
synthetic database and covered the sidebar entry, desktop and 390 px layouts,
filters, ten-row pages, the complete CSV download and retry after a failed
request. The full backend suite reproduced five existing failures in booking
time formatting and overlap handling.
