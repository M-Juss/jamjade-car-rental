# Rental information and payment receipts

Android-only scope — 2026-10-24: `mobile-frontend` now targets Android only; iOS and mobile-browser support are retired. Earlier dated multi-platform descriptions and results below are historical. Shared Laravel contracts, saved records and the separate Next.js website are unchanged. Current physical verification is required on Android. See [Android-only mobile scope](android-only-mobile.md).

Updated 2026-10-19: new successful Customer payments issue a Payment Receipt and matching Rental Information PDF. This replaces new invoice issuance. Previously issued documents, including historical invoices, retain their stored references, filenames, contexts and exact PDF bytes. No historical payment is automatically reissued or emailed.

## Documents and financial boundary

Every newly recorded completed, positive PHP Customer payment issues exactly two PDF files tied to the same booking and receipt number:

- **Payment Receipt:** the individual amount, purpose, method, transaction reference and completed date; booking/receipt references; concise vehicle/rental information; agreed rental total, itemized Customer additional charges, cumulative payments, settlement status and remaining balance as of issue. Ordinary receipts use one A4 page.
- **Rental Information:** the accepted Customer, vehicle and rental details, itemized agreed pricing, the same payment summary as the receipt, and the originally accepted terms with renter signature. Ordinary records use two A4 pages. Long addresses, pricing or terms may need additional pages with accurate page numbering. The signature records agreement at booking and does not imply acceptance of later payment totals or charges.

Both files use the same immutable per-payment snapshot. Later payments get their own document pair rather than reusing an earlier Rental Information PDF. Signing or reviewing without payment issues neither document. Pending, failed, refunded, zero, foreign-currency and Driver-responsible payments do not issue Customer receipts. Payment must belong to the booking's Customer; a paid booking flag alone is insufficient.

Both PDFs embed Noto Sans and retain the established solid JamJade branding. Formal HTML email has an equivalent plain-text part. Document dates use Asia/Manila without visible timezone labels. Missing historical timestamps or transaction references remain “Not provided.”

The email presentation uses a solid JamJade primary-blue backdrop, centered white
card, prominent booking reference, rental details, and a separate payment summary
from the immutable issued context. Its heading says “Booking confirmed” only when
that snapshot is confirmed; other snapshots say “Payment received.” The individual
payment, cumulative paid amount, remaining balance, receipt reference, and legacy
invoice reference where applicable remain distinct. This restyles
`resources/views/emails/bookings/confirmation.blade.php` and its plain-text
counterpart; subjects, two PDF attachments, archived bytes, recipients, delivery
tracking, and retry behavior retain their existing contracts. The related
[registration email](user-roles-and-access.md#mobile-registration-email-verification)
uses the same solid-blue/white-card visual direction and its own 15-minute code.

Email styling verification on 2026-11-11: all 40 focused email, payment-document,
and payment-notification tests passed (310 assertions) in one sequential run.
This includes both email formats, confirmed versus other snapshot headings,
legacy invoice references, stable attachments, retries, and delivery bookkeeping.
Synthetic HTML rendered with sample details, and PHP formatting and
`git diff --check` passed. The browser rejected local-file visual previews; Gmail
inbox delivery and email-client rendering were not exercised. Existing PDF
templates and stored PDF bytes were not restyled.

Customer totals include completed positive PHP payments belonging to that Customer, excluding `driver_outstanding`. Driver-responsible charges and payments remain private to their flow. Additional charges appear once from `booking_additional_charges`, separately from the accepted rental pricing. Arithmetic uses integer cents at the document boundary. No invoice numbers, tax-registration, tax-calculation or government numbering contract is introduced.

## Issuance and stable copies

`booking_payment_documents` retains one row per payment with unique `payment_id`, encrypted `context`, `rental_information_path`, `rental_information_filename` and the existing receipt/delivery metadata. The reversible `2026_10_19_000004_rename_rental_document_metadata.php` migration renames the previous invoice metadata columns and `booking_terms.invoice_context` to `rental_context`. It preserves ciphertext and path values without modifying any private file or issued context.

New contexts use `formatVersion: 3`, `rentalSnapshot` and `agreedRentalTotal`. Checkout stores accepted details and rendered agreement HTML in encrypted `booking_terms.rental_context` before payment. Reviewed-price mismatch checks remain authoritative. Existing accepted contexts and prior documents can supply the agreed facts for later payments; known legacy snapshot keys are read only for this persisted-data requirement. New snapshots contain no invoice reference or invoice-source link. The original agreed pricing is preserved, and later Customer charges remain separately identified.

Receipt references are deterministic from payment ID with at least five digits, such as `RCP-00123`; larger numbers expand without truncation or resetting. Both PDFs use that receipt number and the booking reference. New filenames include the booking status at issue:

- `BK-20957 | Confirmed | Rental Information-RCP-00123.pdf`
- `BK-20957 | Confirmed | Receipt-RCP-00123.pdf`

Both PDFs are retained privately under `booking-documents/<booking-id>/<payment-id>/`, as `rental-information.pdf` and `receipt.pdf`. Historical paths, including the old shared invoice path, remain valid. Resends reuse the original context, filenames and bytes. Before the first dispatch claim, interrupted rendering can finish from that immutable context. Once delivery has been claimed for either a document or its historical shared source, a missing PDF must be restored from private storage backups. It is never silently regenerated from newer data or templates. The original Laravel application key remains required to read archived encrypted contexts.

## Sending, retrying, and resending

Initial booking payments, successful Customer PayPal capture (including balance/additional-charge settlement), and subsequent recorded Customer payments create the context within their transaction. Sending begins only after commit. Rollback removes issuance and the after-commit callback.

Each payment sends a **new email with exactly two attachments**. Its subject identifies the booking and receipt, and its body distinguishes this payment's amount from total paid and remaining balance as of issue. Earlier emails are unchanged. The destination is the Customer's current account email, rechecked at delivery, even if the saved document includes their earlier contact details.

For new booking checkout payments, the confirmation/payment/balance summary is one in-app notification linked to the payment. Successful email delivery adds the rental-information/receipt delivery information to that same notification's details without resetting its read state or adding an unread item. Delivery failures leave the successful payment summary intact; retry success updates it. Payments without a linked summary retain the standalone document-delivery notification, linked to that payment so resends reuse it. Historical notifications are not merged or deleted.

Delivery status and an attempt token are stored per document. A row lock suppresses repeated dispatches; a shared cache lock prevents overlapping sends. Queue retries use the same document pair and token. Stale attempts cannot overwrite a newer resend's status, and already-sent payloads do not send again. As with SMTP generally, a process crash after transport acceptance but before sent tracking can require operator reconciliation; this is not a transactional guarantee from the email provider.

The existing Admin resend endpoint selects the latest completed Customer payment and sends its original document pair again. It rejects bookings without a completed payment and retains the existing role and terminal-booking restrictions. It never fabricates receipts from a `paid` flag. Existing `confirmationEmailStatus`/`confirmationEmailSentAt` fields remain a latest-document summary for established clients. Older queued deliveries cannot replace a newer document's summary.

The `booking-documents:retry` command processes up to 50 pending records in ID order. Laravel schedules it every five minutes to recover interrupted after-commit dispatch. It skips queued/sent records and sends nothing for payments without an issued record. After fixing a rendering, storage, recipient, or final transport failure, use `php artisan booking-documents:retry --include-failed` to retry up to 50 pending/failed records with the same document references. Queued transport failures use Laravel's normal queue retries (three attempts); final failure updates the document state. Inspect and reconcile lost/uncertain queued jobs before retrying them; do not blindly clear delivery state.

## Deployment and verification

Apply the new metadata-rename migration before starting the updated backend and restart long-running queue workers together with deployment. The mobile receipt contract removes `invoiceReference` and replaces `invoiceTotal` with `agreedRentalTotal`; the current mobile display uses booking and receipt references only. No request fields or validation rules change. Retained historical PDF downloads and resends keep their original files; legacy rendering exists only for pending old records without an initial dispatch claim.

The following dated verification records describe earlier implementations and do not override the current format above.

Apply the additive `2026_10_15_000002_create_booking_payment_documents.php` and `2026_10_15_000003_add_booking_agreement_and_cancellations.php` migrations, preserve private storage and `APP_KEY`, ensure `storage/fonts` is writable, and run the configured queue worker and Laravel scheduler. Do not run the down migration after issuing documents unless their archival data has been preserved; it drops document metadata. Drain pre-change serialized `BookingConfirmationMail` jobs before deploying the changed mailable payload, then restart workers. The local queue inspection on 2026-10-15 found zero old confirmation payloads; other environments must check independently.

Regression coverage exercises independent down/balance payments, two attachments, stable copies and encrypted context, scoped financial totals and additional charges, invalid payments, rollback, render failure/retry, duplicate/stale deliveries, and existing Admin/Mobile payment entry points. PDF visual previews use synthetic Customers and local mail transports; they do not establish live provider delivery or email-client rendering.

Verified locally on 2026-10-15:

- All 394 backend tests passed (2,190 assertions) with `php -d memory_limit=512M vendor/bin/pest`. The default 128 MB full-suite process exhausted memory while rendering report PDFs; the larger allowance was used only for verification, without changing application runtime configuration.
- `vendor/bin/pint --test` and `git diff --check` passed. The local additive migration was applied successfully, and `schedule:list` includes the five-minute document retry task.
- Synthetic delivery invoices were visually checked at two A4 pages, including terms/acknowledgment; the individual down-payment receipt was checked at one A4 page, with embedded fonts, readable driver fields, correct payment/balance figures, and actual page counts. Rendering was also checked automatically for self-drive bookings.
- No real email was sent. Live SMTP acceptance, email-client rendering, and live PayPal capture were not exercised.

Verified locally on 2026-10-16 after the agreement/cancellation changes:

- `composer test` passed all 415 tests (2,341 assertions), using a verification-only 512 MB PHP memory allowance. PHP formatting, web/mobile lint and TypeScript checks, the web production build, and `git diff --check` passed.
- The additive agreement/cancellation migration was applied locally. Synthetic invoices were visually checked at two A4 pages and receipts at one A4 page. New invoices omit payment results and the PHP 10,000 participation fee; later receipts retain the original invoice.
- An isolated browser fixture verified refund approval separately from actual money-return recording, rejection above the completed-payment ceiling, confirmation without a reference, and the narrow-screen layout. No money was transferred. Live PayPal, SMTP/email clients, and physical Android/iOS checks were not exercised.

## Refactor verification — 2026-10-19

72 focused backend checks passed (451 assertions), covering receipt numbering, matching document pairs, separate additional charges, accepted snapshots, immutable histories, authorization, rendering/delivery failures, retries, resends and reversible metadata renames without ciphertext changes. Mobile lint and TypeScript passed; the changed PHP files passed Pint and the diff check passed. No form/request rules changed; `CustomerReceiptResource`, the mobile `CustomerReceipt` type and the existing read service were reviewed together.

The full backend suite completed with 859 tests: 827 passed, with 20 failures and 12 errors in the existing Driver/telematics/fleet/agreement areas outside this refactor, including missing `RentalType`, an undefined `$isDriverView`, ambiguous read-query columns and old assigned-Driver release expectations. No receipt-refactor test failed in that run. Repository-wide Pint separately flags the existing `RcResearchSyntheticDemoSeeder.php`; that unrelated source was not changed. These results are a recorded limitation, not a passing full-suite claim.

Synthetic PDFs were visually checked with a delivery down payment (two-page Rental Information and one-page Payment Receipt) and a later full settlement with 25 itemized charges (three-page Rental Information and two-page receipt). Matching amounts, final charge rows, terms, signatures and page counts were checked without clipping. The local metadata migration was applied successfully. Existing files and issued contexts were preserved. No real payment or live email was sent during verification; physical mobile receipt saving was not rerun. Rolling the schema back does not convert version-3 snapshots into older invoice contexts; deploy compatible application code and preserve archived data.

## Customer mobile receipt access

Implemented in code 2026-10-16. Mobile payment success opens a read-only receipt
for the exact captured PayPal order and stays open until the Customer chooses to
leave. Booking Details lists issued receipts in pages of ten, newest first.
The compact screen presents the individual payment amount and purpose,
receipt and booking references, payment method, completion date, and balance
after that payment. The full transaction reference, rental summary, charge
breakdown, and cumulative totals remain in the retained PDF and email attachment.
The customer Save receipt action exports the compact receipt shown on this screen;
it does not convert, replace, or alter the archived PDF. The smaller
payment header and side-by-side actions fit ordinary phone screens; scrolling
remains available for smaller viewports and enlarged text. Dates display in
Asia/Manila without a visible timezone suffix. No editable transaction fields or
card digits are added.

All reads require Sanctum authentication, an active Customer account, and both
booking and payment ownership. Driver-responsible, pending, failed, non-PHP,
and zero payments are excluded. Previously issued receipts remain readable
after a refund or cancellation; no new receipt is fabricated from those states.
The read model exposes only selected fields from the immutable issued context,
not customer contact details, signatures, storage paths, or the raw context.

- `GET /api/mobile/bookings/{booking}/receipts?page=1`: paginated issued receipts.
- `GET /api/mobile/receipts/{receipt}`: an owned receipt snapshot.
- `GET /api/mobile/paypal/orders/{orderId}/receipt`: the receipt of that exact
  owned, completed payment. A completed payment whose receipt has not been
  issued returns `409`; it does not initiate another capture or issuance.
- `GET /api/mobile/receipts/{receipt}/download`: authenticated PDF download of
  retained bytes, with private/no-store caching. A missing file returns `409`;
  this endpoint never regenerates an issued document or sends email.

New contexts include the balance deadline as of issue. Older contexts without
that field omit it in mobile; no current deadline is retroactively attached to an
old receipt. The shared PayPal capture response and Driver flow are unchanged.
Receipt loading and download failures have their own retry actions, independent
of payment confirmation. The success screen does not trust URL amount/status
claims and no longer redirects automatically after 3.5 seconds.

Native JPEG saving uses SDK 54 compatible `react-native-view-shot`,
`expo-file-system`, and `expo-media-library`. Save receipt checks/requests
save-only permission before capturing the loaded receipt view, including any
balance deadline, with an opaque background at 1080 pixels wide, JPEG quality
0.95 and proportional height. Screen headers, navigation and action buttons are
excluded. The JPEG is written directly to the device's photo library; success
appears only after the write completes. Denial stops capture and permanently
denied access points to phone settings. No existing photo assets are read.
Android 13+ does not request read-media access for saving; older Android may
require storage permission. iOS uses add-only access with an explicit save
purpose. No PDF request, continuous capture, precise media-location permission,
public URL or token-bearing URL is introduced. Temporary captures and named
cache files are removed after success or failure. Web retains a JPEG browser
download, because browser apps cannot save directly to a native photo library.
Existing custom binaries require rebuilding for the gallery module, with a safe
update message when a required native module is missing.

### Missing sharing module — 2026-10-17

The connected Redmi's installed development APK was confirmed to match the older Maps-fix build and contains no Expo Sharing module. The current JavaScript dependency is installed at the SDK-compatible version, but reloading Metro cannot supply native code. Receipt saving now checks native sharing/filesystem availability before importing them or requesting protected PDF bytes and reports an app update requirement. This changes no payment or receipt API contract.

Fifteen receipt, download-transport and save-flow regression checks passed, together with mobile lint, TypeScript, Expo dependency compatibility and all 18 Expo Doctor checks. These cover missing native modules, unavailable sharing, authenticated bytes, temporary-file cleanup and failed downloads/shares. On the connected phone, Download receipt now shows the safe update-required message without fetching PDF bytes. A native rebuild was required to enable PDF saving. After explicit approval to upload the mobile project, use its existing signing credentials and install the update, Android development build `3089456e-a862-4f2d-8019-718c0978584b` was started with frozen credentials. The build completed successfully. The downloaded APK contains Expo Sharing, its non-exported sharing FileProvider and the native filesystem module; its package and signing certificate match the installed app, and its Maps key matches the existing configuration. The phone was reconnected and the APK installed successfully with `adb install -r`, preserving app data and the signed-in session. The native sharing and filesystem modules were verified at runtime, and an owned receipt's Download receipt action opened Android's system chooser. The chooser was cancelled without sending the receipt. iOS saving was not tested.

### JPEG receipt export — 2026-10-17

At the user's request, Save JPEG replaces the mobile PDF download action. The
issued financial context, retained PDFs, email attachments and protected PDF API
are unchanged. This is an image of the compact receipt displayed in mobile,
not a new financial document or an image conversion of the full PDF. Native
export adds the SDK 54 version of `react-native-view-shot` (4.0.3); web declares
its existing `html2canvas` dependency directly. No backend or web management
contract changes are needed.

Seventeen receipt/save/transport regression checks, mobile lint, TypeScript,
Expo dependency compatibility and all 18 Expo Doctor checks passed. Full Expo
web export is blocked by the existing native-only `react-native-maps` import in
`DeliveryPointMap.tsx`, outside receipt export. An isolated browser fixture using
synthetic receipt data verified actual JPEG MIME type, JPEG file signatures, a
`.jpg` filename and a 1080-pixel image width. Android development build
`451651b5-9615-4ea0-9d6c-59e2ae09e117` completed, passed signature/package,
Maps-key and native-module checks, and was installed on the connected Redmi
with `adb install -r`, preserving app data and the signed-in session. The actual
Save JPEG action produced a readable 1080 × 1184 JPEG from a synthetic receipt,
including the balance notice and excluding navigation/actions. An owned issued
receipt also exported as a real JPEG and opened Android's system chooser. Both
choosers were cancelled without sending anything; the named cache exports and
native capture files were removed afterward. Demo values were an in-memory
preview only and were restored to the original receipt; no payment or booking
was changed. iOS capture/share remains untested because no iOS simulator or test
device is available.

### Direct gallery saving — 2026-10-17

At the user's request, the button is now Save receipt and the Android/iOS action
saves the same JPEG directly to Photos/Gallery instead of opening a share sheet.
The SDK 54 `expo-media-library` module (18.2.1) and its config plugin supply
add-only iOS permission copy and no Android granular read-media permissions.
Existing image-picker permission copy is preserved. This does not change the
backend, receipt snapshot, retained PDF or email attachment contracts.

Nineteen focused receipt/save/HTTP checks passed, including granted, denied and
blocked permissions, same-action continuation after approval, native-module
checks, iOS sizing, write failures and temporary-file cleanup. Mobile lint,
TypeScript, dependency compatibility and all 18 Expo Doctor checks passed.
Android development build `1d2d8328-edfc-40f6-b661-6d5048a1cca3` completed,
passed signing/package/native-module/Maps-key checks and was installed on the
connected Redmi with `adb install -r`, preserving app data and session. The APK
contains no granular Android photo/video/audio read permission and no media
location permission. Generated iOS configuration preserves the existing upload
purpose and includes the add-only receipt-saving purpose.

The physical Save receipt test reached Android's legacy “photos and media”
permission prompt before capture. Although the flow requests write-only access,
this OS version exposes a broader storage grant. Automatic approval review
initially blocked accepting it; the user then explicitly approved that scope.
After approval, the permission was confirmed granted. The synthetic receipt
saved directly as a valid 1080 × 1184 JPEG and was registered in Android's media
library. The original receipt view was restored, and Save receipt also saved
that owned receipt as a valid JPEG registered in Gallery without a share sheet.
The demo gallery image was removed after verifying that it had not existed
before testing. No existing photos were read or deleted. Private capture/cache
cleanup was checked afterward. No booking or payment was changed.

iOS physical testing is unavailable; full mobile web export remains blocked by
the existing native Maps import described above.

## PDF presentation refinement — 2026-11-11

Newly rendered rental information and receipts use a larger logo and company
name, plain section headings, neutral table dividers, and terms without the blue
left border. The issue date appears in the bottom-left document footer instead
of the header. Booking and receipt references remain visible. Existing archived
PDF bytes retain their issuance-time appearance.

Changed the shared PDF header/styles and rental-information/receipt content
partials. Verified the two-page rental document and one-page receipt through
Dompdf and Poppler page images. All 33 focused payment-document and email tests
passed (252 assertions). No financial records or issued files were replaced.
