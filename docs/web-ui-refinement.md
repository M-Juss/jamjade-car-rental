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
copy and download dialog are retained for the mock-defense demo. The customer
testimonials section and its navigation links were removed at the user's request.
The landing page and shared header own the change; web lint, TypeScript and a
production build passed using Node 24. Browser layout verification remains pending.
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

## Vehicle name and status — 2026-11-16

The Vehicle Management table and the shared Admin and Staff detail header show
the vehicle name followed by its plate in parentheses. On the detail card, the
existing status badge sits directly below the daily price. The detail header
uses “Plate unavailable” when the record has no plate. The layout is owned by
`src/modules/management/vehicles/VehiclesModule.tsx` and
`src/modules/management/vehicles/VehicleDetailsPage.tsx`.

Verification: web lint, TypeScript, production build and whitespace checks
passed. Browser checks with sample records at 1280, 390 and 320 px covered the
table and detail header, badge placement, and a record without a plate.

## Vehicle edit gallery and navigation — 2026-11-16

`src/forms/vehicle/details/EditVehicleForm.tsx` starts its main card with Image
Gallery. The vehicle name appears once in the breadcrumb as the page heading.
Edit Vehicle Condition sits beside that breadcrumb, linking to the existing
condition section. The navigation and action stay on the same row on phones,
with text wrapping inside their available widths. The form reuses its existing
Card, Button and VehicleImageGallery, following the vehicle detail navigation.

Verification: web lint, TypeScript, production build and whitespace checks
passed. Browser checks with sample responses covered Admin at 1280 px and Staff
at 390 and 320 px, including a long vehicle name, empty images, loading/error
states, keyboard focus and both navigation actions. Form checks exercised
client validation, Laravel-style 422 errors, server failure and a successful
save, including pending-state controls and outcome toasts. Reviewed
`VehicleRequest`, `editVehicleFormSchema` and the existing `updateVehicle`
mapping for the affected form.

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

Calendar heading follow-up — 2026-11-15: `DashboardModule.tsx` now places the
selected period beside Rental calendar, reusing its existing section typography
and wrapping header layout. The navigation row keeps Previous/Today/Next; the
period continues to update for month, week and day views. Web lint, TypeScript,
production build and `git diff --check` passed using Node 24. Responsive browser
verification remains pending; no form or API contract changed.

## Reports and Analytics — 2026-11-11

Reports and Analytics appears in the management navigation for Admin and Staff
with `view reports`. The heading shows the selected date range. The toolbar
starts with search, followed by the date picker and period. Search matches
booking codes, customer names, and vehicle details and
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
when all rental types are selected. Customer classification uses each customer's
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

### Reports Overview refinement — 2026-11-21

Overview now provides four summary cards: Net receipts, Rentals completed,
Customers served and Cancellations. Gross receipts and Refunds paid remain in
Revenue, while booking-creation counts remain in Bookings. This removes the
three competing financial headline amounts and the comparison between created
and completed bookings, which may belong to different booking cohorts.

The Overview charts are Receipts over time (net cash by receipt/refund date)
and Most booked vehicles (up to five vehicles ranked by completed rental count).
The ranking includes the vehicle name and plate; ties sort by label and vehicle
ID. Both reuse the existing report chart card and solid primary color. An empty
Overview ranking keeps its card with “No data for this period.” rather than
showing a zero-valued or fabricated vehicle. Revenue's subsequent refinement is
described below.

`ReportAnalyticsService::overview()` reuses `finalBookings()` to count each
completed/cancelled booking once within the selected final-status date period.
Customers served counts distinct Customer IDs from those completed rentals,
not registered accounts or assigned Drivers. Repeat rentals by one Customer
increase the completed count but do not increase Customers served. Cancellations
exclude Rejected and No-show, including the legacy cancelled/no-show mapping.
Search and the retained API vehicle/rental-type filters apply before aggregation.
The receipts calculation is unchanged and remains independent of rental
completion dates; no per-rental revenue or conversion ratio is inferred from it.

Overview CSV retains gross/refund/net receipt columns for reconciliation, and
now exports completed totals split into Self Drive and Assigned Driver,
Customers served and Cancellations for each interval. Customers served is
distinct within each CSV interval; adding intervals may count a repeat Customer
more than once, while the headline counts them once across the selected period.
Bookings created was removed from Overview CSV. No request, permission,
storage, Revenue-tab calculation or mobile contract changed. The generic
`ReportData` metrics/charts and existing service mapping carry the revised data.

Sources: `backend/app/Services/ReportAnalyticsService.php`,
`backend/tests/Feature/Web/Admin/ReportPeriodsTest.php`, and
`web-frontend/src/modules/management/reports/ReportsModule.tsx`. Existing
`KpiCard`, `ReportChartCard`, line/horizontal Recharts renderers and semantic
theme tokens remain the UI foundation.

Verification: all 13 focused report tests passed (194 assertions), including
distinct Customers, duplicate terminal events, excluded open/deleted/out-of-period
bookings, refunds, legacy no-shows, ranking limits/ties, search, retained API
filters, zero data and interval CSV values. The full `composer test` run passed
all 1,486 backend tests (9,481 assertions). Web lint, TypeScript, production
build, scoped Pint and `git diff --check` passed. Whole-backend Pint still
reports only the existing invitation migration. Browser access was unavailable
in this chat, so updated chart appearance, responsive layout and hover/focus
behavior remain unverified. Temporary preview source was removed; no live
booking, payment, refund or notification data was changed.

### Revenue analytics refinement — 2026-11-21

A read-only aggregate check of the local application database found six completed
positive PHP receipts across five bookings, all via PayPal, with no paid refunds.
The November report total was PHP 26,521: PHP 26,321 in full payments and PHP 200
in balance payments. These are local-database findings, not a claim that every
deployment has the same records. No personal records or credentials were
printed, and the verification transaction was rolled back without writes.

Revenue now emphasizes Net receipts, Payments received, Bookings with payments
and Average payment. The Net receipts card shows only its label and total; the
Gross receipts and Refunds paid text beneath it was removed in the subsequent
copy refinement. Average payment is gross receipts divided by
successful payment count, rounded to two decimals; it excludes refund rows and
remains null/displayed as a dash when there are no payments. Bookings with
payments counts distinct booking IDs with a successful receipt in the period;
it does not imply full settlement or rental completion. Split/down payments
increase payment count without increasing that distinct booking count.

Receipts by payment purpose replaces the dated receipts/refunds chart already
summarized by Overview's cash trend. Purpose comes from the recorded payment:
full payment, down payment, balance payment, Customer charges, Driver charges or
manual booking payment. Null/unrecognized historical purposes stay in Other
payments rather than being inferred. This is a receipt-purpose breakdown, not
an allocation of the rental fee, delivery and every additional-charge category.
The table and full CSV now include a Purpose column using the same labels;
refund rows have no payment purpose.

Net receipts by vehicle replaces the rental-type comparison. Vehicle identity
is grouped by ID and labeled with name and plate. The five highest net receipt
amounts appear individually; any remainder is summed into Other vehicles so
the chart always reconciles to the net total. Paid refunds reduce that vehicle's
amount, including refund-only negative values. Ties sort by label and ID.
Both Revenue chart cards remain visible with the existing empty-state message
when their respective dataset is empty.

`ReportAnalyticsService::revenue()` streams the same filtered cash-entry source
as its table/CSV. It retains completed positive PHP receipts by payment date,
the historical creation-date fallback for missing payment dates, paid refunds
by actual refund date, historical soft-deleted booking receipts and the current
inclusion of recorded Driver payments. Pending, failed, non-PHP and nonpositive
payment rows are excluded. No financial totals, money movement, refund rules,
payment status or historical documents were changed. These are cash receipts,
not profit or revenue recognized on completion; no missing expense/fee data is
invented.

Sources: `backend/app/Services/ReportAnalyticsService.php`,
`backend/tests/Feature/Web/Admin/ReportPeriodsTest.php`,
`web-frontend/src/services/report/types.ts`, and
`web-frontend/src/modules/management/reports/ReportsModule.tsx`.
The additive optional `ReportData.metrics[].details` list retains numeric values,
labels and existing formats in the response; report cards no longer render it.
The generic chart/table contract, query mapping and `ReportAnalyticsRequest`
remain unchanged. No new package, migration or mobile contract was added.

Verification: all 16 focused report tests passed (235 assertions). Coverage
includes partial/split and Driver payments, unknown purposes, receipt count
versus distinct bookings, averages, actual/unpaid refunds, refund-only negative
cash, legacy timestamps, deleted bookings, filters, pagination independence,
chart reconciliation, Other vehicles, CSV and empty data. The full `composer test`
run passed all 1,489 backend tests (9,522 assertions). Web lint, TypeScript,
production build, scoped Pint and `git diff --check` passed. Whole-backend Pint
still reports only the existing invitation migration. A read-only run of the
new service against the local database confirmed the six payments/five bookings,
PHP 4,420.17 average, purpose sums and vehicle totals. Browser visual acceptance
remains pending because local browser access is unavailable in this chat. No
live payment, refund, booking or notification was changed.

Revenue card copy follow-up — 2026-11-21: removed the Gross receipts and Refunds
paid lines beneath Net receipts by omitting the shared card description in
`ReportsModule.tsx`. Web lint, TypeScript, production build and `git diff --check`
passed. Browser visual verification remains unavailable; calculations and API
data were not changed.

### Operators needing attention — 2026-11-22

Risk & Telematics now adds an Operators
needing attention section using the shared ManagementTable, TablePagination,
Button and existing OperatorBookingsDialog. It shows Customer/Driver type,
average/latest final grade, graded-rental count, harsh events and incomplete-sync
context. The average-below-70 rule, filters, authorization and checks are owned
by [the central telematics guide](telematics-master-plan.md#report-operators-needing-attention--2026-11-22).
The existing KPI cards, event log, CSV and report toolbar retain their layouts.

### Customer Insights table and terminology — 2026-11-21

The Customer Insights table now shows Customer, Self Drive, Assigned Driver,
Total spent, Most booked vehicle and Last completed rental. The first-completed
date and combined completed-count columns were removed. The redundant Renters
card heading was removed; all report tables now omit their visible card titles
as described below, while this table retains its accessible Customers name. Summary cards show
Customers, Self Drive completed, Assigned Driver completed and Total spent.
The existing first-time/returning chart still uses the first completion in the
Customer's history, but its title now says customers.

All row values, summaries, pagination and CSV use the same selected report
period and search; the API also supports vehicle and rental-type filters.
Last completed rental is the
latest completion within that filtered period. Most booked vehicle counts those
completed rentals, with ties resolved by the most recent completion and then
the lowest vehicle ID; its label includes the saved vehicle name and plate.
Total spent sums successful positive PHP payments made by that booking's
Customer, including earlier down payments, less refunds actually paid before
the report cutoff. Payments after the cutoff, failed/pending/foreign-currency
payments, other payers and `driver_outstanding` payments are excluded. This is
spending on rentals completed in the period, not the Revenue tab's cash-flow
measure by payment date. No amount is inferred from the booking's price or paid
flag. Aggregated payment/refund joins keep one row per completion, so multiple
payments do not multiply rental counts.

Date display follow-up — 2026-11-22: the Last completed rental table cell uses
the existing report formatter with a date-only option in `ReportsModule.tsx`,
displaying e.g. `Nov 12, 2026` in Asia/Manila. API timestamps and CSV exports retain
their full precision. The Additional Charges and Late Return Charge responsibility
options were also checked and already use `Customer`.
Web lint, TypeScript, production build and `git diff --check` passed for this
follow-up. Browser visual verification was not performed.

Visible Renter and Customer / Renter wording was standardized to Customer in
web charge/inspection/setup controls, mobile booking terms, confirmation email
fallbacks and newly rendered PDF terms/acknowledgement. Stored inspection signer
codes (`renter`), accepted agreement snapshots and already-issued PDF bytes are
preserved. No request contract, permission, migration, native API or rental rule
changed. `ReportAnalyticsRequest`, web `ReportSelection` and the existing report
service query mapping remain unchanged; the generic report column contract carries the new
fields and money/count/date formats.

Implementation: `backend/app/Services/ReportAnalyticsService.php`,
`web-frontend/src/modules/management/reports/ReportsModule.tsx`, the existing
booking forms/workflow copy, `mobile-frontend/components/browse/TermsSignatureModal.tsx`,
and the confirmation email/PDF view sources. Regression coverage is in
`backend/tests/Feature/Web/Admin/ReportPeriodsTest.php` and the existing financial
document tests. The table reuses `ReportTable`, `ManagementTable`, labeled mobile
cells and `TablePagination`; it adds no competing visual pattern.

Verification: all 50 focused report/PDF/payment-document tests passed (377
assertions), followed by `composer test` with 1,482 tests / 9,412 assertions.
Web/mobile lint and TypeScript, web production build, Android JavaScript export, scoped Pint and
`git diff --check` passed. Whole-backend Pint still reports only the existing
invitation migration `2026_11_11_210000_add_owner_and_admin_invitations.php`.
A synthetic browser preview rendered the actual table component with production
styles at desktop and 390 px widths, including populated and empty states; the
phone layout had no horizontal overflow. Synthetic PDF page images confirmed
the updated Customer wording and exactly two pages. Authenticated report
navigation, live inbox rendering and physical Android acceptance were not
exercised. No live booking, payment, refund or notification records were changed.

### Reports toolbar filter removal — 2026-11-21

Removed the All vehicles and All rental types dropdowns from Reports and
Analytics. `ReportsModule.tsx` now exposes search, date navigation and period
selection. The unused vehicle
options variable and rental-type options constant were removed. The page starts
with all vehicles and rental types, and CSV uses the same selection. Laravel's
existing optional API filters and read contracts remain available.

Web lint, TypeScript, production build, source review and `git diff --check`
passed. Browser visual checks were not rerun for this control removal. No backend
or mobile code changed.

Reports toolbar sizing follow-up — 2026-11-21: the desktop toolbar uses a
3:1 grid when space permits, with search on the left and grouped date navigation/
period controls on the right. The right-hand group has a 22 rem minimum width
and does not wrap on desktop. Search gives up width when needed to keep all
controls on one line instead of forcing the period selector onto another row.
Below the desktop breakpoint, search spans the width and the controls follow
below it. Existing SearchInput, Input, Button and FilterSelect components,
labels, date boundaries and query/export behavior are unchanged.
Web lint, TypeScript, production build and `git diff --check` passed. A synthetic
server-rendered preview of the actual component with production styles confirmed
search, date and period controls have matching top/bottom positions at 1280 px
and remain on one row at 1024 px. The 390 px fallback also had no page overflow.
The preview did not hydrate the controls or exercise authenticated report reads.

Booking outcome colors — 2026-11-21: `ReportsModule.tsx` binds Cancelled to
destructive red, Rejected to warning gold and No-show to muted foreground.
Completed remains primary blue. Bars and
legend markers share the same series configuration; other report series retain
their existing colors. No totals, query, CSV or backend behavior changed.
Web lint, TypeScript, production build and `git diff --check` passed. Color
bindings were reviewed in source; browser chart verification was not rerun.

### Final booking statuses and report table titles — 2026-11-21

The Bookings table and its full CSV export now show one row per booking with a
current terminal status: Completed, Cancelled, Rejected or No-show, matching the
History status boundary. Created, Pending, Confirmed, Ongoing and Returned rows
are excluded. The selected period applies to the latest recorded event for that
booking's current final status, not its creation date. Duplicate final-status
events do not create duplicate table rows. Legacy cancelled/no-show records keep
their No-show label. Deleted bookings and final bookings without a recorded
final-status date are omitted; no date is inferred from creation time.

`ReportAnalyticsService::finalBookings()` groups terminal events by booking and
status, matches the current booking status, then applies the existing period and
search/vehicle/rental-type filters before pagination. The displayed column is
Status; its existing response key remains `outcome`. Bookings-created metrics
and the charts retain their existing event-based calculations. The API request
contract and the generic web report table/CSV formats are unchanged.

The shared `ReportTable` in `ReportsModule.tsx` no longer renders a card title
for any report section. Booking activity, Transactions, Vehicles, Customers and
Event log titles therefore no longer appear above their tables. Accessible table
names, column headings, chart titles, report tabs and the page heading remain.
The previous Customer-only `showTitle` option was removed rather than retaining
a separate display rule for each tab. Overview has no on-screen detail table.

Sources: `backend/app/Services/ReportAnalyticsService.php`,
`backend/tests/Feature/Web/Admin/ReportPeriodsTest.php`, and
`web-frontend/src/modules/management/reports/ReportsModule.tsx`.
All 11 focused report tests passed (157 assertions), covering final statuses,
latest-event deduplication, period boundaries, search, retained API filters,
pagination, CSV parity, excluded records and preserved creation metrics.
The completed `composer test` run passed all 1,484 backend tests (9,444 assertions).
Web lint, TypeScript, production build, scoped Pint and `git diff --check`
passed. Whole-backend Pint still reports only the existing invitation migration.
A synthetic browser preview of the actual shared table verified the title-free
layout, Status column and responsive rows at desktop and 390 px widths without
page overflow. Authenticated live report navigation was not exercised; no live
records or mobile code changed.

## Fleet rental details layout — 2026-11-12

Fleet Monitoring's rental detail sheet places Booking information across the top,
with Driving events on the left and Geofencing Log on the right at large widths.
On smaller screens the cards stack in that order. The existing card components,
refresh actions, pagination and data flows are unchanged; the layout is in
`web-frontend/src/modules/management/fleet-tracker/FleetTrackerModule.tsx`.
Browser verification was unavailable because local browser use was disabled in
Work settings; visual checks at phone and desktop widths remain pending.
