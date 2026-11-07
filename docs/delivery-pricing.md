# Delivery pricing and location flow

Updated 2026-10-17 for the approved automatic estimate and deferred-toll policy. Laravel owns accepted prices; inspection, assignment, release, payment and return-charge sequencing stay unchanged.

## Business rules

- Self Drive uses free pickup and return at Jamjade Garage; delivery is unavailable.
- With Driver (`owners_driver`) offers free garage pickup/return or paid delivery. Delivery and end trip use the same address. This is one garage-to-destination delivery fee, not a separate collection service.
- The existing daily Driver fee remains PHP 700 within Metro Manila or PHP 1,000 outside, multiplied by rental days. Coverage is selected independently of the delivery estimate.
- Default delivery pricing is PHP 150 for the first 1 km plus PHP 25 per excess km. Calculate from unrounded road metres, then round half up to a whole peso: `round(minimum + max(0, metres / 1000 - included_km) * rate)`.
- No maximum service distance is imposed. Existing database/payment precision limits still apply.
- Laravel compares all returned Google driving estimates by duration, then distance for equal durations. It uses the quickest returned estimate regardless of tolls. This does not guarantee every possible road or future travel time.
- New delivery quotes have **zero upfront toll**. Before booking, customers see: “Actual tolls, if incurred, are billed after the rental.” Staff record actual tolls using the existing `toll_fee` Additional Charge after finalized Incoming Inspection and before finalizing return charges. Responsibility is selected explicitly for With Driver bookings. Assigned Drivers cannot create their own charges.
- Customer-supplied prices, toll totals, discounts and add-ons remain prohibited. Accepted delivery prices stay fixed for checkout/capture retries and balance payments.

## Customer flow

1. Complete Rental Schedule, Driver option, pickup option and coverage using the existing booking form.
2. Search and select an address through authenticated Google Places. The result supplies the address and fixed point. The map allows pan/zoom, with no route line and no destination changes from taps or marker dragging. Delivery does not request device GPS permissions.
3. Add an optional Note (up to 2,000 characters), separate from the map-selected address.
4. **Confirm Location** validates the schedule and selected point. Laravel asks Google Routes for `DRIVE`, `TRAFFIC_AWARE` alternatives internally, selects one estimate, and issues a complete ready quote in the same operation. Provider failures/incomplete metrics produce no partial quote.
5. The location card becomes read-only: address, pin map, Note when present, kilometres, approximate minutes, delivery fee and toll notice. The quote countdown is hidden. **Change details** unlocks editing and invalidates the accepted quote.
6. Price Breakdown and Review Booking appear only for complete, valid details, available dates and a matching ready quote that has not expired. The server retains its 15-minute validity check without a visible timer. If it expires, **Reconfirm Location** refreshes the price with the current pin and Note. A quote is not a booking, reservation or payment.
7. Changes to vehicle, schedule, coverage or address require fresh confirmation. Schedule edits preserve the selected address, point and Note. Stale asynchronous responses are ignored. Feedback uses the booking screen toast, outside the card and scroll view.
8. Laravel rechecks eligibility, ownership, vehicle availability, exact booking context and expiry, then consumes the quote once inside the booking transaction. A second use is rejected.
9. Booking details show a pin-only map, Note and **current** distance/time estimate beside the **agreed** delivery fee. Estimate failures offer retry and do not block access to accepted booking information or change its price.

The mobile app does not list, restore or resume saved delivery requests. Starting a new booking flow requires fresh location confirmation. Old quote notification actions open a fresh vehicle booking form, without restoring a quote, schedule or destination. Existing financial records are retained; legacy quotes still cannot be consumed under the new policy. New staff toll-review notifications are no longer generated.

## Driver and staff flow

The assigned Driver receives the confirmed destination and Note and can use **Navigate in Google Maps**. External navigation may use a different route as conditions change; it never silently reprices the booking. No embedded route picker or route history is introduced.

The web Toll Reviews queue, review map/form, actions, endpoints and navigation counts have been removed. Existing review history stays in the database. Management retains delivery details and the generic Toll Fee additional-charge option. Booking counts now cover due unstarted pickups only.

## Admin settings

Management → Fee Pricing is Admin-only. One card groups late-return rates and delivery pricing under separate labels. Fields start disabled; Configure enables editing and replaces that action with Save and Cancel. Cancel restores the last confirmed values. All five fields validate before either existing endpoint is called; the card locks again after confirmed saves. Delivery updates change only minimum fee, included kilometres and per-km rate, preserving the configured backend garage address/coordinates, including an unset point. The update API still validates optional garage fields if explicitly supplied. Changes are audited and affect only new quotes. Fresh environments must configure their actual garage point before delivery quotes are available.

The pricing form uses decimal-only input with no exponent, hexadecimal, sign or grouping-separator notation. Money allows two decimal places and included kilometres allow three; required, minimum and maximum rules mirror the existing Laravel requests. The shared pricing Zod schema supplies the existing delivery and late-return pricing schemas. Backend validation remains authoritative. Existing save endpoints remain separate: a partial failure keeps confirmed settings, retains failed edits and field errors, and retries only changed groups. Cancel restores confirmed values rather than undoing a successful request; after a failed save it refreshes both settings, covering a response lost after the server committed.

Pricing UI verification on 2026-11-06: web lint, TypeScript, production build and
12 focused form/schema checks passed. Cases cover locked/configure/cancel states,
decimal input and bounds, validation before either update, field-specific 422
errors, partial-save retry/cancel, lost responses, duplicate submission and denied
loads. Requests use in-memory test services; real settings were not changed during
verification. Browser visual checks remain pending because local browser use is
disabled in Work settings.

## Contracts and storage

- `DeliveryRoutesRequest` and mobile `validation/booking/delivery.ts` mirror the confirmation payload: vehicle, future start, later end, coverage, address (255), optional Place ID (255), latitude/longitude ranges and accepted point confirmation. Existence, ownership, availability, expiry and consumption remain server rules.
- `StoreBookingRequest` and `CreatePayPalOrderRequest` retain `delivery_quote_id`, `notes` and reviewed-pricing contracts. Current mobile terms version is `2026-10-19-v4`; v2, v3 and v4 require reviewed pricing through both endpoints. Version 4 also includes the With Assigned Driver latest-location disclosure; see [booking lifecycle](booking-rental-lifecycle.md).
- New `delivery_quotes.pricing_snapshot.policy_version` is `2026-10-17-deferred-tolls`. New quotes are ready immediately with `delivery_toll_fee=0`; legacy fields/records stay for history. Legacy unconsumed quotes cannot create new bookings.
- `bookings.delivery_toll_fee` remains a historical accepted amount. Existing nonzero amounts remain visible in financial summaries and documents. Generic return `toll_fee` charges remain distinct.
- Versioned terms preserve v2 cancellation/payment/self-drive terms and its original delivery wording. Version 3 introduced deferred actual toll disclosure; version 4 adds the With Assigned Driver telematics disclosure. Existing signed snapshots and retained PDFs are unchanged.
- Booking resources retain authorized `deliveryLocation` address, optional Place ID and temporary point. Assigned-Driver responses continue hiding customer financial amounts.

| Audience | Endpoint | Purpose |
| --- | --- | --- |
| Customer | `GET /api/mobile/delivery/places` / `place` | Address suggestions and resolution with UUID session |
| Customer | `POST /api/mobile/delivery/quotes` | Confirm location and return one ready quote plus transient distance/time |
| Customer | `GET /api/mobile/delivery/quotes` / `{quote}` | Retained owned quote reads; not used by the mobile booking flow |
| Customer | `GET /api/mobile/delivery/quotes/{quote}/estimate` | Retained owned point estimate; not used to resume mobile bookings |
| Customer | `GET /api/mobile/bookings/{booking}/delivery-estimate` | Fresh estimate for an owned booking; no repricing |
| Admin | `GET` / `PUT /admin/delivery-pricing` | Existing pricing configuration |

The old customer `/delivery/routes` and quote `/select` endpoints and management `/delivery-quotes` review endpoints are removed. All affected clients are updated together.

## Google configuration and retention

Laravel uses server-only `GOOGLE_MAPS_SERVER_KEY` with Places API (New), Routes API, billing and appropriate restrictions. Mobile uses separate restricted `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` and `EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY`, Expo SDK 54 and `react-native-maps` 1.20.1. Native key/configuration changes require a new development build. This change adds no packages or native configuration. Web Maps consumers continue using the singleton `src/lib/google-maps.ts`; no new loader is introduced.

Provider distance and duration are transient. Geometry and toll estimates are no longer requested. Do not persist route responses, metrics, autocomplete lists or POI metadata. The database stores financial snapshots, a non-reconstructable fingerprint and encrypted point for at most 30 days. Resources hide expired points, and the hourly `delivery:purge-provider-data` job removes them. Place IDs and the customer-selected transaction address remain. Run Laravel's scheduler.

After point expiry, show the accepted address and existing Google Maps address/Place ID link; reconfirm the point before delivery. Do not silently replace accepted coordinates or prices. Fresh metrics use the original garage snapshot. Published provider terms and privacy links remain a production requirement: [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies), [Routes policies](https://developers.google.com/maps/documentation/routes/policies), [Maps service terms](https://cloud.google.com/maps-platform/terms/maps-service-terms).

## Verification boundary

Automated provider cases use explicit HTTP fakes, never a production fallback. Relevant checks cover fastest-duration selection, tie-breaking, fractional duration, unrounded-distance pricing, malformed/unavailable routes, expired/foreign/mismatched quotes, one-use consumption, immutable accepted amounts, legacy reconfirmation, terms preservation, pricing permissions and removed review counts/endpoints.

UI precedent is the current BookingForm location card, shared location search/InputWithLabel, primary action styling, booking SectionCard/PricingBreakdown and existing map presentation. The pin map is shared between confirmation and booking details. Pricing validation remains `UpdateDeliveryPricingRequest` ↔ `deliveryPricingSchema`. No new financial form or charge-timing exception was introduced.

Historical checks from October 13–16 covered the former route-selection/review flow and do not verify this replacement. Current check results and Android/iOS limitations must be recorded separately after running them.

Verification on 2026-10-17: all 519 backend tests passed (2,889 assertions) with the test process memory limit increased to 512 MB; the default 128 MB process exhausted memory during the full suite. PHP formatting, both frontend lint/TypeScript checks, four mobile quote-readiness regression checks and the production web build passed. No production PHP configuration was changed for the test run.

The connected Redmi Android development client exercised the real Places and Routes flow using a public test destination. Missing pickup time produced the schedule error and screen-level toast. Confirmation returned one ready PHP 249 quote with zero upfront toll, a fixed pin and no polyline; the card became read-only and Price Breakdown appeared. A pickup-time change preserved address/point/Note, invalidated the quote and hid Price Breakdown. Simulated 422 and service-failure responses exercised field feedback, one screen-level toast and retry. A delayed real response was ignored after the schedule changed. An existing booking loaded the new pin map and fresh metrics. The original form values/network function were restored, temporary debug references removed, and exactly the two unconsumed test quotes removed; no booking, payment or staff notification was created.

Authenticated web visual verification was blocked by the expired browser session; the page redirected to Login. Driver navigation launch, small-phone/tablet layouts and iOS rendering remain unverified; this Mac has no available iOS simulator tooling. The Android check does not establish those platform results.

Follow-up on 2026-10-17: removed the mobile quote countdown, Your Delivery Requests card, saved-request service calls and quote-restoration URL handling. Expiry still gates review/payment; Reconfirm Location refreshes an expired price without forcing address/Note re-entry. Old delivery notification actions now start a fresh booking form. No backend expiry, accepted price or persisted financial record was changed.

Follow-up verification: mobile lint, TypeScript and the three remaining quote-readiness checks passed. A read-only inspection of the mounted Android BookingForm confirmed zero saved-request cards and zero quote countdown labels. No booking data was changed. Reconfirmation after expiry and iOS UI were not exercised on-device in this follow-up.
