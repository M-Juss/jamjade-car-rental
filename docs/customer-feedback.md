# Customer feedback

Implemented in code on 2026-11-21. Laravel owns eligibility, validation, review
storage, lifetime aggregates and publication. The existing mobile booking sheet,
Reports table/dialog, and former landing testimonial carousel remain the UI
patterns; this feature adds no component library or native dependency.

## Submission and storage

Customers can submit one immutable review for each owned, non-deleted booking in
`completed` status, for Self Drive or Assigned Driver. Other statuses, other
customers, Drivers and management authors are rejected. Completion continues to
use the existing booking/payment/return workflow.

`POST /api/mobile/bookings/{booking}/feedback` uses the numeric booking ID and
requires an integer `rating` from 1 to 5. `comment` is optional/nullable, trimmed,
and limited to 1,000 Unicode characters. An empty comment is stored as null.
The customer chooses stars in the form; no publication checkbox or permission
field is submitted. Admin/Owner starring controls public selection.

`booking_feedback` has a unique booking foreign key, customer foreign key,
rating/comment, curator/timestamp and featured flag. Historical publication-consent
columns are retained without changing existing data; they are no longer written
or used for eligibility or retries. A transaction locks the booking before submission. An identical
retry returns the saved review; a different second submission returns 409.
Customer booking responses include their own review and `canLeaveFeedback`.
Driver booking responses omit the customer's review. After submission the
booking action becomes **View feedback**.

Source owners: `backend/app/Services/BookingFeedbackService.php`,
`backend/app/Http/Requests/Booking/StoreBookingFeedbackRequest.php`,
`backend/app/Models/BookingFeedback.php`, `backend/app/Policies/BookingPolicy.php`,
and `backend/app/Http/Resources/BookingFeedbackResource.php`.
Mobile uses `forms/booking/BookingFeedbackForm.tsx`,
`validation/booking/feedback.ts`, `services/api/feedback.service.ts`, and the
existing Bookings list/details screens.

## Lifetime ratings and curation

Customer Insights retains its period-filtered customer rows. Its **Lifetime
ratings** column shows the customer's average across every
non-deleted completed rental, independently of report dates, search, vehicle,
rental type, comment or starred state. Unrated rentals are excluded,
never scored as zero. A customer without ratings displays an em dash.
The customer table omits the last completed rental and uses narrower rental-type columns.

The rating button opens a paginated lifetime list with booking, vehicle, rating,
and written feedback. The Submitted column was removed to simplify the dialog;
the saved submission timestamp remains in the API. Feedback has more table space,
long comments are truncated, and the full comment is available by hovering over the
row or opening the feedback with a pointer, keyboard, or touch. Reviews without written feedback
still cannot be starred, without a separate message in the table. Report Staff can read; only active
Admin/Owner accounts with report access can star/unstar. Laravel enforces both
permissions. Normal management access still requires the established Admin/Staff
role boundary; the Owner account retains its Admin role.

Endpoints are `GET /admin/reports/customers/{customer}/feedback` and
`PUT /admin/feedback/{feedback}/featured` with boolean `is_featured`.
List pagination is bounded to 50 per page (management uses 10). Curation does
not alter a rating, comment or lifetime average. Customer metadata is included
in report JSON for the dialog; CSV still exports only its declared columns.

Web source owners: `modules/management/reports/components/CustomerFeedbackDialog.tsx`,
`forms/feedback/FeedbackFeatureForm.tsx`, `validations/feedback/schemas.ts`,
`services/feedback/feedback.service.ts`, and the existing `ReportsModule.tsx`.

## Landing-page publication

Publication is **starred reviews only**. No automatic five-star publication or
sample-review fallback exists. Admin/Owner can publish any written review by
starring it, regardless of its rating or historical publication permission.
Rating-only reviews remain in lifetime averages but cannot be starred.
Public author names use the saved Customer first name and last initial, such as
`Maria Clara S.`. Legacy accounts without profile names use the first word and
last initial of their account name; a single-word name remains that word.

`GET /api/testimonials` is public, throttled and paginated (20 by default,
maximum 50). It returns only the review ID, masked display name, rating and
comment. It excludes unstarred/empty reviews, deleted or non-completed
bookings, and deleted/inactive customers. No booking ID, customer ID, contact
information or account image is returned.

`modules/marketing/TestimonialsCarousel.tsx` restores the former carousel card,
typography, star treatment, avatar initials and indicator controls. It advances
every five seconds, pauses on hover/focus, offers a pause control, respects
reduced motion and loads additional pages without dropping earlier reviews.
The section remains visible while loading and when there are no published reviews.
An empty successful response shows **No feedbacks yet** inside the existing
carousel card. Initial request failures show an error with Retry. More-page failures
retain loaded reviews and offer Retry. Unstarring removes a review from subsequent
public API reads; an already open page refreshes its selection on reload.

## Verification and limits

Checks run for this implementation:

- Focused Laravel feedback/report tests: 23 passed, 329 assertions.
- Full `composer test`: 1,496 passed, 9,616 assertions.
- Web lint, TypeScript and production build passed; focused service tests: 4 passed.
- Mobile lint, TypeScript and Android export passed; focused booking/service tests:
  10 passed. Full Node checks: 369/370 passed; the existing vehicle-image fixture
  expects 7 mappings while the actual catalog has 42.
- Full Pint reports only the existing formatting failure in
  `2026_11_11_210000_add_owner_and_admin_invitations.php`; touched PHP files pass
  scoped formatting verification.
- The additive feedback migration was applied to the local MySQL database.
  No customer review was submitted or published as part of setup.

The populated public review carousel smoke test remains pending. Android feedback
was subsequently checked on a Redmi; see the dated verification below.
Export/build checks alone do not establish device interaction. Editing,
deleting, and customer self-service withdrawal of submitted reviews are not
implemented. Admin/Owner can unstar a review to remove it from public selection.

### Visible empty feedback section — 2026-11-22

The existing public carousel card and heading now remain visible without
published reviews. It shows Loading feedback while fetching, No feedbacks yet
after an empty successful response, and an error with Retry after an initial
failure. Review content, indicator controls and rotation render when published
reviews exist; empty states carry no rating or author placeholder.

Web lint, TypeScript, production build and `git diff --check` passed. The actual
empty response was checked in the local browser at 1470 px and 390 px widths,
with the requested message visible and no horizontal page overflow. The viewport
override was reset after verification. No backend, publication or mobile contract
changed in this follow-up.

Header consistency follow-up — 2026-11-22: `LandingPage.tsx` now owns the feedback
section wrapper, heading and description using the same `sectionPadding`,
`sectionHeader`, `sectionHeading` and `sectionSubtext` constants as neighboring
sections. Its description reads: “Feedback from customers who have completed a
rental with JamJade.” `TestimonialsCarousel` owns the review card and its states.
The header, heading and description classes match the neighboring Guide section.
Desktop and 390 px browser checks passed with no horizontal overflow; web lint,
TypeScript, production build and `git diff --check` also passed.

### Android Studio feedback check — 2026-11-22

The focused mobile feedback service/action checks passed (3 tests), and
`BookingFeedbackTest.php` passed (7 tests, 94 assertions). These cover completed
booking eligibility, validation, submission failures and the saved-review action;
they do not verify the native dialog visually.

The Android Studio smoke check was blocked before the app opened. The existing
API 36.1 emulator had insufficient free space for the debug APK. A separate,
temporary AVD with ample storage also failed to finish booting: Android's
SystemServer watchdog restarted the system during startup, including with
software rendering. A separate SQLite backend and synthetic bookings were
prepared, but no feedback was submitted. The original AVD's application data was
preserved. Dialog appearance, keyboard/safe-area behavior and submission through
the Android UI remain unverified; this attempt does not establish an app defect.

### Redmi feedback smoke check — 2026-11-22

The subsequent physical check passed on a USB-connected Redmi Note 8 Pro running
Android 11, mirrored through Android Studio. A separate debug application ID
(`com.anonymous.jamjadecarrental.feedbackqa`) preserved the existing installed
application and its data. A private temporary SQLite backend contained only a
synthetic Customer, two completed rentals and one returned rental.

Both completed rental types showed Leave feedback; the returned rental did not.
The sheet displayed five selectable stars, required-rating validation, an
optional written-feedback field and unchecked publication permission. A four-star
Self Drive review with text and a five-star Assigned Driver review without text
were submitted through the phone UI. SQLite confirmed exactly those two reviews,
null publication consent and no featured state. The action changed to View
feedback; reopening the first review showed its saved rating/comment without
editing controls. Text entry and keyboard dismissal were checked at the phone's
default size; large-font and other-device layouts remain separate checks.

The check exposed cramped three-action booking cards. `BookingCard.tsx` now uses
its existing wrapping action layout whenever there are more than two actions,
so feedback labels have enough width. The corrected layout was verified on the
phone. Mobile lint, TypeScript, Android export and the three focused feedback
checks passed.

The first development bundle loaded `.env.local` through Expo's virtual env
module despite the test shell's API override. A temporary Metro configuration
excluded env files for the isolated check; the saved env file was not changed.
The test bundle was inspected to confirm the test API and feedback UI. Success
in this test copy does not establish that the older installed application or its
configured remote backend contains the latest feedback contracts.


### Starred written reviews and booking label — 2026-11-22

The approved publication rule replaces the earlier customer-permission gate.
`StoreBookingFeedbackRequest`, the mobile Zod schema/service/form, both feedback
response types and the web star control no longer use `allows_publication` or
`allowsPublication`. Laravel still authorizes curation for Admin/Owner and checks
completed bookings, written comments and active customers. The historical consent
columns remain unchanged. No migration or new dependency was needed.

`PublicFeedbackResource` uses the Customer profile's first name and last initial,
with a masked account-name fallback. The public controller eagerly loads those
profile fields; surnames and other private metadata are never returned publicly.
The existing mobile sheet shows booking and vehicle on one line as
`BK-12345 (Honda BR-V 2020)`. Long values truncate visually, retaining the complete
accessible label. The publication checkbox is removed from the sheet.

The earlier Redmi check above records the previous checkbox behavior. Android
Studio no longer detected the physical phone during this follow-up, so the latest
sheet layout could not be visually rechecked on the device.

Follow-up checks: focused Laravel feedback tests passed (9 tests, 101 assertions),
including publication without permission, non-five-star reviews, masked profile
and legacy names, blank-comment exclusion, curation authorization and safe retries.
The three focused mobile service/action tests, both frontend lint and TypeScript
checks, web production build, Android export and scoped PHP formatting passed.
Full `composer test` passed (1,505 tests, 9,701 assertions), and
`git diff --check` passed. Full Pint still reports only the existing
invitation-migration formatting issue.
