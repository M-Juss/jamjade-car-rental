# Mobile notifications

Booking Activity — 2026-10-19: [the Telematics drawer](telematics-mobile-dashboard.md) reuses these notifications with optional `booking_code` filtering and cursor-response `meta.booking_unread_count`. Account scoping, global unread totals and the existing read endpoint are preserved. GPS lifecycle transitions and enabled, server-confirmed zone crossings create in-app records; no phone push delivery or per-point notifications are added. Since 2026-10-19, named zone alerts use category `trip` and `view_telematics_activity`, with the same ownership, booking filter, unread counts and read endpoints. Disabled directions remain website activity only. See [geofence monitoring](geofence-monitoring.md). GPS/release shortcuts open the selected rental's Activity tab, including read-only ended-rental history.

Customer and assigned-Driver Notifications use the same feed and pagination behavior. Entering the tab or refreshing fetches the latest 10 records. If older records exist, **View all notifications** appends five and enables loading five older records when the user scrolls near the bottom. The current cards remain visible during older-page loading or an error; an inline Retry repeats the failed continuation. Reaching the end stops further requests. Refresh resets the preview and scroll position.

## API contract

- `GET /api/mobile/notifications?pagination=cursor&per_page=10` returns the initial preview.
- Subsequent requests pass `pagination=cursor&per_page=5&cursor=...`. Laravel orders by `created_at DESC, id DESC`; changing the page size or receiving a new notification does not shift the continuation. The cursor is validated, and every query remains scoped to the authenticated account.
- Cursor responses retain the established envelope and Notification Resource. Metadata contains `next_cursor` (string or null), `has_more` (boolean), and `unread_count` (integer for the entire account).
- `GET /api/mobile/notifications/unread-count` returns `data.unreadCount` without downloading records. The tab bar uses this endpoint. Listing and counting require the Customer or Driver role.
- Existing read and read-all endpoints additionally return `meta.unread_count`. Read-all covers unloaded notifications, and reading one item remains ownership-authorized.
- Existing page-number pagination is preserved for installed mobile builds that request it. Updated clients explicitly opt into cursor pagination and do not fetch the full history.

The mobile service owns request and response mapping. The shared hook rejects stale responses after refresh, tab changes, or account changes; prevents overlapping older-page requests; merges by notification ID; and preserves successful read actions. Unread state resets at session transitions. Badge count requests cannot overwrite a newer successful read response. The feed uses a virtualized list and the existing card/detail presentation.

## Verification — 2026-10-16

Backend notification tests cover both mobile roles, account isolation, 10-to-5 continuation, tied timestamps, new arrivals, malformed cursors, empty/short/exactly-10 history, global unread counts, and reading unloaded records. The full backend suite passed with 472 tests and 2,745 assertions using an increased test-process memory limit for the existing PDF tests. PHP formatting passed.

An isolated temporary UI harness with synthetic records verified the initial 10, five-item continuation, final partial batch, retry without discarding cards, overlapping-load prevention, refresh discarding a delayed response, read-all including unloaded records, and empty/exactly-10 states. On the connected physical Android phone, actual scroll gestures verified 10 records before expansion, then 15, 20, and 23 with no further requests after the end. The normal Notifications screen was also checked with its existing records. No real notifications were created or marked read by these tests; temporary harness files were removed. Physical iOS verification remains pending.
