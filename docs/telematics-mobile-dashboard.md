# Mobile Telematics drawer

Approved and implemented in code on 2026-10-19. Physical Android/iOS verification remains pending. This increment changes the mobile presentation, adds explicit preparation for automatic GPS startup after staff release, and reuses in-app notifications for booking activity. Rental collection remains latest GPS only; route history, rental motion streams, classifications and phone push notifications are outside this increment.

## Screen and navigation

The Customer Telematics tab remains the Self Drive rental list. An assigned Driver opens a Confirmed or Ongoing With Assigned Driver rental from Services using **Open vehicle setup** or **Open Telematics**. Both entry points open the same protected booking-specific drawer outside bottom-tab navigation. Back and Refresh remain above the content without a logo header or the main navigation bar.

Three equal drawer tabs select Full details, Device setup and Activity. The shared header shows the concatenated vehicle name, booking reference, compact Rental date/Return values on one row and the booking vehicle's second ordered gallery image, falling back to its first image. The image column stretches to the text column's height. Dates use Asia/Manila internally without visible timezone suffixes.

For With Assigned Driver rentals, the owning Customer's active booking details show a **Vehicle location** map only when the assigned Driver has accepted the current location-consent version and a retained latest point is available. The card shows when that point was last shared and refreshes while booking details are focused. It disappears when sharing expires, the trip ends, or staff receives the vehicle. The Customer endpoint returns no route history, session token or motion data.

Before release the drawer is expanded below the navigation controls. On release it collapses to reveal the map. Scrolling into a panel expands it; pulling down at the top or selecting the handle/Map action reveals the map. Each tab retains its reading position while expanded; explicitly revealing the map returns the current tab to its top. The map stays mounted while hidden. Its visible viewport ends above the collapsed drawer so Google attribution is not covered. Small screens scroll, landscape respects horizontal insets, and content has clearance for floating actions and the bottom safe area.

Full details reuses `BookingDetailsContent` with the ordinary booking detail page: vehicle, schedule, locations, pricing, payment information, receipts, charges and timeline. Page navigation actions remain on the ordinary booking page. Details load through the selected owning-booking read, rather than downloading every booking.

Device setup contains two compact progress cards and Setup results. The six checks and five calibration exercises open inside safe-area dialogs with their existing disclosures, real evidence, server evaluation, success transitions and recovery. Busy captures prevent dismissal/navigation; the recording Stop action remains reachable. iOS waits for native disclosure dismissal before opening calibration or requesting setup permissions. No readiness or release threshold changes.

## Prepared GPS startup

The existing device-setup disclosure now offers explicit agreement to prepare background GPS or app-open-only GPS for this rental. It states the automatic staff-release trigger, latest-only data/access/retention, platform permissions/indicators, battery use, interruptions and Stop/recovery behavior. Continuing without automatic GPS still runs the existing device checks. OS permission or mount confirmation alone is never monitoring consent.

The accepted sharing mode is saved in secure device storage for the signed-in rental operator and consent version, so the location disclosure is not repeated for another rental, retry or resume. A changed consent version requires agreement again. The saved choice contains no location or session token and never starts collection by itself.

Preparation is still a one-use instruction held only in memory, bound to the signed-in operator, booking, handover start, calibration profile fingerprint and consent version. It can be cancelled before release. It expires when leaving the screen, changing account/context/terms, or losing the runtime. It starts no watcher, creates no trip and uploads no GPS before release.

While this screen is focused and foregrounded, a fresh server-confirmed release and monitoring eligibility read consume the preparation once. The existing monitoring session then rechecks server eligibility and native access and waits for a valid fresh GPS fix before its first upload. The release read currently polls every 15 seconds, with additional focus/foreground/manual refreshes; startup is not an instant remote wake-up guarantee. A closed/force-stopped app cannot be assumed to start collection.

Startup failure consumes the instruction. Manual Pause, permission/network/GPS interruption, sign-out and a fresh runtime never automatically resume a consumed session. Resuming an existing trip opens the Stationary check described below. Once running, the existing app-wide foreground/background lifecycle remains authoritative. Returning/receiving the vehicle disables monitoring; pausing GPS never ends the booking.

The floating action surface reuses the main-screen appearance for Pause, Start and Activity. Start stays disabled before release or when the server denies monitoring. Pause asks for confirmation. Prepared consent has a visible Cancel action in the monitoring status tag between Back and Refresh.

## Stationary check before resume

Approved 2026-10-19: resuming after Pause, an interruption, or runtime loss with an existing trip replaces the manual mount confirmation with a local Stationary check. Initial GPS startup does not require this extra check. The compact dialog asks the rental operator to keep the phone steady in its mount. A short disclosure explains that the motion check runs on this phone and readings are discarded afterward. **Start check** explicitly starts capture; opening the dialog starts no sensors. It reuses the existing bounded foreground DeviceMotion abstraction, Stationary visuals, server-projected capture duration, stability limits and quality settings. It requires current released-rental monitoring eligibility before capture and rechecks monitoring eligibility after a passing recording.

The full capture must meet coverage, sample rate, maximum-gap, gravity, acceleration, rotation, yaw and tilt checks. Unstable/incomplete readings fail with Retry; denied motion access offers device Settings. **Cancel check**, backgrounding, leaving the screen or changing account aborts capture and discards results. A passing result enables **Resume monitoring**, expires after 60 seconds and is consumed once. iOS finishes dismissing the check dialog before any GPS permission or consent dialog opens; the existing collector rechecks eligibility and permissions before collection.

This is local resume readiness, not a new server calibration result or proof of a physical mount. A new temporary gravity reference measures stability during this capture; it does not detect every remount or restore the learned forward direction. No setup attempt, trip calibration record, raw stream, motion summary upload, persistent baseline or activity event is created. Released setup results remain read-only, and continuous rental monitoring remains latest GPS only. Native sensor/permission/navigation behavior still needs physical Android/iOS verification.

## Map data

`TelematicsMap.native.tsx` uses the installed Google Maps provider and configured Android/iOS keys. `showsUserLocation` is disabled: mounting or revealing the map starts no extra location watcher. The marker uses only the existing consented collector's validated current fix, held in memory. Invalid fixes, Stop, interruptions and account reset remove it. A neutral map without a marker is not presented as the customer's saved location. No route polyline, location-history query or customer coordinate read endpoint is added. The web fallback does not claim a native map is running.

## Activity and contracts

- The mobile handover Resource adds `rentalEndAt` and `vehicle: { name, image, secondaryImage }`. Gallery reads use the owning booking, including rented vehicles; the public catalog endpoint is unchanged. Explicit owning Returned/Completed reads return `rental_ended` with read-only setup. Mutations remain limited to Confirmed/Ongoing; the initial rental list still excludes terminal bookings.
- `GET /mobile/notifications` accepts optional `booking_code` (string, maximum 100 characters). Both pagination modes retain account scoping. Cursor responses additionally include `meta.booking_unread_count`; `meta.unread_count` remains the account total. Unknown/other-account booking codes return no account-owned items, without disclosing another user's records.
- Activity uses those same notification IDs and existing ownership-authorized read endpoints. It polls while focused/foregrounded, indicates newer records without resetting an older reading position, supports bounded older-page loading and marks all unread records for the selected booking as read. Reading activity updates the shared account unread count and is reflected in the ordinary Notifications feed on its next read. Notification shortcuts open this booking's Activity tab, including ended rentals.
- GPS start/resume/pause/end transitions create in-app notifications transactionally with their existing trip events for the rental Customer and, on With Assigned Driver rentals, the current assigned Driver. Repeated starts or ordinary GPS uploads do not create notification spam. Staff release links its booking notification to the current operator's Activity. No push delivery or new event-history ingestion is added.
- The pause request adds optional `reason`, exactly `manual` or `interrupted`, mirrored by Zod and the mobile service. An authenticated active session may report an interruption using its current token. Offline delivery remains best effort: local recovery is visible immediately, but a killed/offline phone cannot guarantee a server pause or an in-app notification. No false historical interruption is fabricated.
- Activity exposes existing recipient notification fields only. Internal trip-event metadata, raw coordinates, session tokens, inspection evidence and other users' data are not added to the feed.

## Verification

The full backend suite passed 847 tests / 4,981 assertions with a temporary CLI-only 512 MB memory setting; PHP formatting passed. Coverage includes vehicle gallery ordering/fallback and rented visibility, read-only ended rentals, ownership, booking-scoped cursor pagination, shared read state, transition-only notifications, interruption validation and GPS privacy. Mobile lint, TypeScript, 155 focused Node checks, Android/iOS Hermes exports and Expo Doctor (18/18) passed during this increment.

Synthetic browser review uses actual screen/components with HTML/native adapters, placeholder map/image/icons and labeled demo data at 320/390/768 px. It does not verify native Google rendering, touch/scroll coordination, hardware Back, permission dialogs, sensors or background execution. No Android device was attached and iOS simulator tooling was unavailable; both native device smoke flows remain pending. No production data, native permission or real GPS session was changed during verification.
