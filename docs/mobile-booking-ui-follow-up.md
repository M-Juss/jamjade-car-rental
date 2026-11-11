# Mobile booking form follow-up

Authentication header follow-up — 2026-11-11: shared `AuthScreenFrame.tsx`
places the back arrow, logo and JamJade name on one aligned row for login,
registration and email verification. A follow-up restores a thin divider
below that row. Existing
screen headings, descriptions and forms remain below it.

## Review corrections — 2026-11-11

The booking tab now uses two equal-width compact buttons on one row, following
the user's follow-up. Buttons retain a 44 px minimum touch height and shared
control styles. The status action source removes
unimplemented Contact Admin and Leave Feedback actions. Booking details,
eligible telematics, a payable balance and Book Again remain contextual.
`components/bookings/BookingCard.tsx` and `booking-actions.ts` own these changes.

`VehicleSummaryContent` in `components/browse/BrowseComponents.tsx` is shared
by booking creation and `BookingDetailsContent.tsx`, so image sizing, specs,
title and daily price no longer use separate designs. Profile card header
content uses a shared 32 px minimum row, 8 px below the heading and 4 px above
the body, removing accumulated header spacing. Plain 16 px action icons use
32 px controls with 6 px hit slop to retain 44 px effective touch targets.
Document-row icons follow the other plain profile-row icons. The Full details
telematics header allows complete rental dates to wrap beside the car image.

`components/common/DateWithLabel.tsx` now uses explicit seven-cell week rows,
matching the corrected birthdate picker. The booking-form active-booking guard
now routes to Bookings rather than the age-restriction screen.
No extra test suite was run, following the user's manual-review preference.
The ARM64 standalone release build passed and `adb install -r` installed it
successfully on the connected Redmi with app data retained.
Actual photo-background removal for every gallery photo and an explicit
document view/edit mode are not established by these presentation corrections.

Document-page follow-up: Self-drive document rows no longer show chevrons.
The document page has back navigation on the left and its status on the right,
with no centered Document Verification title. Verified pages omit the large
heading, upload description, approval notice and disabled submit footer.
Pending documents retain their backend replacement lock. Verified documents now
offer Edit & resubmit with fresh images and return to pending review on submission;
see [customer document editing](user-roles-and-access.md#customer-account-information).
Document URLs are normalized through the active backend origin in the service
mapping, matching profile photos. Unedited forms rehydrate after profile reads;
dirty forms retain user edits. Previews contain the whole image and show a retry
action on failure. Local document references all existed (14/14), and a sampled
image returned HTTP 200/image/jpeg through both local backend and web proxy.
A live configured-tunnel probe was blocked by automatic approval review because
it would send a stored document path to that endpoint; remote image loading is
therefore not verified by those local results.
The ARM64 release rebuild passed and the update installed successfully on the
Redmi without clearing app data.

Requested on 2026-10-16. Fix and verify the delivery-map crash first; retain the following UI and behavior instructions for the subsequent refactor.

## Requested changes

- Compact the Rental Schedule card. Render field errors in normal layout flow only when an error exists; do not reserve blank height for a possible error.
- Scan all mobile forms for the same reserved-error-space behavior and apply the same pattern, including the Custom location address field. Keep useful field guidance and accessible touch targets.
- Remove the introductory description beneath Delivery & Trip Details.
- In the JamJade Garage location card, add a link opening the actual JamJade garage in Google Maps, following the existing delivery-point link interaction. Resolve the confirmed garage address/point from authoritative configuration; do not invent or hardcode a different location.
- When a previous delivery request expires, clear the active quote, stale location/route selection, and related validation errors so the customer can begin a fresh request. Preserve server quote validity, route confirmation, ownership, availability, and payment rules.
- Check interrupted searches, address resolution, pin confirmation, route previews, route selection, approval refresh, and expiry. Show useful errors and allow retry without retaining stale responses.

## Inspection notes

- `mobile-frontend/components/common/DateWithLabel.tsx` and `TimePickerWithLabel.tsx` use conditional bottom margins and absolutely positioned messages. Replace these with conditional message rows in normal flow.
- `mobile-frontend/components/common/LocationSearchWithLabel.tsx` has a bottom margin and an always-rendered helper wrapper; review these alongside the parent card gap. Guard against stale search/resolve results.
- Both emergency-contact forms also position relationship guidance/errors absolutely; include these in the shared spacing review.
- Updated 2026-10-17: `DeliveryRouteForm` keeps the current pin and Note when a price expires and offers Reconfirm Location. Address/schedule changes and stale-response handling remain scoped to the current form.
- Updated 2026-10-17: saved delivery requests and quote restoration have been removed. The booking form ignores old quote-restoration parameters; historical delivery notifications open a fresh form.

## Delivery crash investigation

On the connected Android phone, Places autocomplete succeeded. Selecting the public destination then mounted the Google Maps view and produced `IllegalStateException: API key not found`.

The current local Expo configuration and generated Android manifest contain the configured SDK key. The installed development client predates that native configuration. A local Android debug build completed with Maps metadata, but Android rejected its installation because its signing certificate differs from the installed app. Do not uninstall the user's app or clear its data to work around that mismatch without explicit authorization. Prefer an update signed by the existing Expo project certificate.

JavaScript reloads cannot add missing native Maps metadata. Physical iOS map behavior requires a separate check.

## Crash fix and verification — 2026-10-16

The existing restricted Android/iOS SDK keys were configured as Sensitive values in the project's EAS development environment. `mobile-frontend/eas.json` now selects that environment explicitly, and the mobile README explains native Maps setup and certificate-preserving updates.

A development APK built successfully through EAS using the existing project certificate. Before installation, its Android Maps key was verified against the configured key without displaying the value, and its certificate was verified against the installed app. The signed update installed successfully on the connected Redmi Note 8 Pro without uninstalling or clearing app data.

Physical Android checks passed for Places autocomplete, address resolution, Google map tiles and marker, point confirmation, route preview, toll-free route selection, and navigation to Review Booking. The public Tanza Municipal Hall test returned a 4.94 km / approximately 13 minute route with PHP 249 delivery and zero toll. The test stopped at Review Booking: no rental booking, signature, payment, or staff toll-review request was submitted. A short-lived delivery quote was issued by the normal route-selection flow.

Mobile lint, TypeScript, Expo dependency compatibility, all 18 Expo Doctor checks, and `git diff --check` passed. The local Android build also passed; its different debug certificate was the reason to use EAS for the phone update. iOS was not physically tested. The UI and expiry refactor checklist above remains pending as requested.
