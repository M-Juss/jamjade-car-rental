# Late returns and booking attention

Implemented in code on 2026-10-15. Laravel owns timing, pricing, authorization, review, and completion. This feature does not change initial daily rental pricing or introduce rental extensions.

## Pricing Settings

The existing admin pricing page `/admin/delivery-pricing` is labeled **Fee Pricing**, with Late return rates and Delivery pricing in one card, separated by labels and a divider. Fields start disabled; the upper-right Configure action enables editing and shows Save and Cancel. All five numeric fields validate before save requests; successful confirmed saves lock the card, while Cancel restores the last confirmed values. The two existing endpoints remain independent, with failed edits and validation errors retained on partial failure and unchanged groups skipped on retry. Delivery pricing contains only the minimum delivery fee, included distance, and additional per-kilometre rate. Garage address and coordinates remain backend configuration and are neither displayed nor submitted by this screen. Field validation and error feedback remain visible. Only Admin may read or change late-return pricing through `GET/PUT /admin/late-return-pricing`. The two initial rates are PHP 200/hour for recorded vehicle capacities of 5 seats or fewer and PHP 300/hour for 6 seats or more. Seat capacity is the vehicle's stored total capacity, not the number of passengers on a particular trip.

A new booking saves its selected seat bracket, seat capacity, hourly rate, minimum-hour and rounding policy in `booking_terms.late_return_policy`. These accepted policy snapshots are immutable. New settings or vehicle seat edits affect future agreements only.

The mobile vehicle resource supplies `lateReturnPolicy`. Customer terms display that vehicle's current rate. Both ordinary booking creation and PayPal order creation require `late_return_policy_version` (64 characters). Laravel checks the accepted version against the current selected vehicle policy before creating the booking; a stale version returns a field-specific 422 and the customer must restart and review the terms. Once the booking is created, its accepted policy remains fixed through payment and confirmation. The confirmation PDF uses the saved policy.

Existing bookings are not backfilled with current prices or guessed receipt times. If no accepted policy exists, the estimate is unavailable and Staff must review the original agreement, enter the approved amount, and explain the legacy pricing. Existing late-charge records are reviewed without being duplicated or changing their payment history.

## Calculation

Only an ongoing released rental or one with recorded physical receipt can have late hours. A confirmed booking that never started incurs no automatic late charge.

- Compare the agreed `rental_end_at` with physical receipt time, or current server time while the vehicle is still out.
- An on-time return has zero billable hours.
- Any positive delay has a minimum charge of one hour.
- After the first hour, each complete hour counts, and a remaining fraction adds another hour only when it exceeds 30 minutes.
- Exactly 30 remaining minutes does not round up. At 1h 30m the charge is one hour; at 1h 30m 1s it is two.
- Long delays continue hourly without a daily conversion.
- The estimated amount is billable hours multiplied by the saved hourly rate. It is separate from payable balance and collected revenue until Staff approves a charge.

All display and staff time-entry labels use Asia/Manila. Offset timestamps are normalized to UTC for persistence. Financial precision and amount limits follow the existing additional-charge contract.

## Return workflow

1. **Record Vehicle Received**: authorized Staff records the actual physical receipt time, which must fall between rental release and current server time. Receipt does not mark Returned or make the vehicle available. The recorded time and actor cannot be overwritten; identical retries are safe.
2. **Incoming Inspection**: existing inspection, signature, and active-trip requirements still apply. Receipt is now required before beginning Incoming.
3. **Review Late Return Charge**, when there are late hours: Staff approves the proposed amount or records a reason for a waiver/adjustment. Legacy manual pricing also requires a reason. Self Drive charges remain Customer responsibility; assigned-Driver bookings retain the existing explicit responsibility choice. The reviewed result is immutable. On-time receipt cannot produce a positive late charge.
4. **Finalize Charges & Mark Returned**: staff reviews other charges in the existing form, then confirms one action that locks the review and marks the booking Returned in the same transaction. The generic charge endpoint cannot create a `late_return` charge. Laravel requires recorded received time, finalized Incoming Inspection and, when late, a completed late-charge review. Returning releases only the rental restriction; maintenance and manual restrictions remain authoritative. Customer payment does not gate this action.
5. **Complete Booking**: existing finalized-return and Customer settlement requirements apply. Driver debt remains separate. Completion is explicit, never time-driven.

Combined return — 2026-10-18: management submits `POST /admin/bookings/{booking}/finalize-return` with an empty body through the existing `BookingStatusRequest` authorization and optional status-note rules. This replaces the web-only `/finalize-return-charges` and `/returned` action endpoints. `BookingService::finalizeReturn` locks the booking and reuses the existing review/return services under one outer transaction; a failed return rolls back charge finalization, status, vehicle effects, audit records and notifications. Existing ongoing bookings with a finalized review can finish without re-finalizing it. Identical retries after a recorded Returned/Completed result do not duplicate events or notifications. The existing Resource shape, Customer balance and Driver responsibility contracts are unchanged. Mobile has no management return mutation and continues to read the same Returned/Completed states.

Return-charge editing — 2026-10-17: authorized management users may edit or delete an individual ordinary charge after Incoming Inspection while the return-charge review remains open. `PUT /admin/bookings/{booking}/additional-charges/{charge}` accepts the existing `charges` payload with exactly one entry; `DELETE` removes that scoped charge. Laravel rejects charges belonging to another booking, reviewed late-return charges, finalized/non-ongoing returns, any charge with payment-allocation history, and changes while an outstanding-balance checkout is open. Changes recalculate Customer totals/balances in the booking transaction, preserve Driver responsibility, record audit events, and create in-app notices for affected users. Checkout reservation uses the same booking lock and rechecks the current amount/charge set before contacting the provider. Existing payment documents and completed settlements remain unchanged. Mobile remains read-only for these management mutations and continues to consume the existing charge resource.

The web review presents one card per charge with type, amount, and eligible Edit/Delete actions, followed by Total Charges across both responsibilities. Deletion requires confirmation. Empty reviews show “No return charge.” Descriptions, responsibility, and payment state remain stored and available to the payment/customer flows. Inspection comments span the row above matching personnel/operator signature cards; private signature assets remain private.

Late review locks the booking and rechecks all conditions before recording the charge, review, balance, and activity in a transaction. Repeated review cannot create another charge. Physical receipt freezes late hours even if inspection or settlement finishes later. Staff can save contact outcomes and an optional expected return time while the vehicle is still out; these are management-only history. Expected return does not change the contract deadline or authorize an extension.

A confirmed booking whose schedule has ended is flagged **Not Started — Schedule Ended**. Staff investigates the customer and release records. If no release occurred, **Resolve Missed Start** records findings and offers either a no-show (all rental payments retained) or ordinary cancellation (separate Admin refund review). Both explicitly cancel the booking; neither itself returns money or creates late charges. A tentative pickup time has no grace countdown; the whole reserved interval must end before no-show classification. Start Rental rejects an expired scheduled period. An unresolved ongoing rental blocks another release of the same vehicle even if the editable vehicle status was changed to Available.

## Dashboard and booking module

The booking status remains independent from attention state:

| Condition | Attention |
| --- | --- |
| Ongoing, deadline passed, no physical receipt | Return Overdue |
| Confirmed, scheduled period ended | Not Started — Schedule Ended |
| Ongoing with receipt, processing unfinished | Return Processing Pending |
| Returned with outstanding Customer balance/charges | Awaiting Settlement |
| Returned with Customer obligations settled | Ready to Complete |

Dashboard summary cards show Month Revenue, Confirmed Bookings, Active Rentals, and Today’s Pickups. Overdue Returns and Bookings Requiring Action summary cards are omitted; the action panel still shows unresolved bookings and its total. At desktop widths, the rental calendar and a compact Bookings Requiring Action panel appear side by side, with attention on the right; smaller screens stack the panel below the calendar. Attention rows show the booking reference, vehicle, short attention state, overdue duration when applicable, and an upcoming pickup warning when relevant. Each row links to booking details, where full customer, schedule, and follow-up information remains available. The scrollable attention queue is independent of the calendar date range and bounded to 30 rows. View All opens the booking attention filter. Overdue rentals affecting a confirmed pickup in the next 24 hours are prioritized. Upcoming pickups within 24 hours or the recorded expected return are highlighted; future bookings are not automatically cancelled. Calendar entries retain scheduled dates and display only the booking reference, including in their tooltips; clicking an entry opens the existing rental details.

Booking Management adds attention filters and overdue/attention totals. Desktop rows and mobile cards show one booking-stage badge with a short supporting line for overdue returns, ended schedules, return processing, or readiness to complete. Awaiting Settlement is omitted from this compact status display because the separate Payment status communicates the outstanding payment; the full attention state remains in filters and booking details. Status text stacks vertically and may wrap without overlapping Payment. Details show agreed pricing, billable hours, estimates or approved charges, receipt time, follow-up history, and upcoming pickup warnings. Process Return resumes the next authoritative saved step. List/dashboard data refreshes once per minute; booking details and existing setup/settlement waiting views use their existing refresh behavior. Forms retain their unsaved values while open.

Only users with `manage bookings` receive the actionable dashboard queue. Customer resources expose their own sanitized attention/pricing details; staff follow-up notes, related customers' bookings, and review internals stay private. Approved charge amounts on Customer screens come from the responsible-user-scoped charge resource, so a Driver-responsible amount is not leaked through the return summary. Driver resources do not expose Customer pricing or balances.

## Reminder operation

`process-rental-return-deadlines` is scheduled every minute with overlap prevention:

- An ongoing rental due within two hours receives one in-app return reminder for its Customer and assigned Driver.
- After the deadline, it receives one overdue notification for those recipients and active Admin/Staff users with booking permission.
- Booking locking and recorded notification events prevent duplicate sends; received or non-ongoing bookings are skipped.
- Notification processing does not charge, cancel, return, or complete a booking.

Run Laravel's scheduler in deployment. For local development, run `php artisan schedule:work` in a separate terminal; verify registration with `php artisan schedule:list`. These are application notifications, not email/SMS or a live telemetry feed.

## Verification

Regression coverage includes the one-hour minimum, strict 30-minute boundary, seat brackets, long delays, price snapshots, offset receipt timestamps, safe receipt retries, invalid/stale operations, waivers, legacy review, duplicate-charge prevention, permission/privacy boundaries, missed starts, calendar-independent attention, and once-only reminders. Web/mobile lint and type checks plus a web production build cover the changed client contracts. Physical iOS/Android and live payment/provider checks remain separate evidence; this change introduces no native-facing dependencies or configuration.

Verification record — 2026-10-15: `composer test` passed 355 tests; repository-wide `vendor/bin/pint --test` passed; web and mobile lint/type checks passed; the final web production build passed. Synthetic browser checks covered the dashboard, booking details, receipt form, and Pricing Settings at small-screen and laptop widths. The calendar retains a 540 px minimum desktop height with page scrolling. The additive migration was applied to the local development database; historical bookings were not rewritten. Reminder registration was confirmed with `schedule:list` using an ephemeral array cache for the diagnostic. No production rollout, physical iOS/Android run, or live PayPal checkout was performed.
