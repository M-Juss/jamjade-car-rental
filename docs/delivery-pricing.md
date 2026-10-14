# Delivery pricing and location flow

Implemented for development on 2026-10-13. Laravel owns all accepted prices. This extends booking creation without changing inspection, assignment, telematics, release, capture, balance-payment, or completion rules. Verification paragraphs at the end are dated historical records; this 2026-10-14 documentation sync did not rerun browser, emulator, provider, or payment checks.

## Business rules

- Self Drive: free pickup **and return at Jamjade Garage**. Delivery is unavailable.
- With Driver (`owners_driver`): free garage pickup/return, or paid delivery. For delivery the pickup and end trip addresses must be identical. There is no separate collection service.
- The existing daily Driver charge stays PHP 700 within Metro Manila or PHP 1,000 outside, multiplied by rental days. Coverage is selected independently of the delivery route.
- Default delivery pricing: PHP 150 includes the first 1 km; every additional km costs PHP 25. Calculate using actual driving metres, without rounding distance, then round the delivery fee half up to a whole peso: `round(minimum + max(0, metres / 1000 - included_km) * rate)`.
- There is no maximum service distance. Numeric price validation protects database/payment precision; it is not a service-area boundary.
- Routes with Google `tollInfo` require staff approval, even when Google provides no estimated price. Google toll estimates are never accepted as charges, and nothing scrapes toll websites.
- As agreed on 2026-10-13, a successful Google route response without `tollInfo` is treated as toll-free: selection issues a complete quote with PHP 0 toll immediately, without staff review. This is the business's chosen interpretation of Google's response, not independent verification of road coverage. Provider errors or incomplete routes still fail instead of issuing a quote. The former `GOOGLE_ROUTES_TOLL_DETECTION_RELIABLE` switch has been removed. Previously pending uncertain quotes remain pending; customers can request and select fresh routes to apply the new rule.
- New customer bookings cannot submit delivery charges, toll charges, discounts, or add-on totals. Customer discounts/add-ons are zero in this flow. Existing recorded amounts remain intact.

## Customer flow

1. Select the vehicle, rental dates/time, Driver option, pickup option, and trip coverage.
2. For paid delivery, use authenticated street-address Google Places autocomplete and coordinate details, then confirm or correct the complete delivery address and its point on a Google Map. Pin movement invalidates the route/quote and clears the original Place ID.
3. Laravel asks Google Routes for available alternatives using `DRIVE`, `TRAFFIC_UNAWARE`, and toll computation. No straight-line estimate or synthetic suggestion can produce a quote.
4. The mobile app shows each returned route's driving distance, indicative duration, delivery charge, toll status, and map preview. Google may return only one route.
5. Selecting a new route replaces other unconsumed quotes for the same vehicle and rental schedule. Select a server-issued route offer while it is valid (15 minutes). A route without Google toll information issues a complete quote with PHP 0 toll. A Google-reported toll route creates a separate staff review request, **without a booking, reservation, or payment**. Older uncertain quotes still need review or replacement with a fresh route selection.
6. Staff review appears in Booking Management for personnel with `manage bookings`. The route is freshly retrieved and checked against its selection fingerprint. If that route is no longer available, staff reject the request and the customer selects a new route; prices are not silently recalculated.
7. Staff approve a manually verified toll amount (including zero) or reject with a reason. The customer receives an in-app notification and can resume from **Your Delivery Requests** on the vehicle's booking form. Waiting screens refresh status every 15 seconds and also offer manual refresh.
8. A complete quote is valid for **15 minutes from issuance/approval**. Changing the vehicle, schedule, coverage, address, point, or route requires a new quote. A pending request remains reviewable while its coordinates are available (up to 30 days); coordinate expiry requires fresh location/route selection, not automatic approval.
9. Laravel rechecks booking eligibility and vehicle availability and consumes the quote atomically when the pending booking/PayPal checkout is created. Duplicate use, foreign ownership, mismatched details, rejected/unapproved quotes, and expired quotes are rejected.
10. The accepted delivery and delivery-toll amounts stay fixed for checkout, capture retries, and later balance payments. Additional toll caused by a driver detour is borne by Jamjade; a lower actual toll does not reduce the quote. A payment attempt against an expired quote must restart route selection unless a checkout has already been created.

## Admin settings

**Management → Delivery Pricing** is admin-only, enforced in Laravel as well as navigation. Staff may review toll requests but may not edit pricing.

The form configures minimum fee, included kilometres, per-km rate, and customer-independent garage address/coordinates, and previews a 5 km fee. Money accepts up to two decimal places, included distance up to three. Changes save an activity entry with actor and before/after values. They affect new quotes only; valid quotes and accepted bookings retain their financial snapshots, including the vehicle rate quoted at that time.

Fresh installations leave garage coordinates unset. The confirmed garage address and pin were configured in the local development database on 2026-10-13. Configure the actual garage point for each environment. Garage pickup remains available while delivery maps/settings are unavailable.

## Contracts and storage

- `delivery_pricing_settings`: the singleton editable garage/pricing configuration.
- `delivery_quotes`: ownership, booking inputs, selected route fingerprint, pricing/vehicle-rate snapshot, monetary amounts, review decision/actor/time, validity, and one-time booking link.
- `bookings.delivery_toll_fee`: the accepted initial delivery toll, distinct from existing rental `toll_fee` additional charges. It is included in totals, PayPal amounts, customer/management pricing, confirmation documents, and reports.
- Booking resources expose `deliveryLocation` (confirmed customer address, optional Place ID, temporary point, and route label) for authorized customers, management, and the assigned Driver. Financial values remain hidden in assigned-Driver responses.
- `DeliveryRoutesRequest`, `UpdateDeliveryPricingRequest`, and `ReviewDeliveryQuoteRequest` define acceptance. Mobile `validation/booking/delivery.ts` and web `validations/delivery/schemas.ts` mirror client-verifiable rules. Ownership, availability, permissions, expiry, quote consumption, and route-provider state remain server-only rules.
- `StoreBookingRequest` and `CreatePayPalOrderRequest` accept `delivery_quote_id` only for delivery, allow garage pickup for With Driver, and prohibit customer price/discount overrides. Both frontends use their existing HTTP/service layers and auth flows.

API endpoints:

| Audience | Endpoint | Purpose |
| --- | --- | --- |
| Customer | `GET /api/mobile/delivery/places` / `place` | Authenticated autocomplete/details with a UUID billing session |
| Customer | `POST /api/mobile/delivery/routes` | Confirmed destination and bound booking inputs → route offers |
| Customer | `GET /api/mobile/delivery/quotes` / `{quote}` | Owned requests; paginated and optionally filtered by vehicle |
| Customer | `POST /api/mobile/delivery/quotes/{quote}/select` | Select a returned route; issue or request review |
| Management | `GET /admin/delivery-quotes` | Paginated active toll review queue |
| Management | `GET /admin/delivery-quotes/{quote}/route` | Fresh matching route preview; no retained geometry |
| Management | `POST /admin/delivery-quotes/{quote}/review` | Approve a verified toll amount or reject |
| Admin only | `GET` / `PUT /admin/delivery-pricing` | Read/save the garage and pricing configuration |

## Google configuration and retention

Backend `.env`: set a **server-only** `GOOGLE_MAPS_SERVER_KEY` with Places API (New) and Routes API enabled, appropriate server restrictions, and billing. Never put this key in `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*`.

Mobile `.env.local`: use independently restricted `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` and `EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY`. Enable the platform SDKs; restrict Android to package/signing SHA-1 and iOS to its bundle identifier. `app.config.ts` extends the existing Expo config. `react-native-maps` is installed at the Expo SDK 54-compatible version 1.20.1. Native configuration changes require rebuilding a development client; verify Google-provider rendering on both platforms. Delivery pin selection does not request device GPS permission or collect trip telemetry.

Web: the existing restricted `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` supplies Maps JavaScript API previews. A shared loader supports both the existing geofence editor and delivery review map. Geofences remain separate from delivery pricing.

Provider geometry, driving metres, duration, and toll estimates are returned only for immediate display/verification and are never written to permanent storage. A one-way fingerprint identifies the selected route. Quoted monetary amounts and staff approval history remain stable. Coordinates are encrypted and unavailable in resources at expiry; the scheduled hourly retention job physically removes expired point data and cleans up old unselected offers. Run Laravel's scheduler; `php artisan delivery:purge-provider-data` is also available for an explicit cleanup check. Place IDs can be retained; the customer's confirmed complete street address is kept solely for their delivery transaction. Do not retain autocomplete result lists, POI/business metadata, route geometry, or raw provider response bodies.

The address exception applies to a complete street address the end user could provide themselves, selected/corrected for their own transaction; it does not extend to arbitrary POI metadata. Confirm the applicable Maps agreement and publish appropriate Terms/Privacy links before production use. See [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies), [Routes policies](https://developers.google.com/maps/documentation/routes/policies), [service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms), and [Expo SDK 54 maps documentation](https://docs.expo.dev/versions/v54.0.0/sdk/map-view/).

After point expiry, a saved booking keeps its financial amounts and customer address. Its map link uses the address/Place ID, and the operator must reconfirm the delivery point before a future trip. The app does not silently substitute fresh coordinates into an accepted booking or change its price.

## Verification and development rollout

The forward migration adds two delivery tables and one booking amount column; no reset or historical rewrite is required. Automated tests cover road-distance pricing and rounding, alternatives, all toll review paths, expiry, ownership, changed inputs, one-time consumption, settings snapshots/audit, client override rejection, unavailable providers, and existing payment/lifecycle regressions.

Live Google responses and device rendering depend on configured keys and the actual garage point. Automated provider tests use explicit HTTP fakes, not a production fallback. Native map/GPS behavior and authenticated browser smoke checks must be reported separately from lint/type/build results.

Development verification on 2026-10-13: the forward migration applied successfully; all 298 backend tests passed (1,686 assertions), PHP formatting passed, and both frontend lint/TypeScript checks passed. Expo dependency and public configuration checks passed. The production web build passed after retrying with network access because its existing Google Fonts dependency could not be fetched in the restricted environment.

The web UI follows current Management page headers/cards and the shared `FormDialogLayout` review dialog. Contract comparisons covered `UpdateDeliveryPricingRequest` ↔ `deliveryPricingSchema`, `ReviewDeliveryQuoteRequest` ↔ `deliveryReviewSchema`, and `DeliveryRoutesRequest` ↔ mobile `deliveryRoutesSchema`; permissions, ownership, live availability, provider state, and quote validity/consumption intentionally remain server-authoritative.

Local integration verification on 2026-10-13: all four Maps keys were supplied through ignored environment files. Live server requests passed Places (New) street-address search, coordinate lookup, and Google Routes driving directions from the configured garage. The returned short route produced the expected PHP 150 minimum delivery fee; toll amounts remain subject to manual approval. Expo SDK 54 prebuild configuration resolved both native platform keys. A non-clean `expo prebuild --no-install` reused the ignored native projects and applied Android Maps metadata, iOS Google Maps initialization, and the iOS Google Maps pod configuration. Dependency compatibility checks passed. The public-config command omits native `ios.config` and `android.config` fields, so it cannot verify those keys.

Authenticated browser smoke checks passed the Delivery Pricing settings load, invalid-price feedback, save with the agreed rates, and authenticated admin audit entry. The pricing form fit a 390 px viewport without horizontal overflow. Booking Management loaded both the empty and populated delivery review queue. The selected delivery route preview rendered live Google tiles, distance, and duration, and an approval attempt without a verified toll amount showed field validation and a toast. The queue pickup display was corrected to preserve the entered booking wall time, matching the existing booking table rather than adding the browser's timezone offset. Live Google tiles and the existing zone overlay also rendered through the shared web Maps loader. The test quote remains pending; no unverified toll amount was approved, booking created, or payment taken. Successful live staff approval and the customer's subsequent approved-quote checkout remain unverified; automated backend tests cover those transitions.

Android verification on 2026-10-13: the Google Play ARM64 Android 16 / API 36.1 emulator image installed after the user completed the SDK license step. The ARM64 debug APK built successfully and its packaged Maps metadata matched the locally configured Android key without exposing it. Expo Doctor passed all 18 checks. The development client installed and launched in Android Studio's embedded emulator and connected to Metro and the local backend through port forwarding. After the user's normal customer sign-in, live Places address suggestions, Google map tiles, the confirmed delivery pin, and the selected route polyline rendered. The public Tanza Municipal Hall destination returned one 4.94 km / 13 minute route priced at PHP 249. Selecting that route created a pending staff toll request visible in the authenticated admin queue. Attempting Review Booking while pending showed an inline quote error and toast, preserving the approval requirement. Self-drive offered only free garage pickup/return; the with-driver coverage choices showed the existing PHP 700 / PHP 1,000 daily driver fees separately from delivery. This emulator check does not establish physical-device GPS or telematics readiness.

After the updated no-toll business rule on 2026-10-13, the same Android destination was requoted and displayed as toll-free. Selecting it immediately showed a complete quote with PHP 249 delivery, PHP 0 toll, and a 15-minute validity period. The customer reached Review Booking without staff approval, and the old uncertain request was superseded. No booking was submitted or payment taken. Targeted delivery tests passed (21 tests, 155 assertions), the full backend suite passed (317 tests, 1,797 assertions), and PHP formatting passed. The existing mobile and web contracts already handle `toll_free` / `ready`, so no frontend contract or validation changes were needed. The later admin queue refresh could not be checked because the web session had expired and returned to Login; regression tests confirmed that no-toll selection creates no awaiting-review request.

iOS builds, pod installation, and map rendering are deferred at the user's request while Android verification continues. These are separate from successful server integration, authenticated web checks, and Android build/startup checks.
