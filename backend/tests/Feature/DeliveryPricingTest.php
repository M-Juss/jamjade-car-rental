<?php

use App\Models\Booking;
use App\Models\DeliveryPricingSetting;
use App\Models\DeliveryQuote;
use App\Models\User;
use App\Services\BookingConfirmationViewData;
use App\Services\BookingService;
use App\Services\DeliveryQuoteService;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);
beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    config(['delivery.google_key' => 'test-only-key']);
    DeliveryPricingSetting::current()->update(['garage_latitude' => 14.3, 'garage_longitude' => 120.9]);
    $this->customer = customerUser();
    $this->vehicle = availableVehicle();
    Sanctum::actingAs($this->customer);
    $this->payload = ['vehicle_id' => $this->vehicle->id, 'rental_start_at' => now()->addDays(3)->setTime(9, 30)->format('Y-m-d H:i'), 'rental_end_at' => now()->addDays(5)->setTime(9, 30)->format('Y-m-d H:i'), 'owner_driver_coverage' => 'metro_manila', 'destination_address' => 'Customer delivery address', 'destination_place_id' => 'example-place', 'latitude' => 14.4, 'longitude' => 121.0, 'point_confirmed' => true];
    Http::preventStrayRequests();
});
function deliveryRouteResponse(bool $toll = false, int $distance = 5150): array
{
    return ['distanceMeters' => $distance, 'duration' => '1800s', 'polyline' => ['encodedPolyline' => '_p~iF~ps|U_ulLnnqC_mqNvxq`@'], ...($toll ? ['travelAdvisory' => ['tollInfo' => ['estimatedPrice' => [['currencyCode' => 'PHP', 'units' => '50']]]]] : [])];
}
function deliveryBookingData(array $routesPayload, string $id): array
{
    return ['vehicle_id' => $routesPayload['vehicle_id'], 'rental_start_at' => $routesPayload['rental_start_at'], 'rental_end_at' => $routesPayload['rental_end_at'], 'driver_option' => 'owners_driver', 'owner_driver_coverage' => $routesPayload['owner_driver_coverage'], 'pickup_location_type' => 'delivery', 'pickup_location' => $routesPayload['destination_address'], 'return_location' => $routesPayload['destination_address'], 'delivery_quote_id' => $id, 'customer_signature' => 'Customer signed', 'terms_version' => '2026-10-12'];
}
it('quotes actual road metres without rounding distance and keeps alternative routes separate', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [deliveryRouteResponse(false, 5150), deliveryRouteResponse(true, 10000)]])]);
    $r = $this->postJson('/api/mobile/delivery/routes', $this->payload)->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.quote.deliveryFee', 254)->assertJsonPath('data.1.quote.deliveryFee', 375)->assertJsonPath('data.1.quote.tollStatus', 'toll');
    Http::assertSent(fn ($request) => $request['travelMode'] === 'DRIVE' && $request['routingPreference'] === 'TRAFFIC_UNAWARE' && $request['computeAlternativeRoutes'] === true);
    expect(Booking::count())->toBe(0)->and(DeliveryQuote::count())->toBe(2);
    $id = $r->json('data.0.quote.id');
    $this->postJson("/api/mobile/delivery/quotes/$id/select")->assertOk()->assertJsonPath('data.status', 'ready')->assertJsonPath('data.deliveryTollFee', 0)->assertJsonPath('data.totalAmount', 8654);
});
it('applies the minimum fee through the included kilometre', function () {
    $s = DeliveryPricingSetting::current();
    expect($s->fee(0))->toBe(150.0)->and($s->fee(1000))->toBe(150.0)->and($s->fee(1020))->toBe(151.0)->and($s->fee(5150))->toBe(254.0);
});
it('requires staff review even when Google includes an estimated toll', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [deliveryRouteResponse(true)]])]);
    $id = $this->postJson('/api/mobile/delivery/routes', $this->payload)->json('data.0.quote.id');
    $this->postJson("/api/mobile/delivery/quotes/$id/select")->assertOk()->assertJsonPath('data.status', 'awaiting_review')->assertJsonPath('data.expiresAt', null)->assertJsonPath('data.totalAmount', null);
    expect(fn () => app(BookingService::class)->createAwaitingPayPalPayment($this->customer, deliveryBookingData($this->payload, $id)))->toThrow(ValidationException::class);
    $actor = vehicleManagerUser();
    $this->actingAs($actor, 'web')->postJson("/admin/delivery-quotes/$id/review", ['decision' => 'approve', 'delivery_toll_fee' => 125])->assertOk()->assertJsonPath('data.totalAmount', 8779);
    $q = DeliveryQuote::findOrFail($id);
    expect($q->expires_at->diffInSeconds(now(), true))->toBeLessThanOrEqual(900)->and($q->reviewed_by)->toBe($actor->id)->and(Booking::count())->toBe(0);
});
it('issues a complete zero-toll quote without staff review when Google reports no tolls', function (array $advisory) {
    $route = [...deliveryRouteResponse(), ...$advisory];
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [$route]])]);
    $id = $this->postJson('/api/mobile/delivery/routes', $this->payload)->assertOk()->assertJsonPath('data.0.quote.tollStatus', 'toll_free')->json('data.0.quote.id');
    $this->postJson("/api/mobile/delivery/quotes/$id/select")->assertOk()->assertJsonPath('data.status', 'ready')->assertJsonPath('data.deliveryTollFee', 0)->assertJsonPath('data.totalAmount', 8654);
    Http::assertSent(fn ($request) => $request['extraComputations'] === ['TOLLS'] && str_contains($request->header('X-Goog-FieldMask')[0], 'routes.travelAdvisory.tollInfo'));
    $quote = DeliveryQuote::findOrFail($id);
    expect($quote->reviewed_by)->toBeNull()->and($quote->review_deadline)->toBeNull()->and(DeliveryQuote::where('status', 'awaiting_review')->count())->toBe(0)->and(Booking::count())->toBe(0);
    expect(app(DeliveryQuoteService::class)->forBooking($this->customer, deliveryBookingData($this->payload, $id))->id)->toBe($id);
})->with([
    'no travel advisory' => [[]],
    'empty travel advisory' => [['travelAdvisory' => []]],
    'null toll information' => [['travelAdvisory' => ['tollInfo' => null]]],
]);
it('requires staff review when Google reports tolls without a price', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [[...deliveryRouteResponse(), 'travelAdvisory' => ['tollInfo' => []]]]])]);
    $id = $this->postJson('/api/mobile/delivery/routes', $this->payload)->assertOk()->assertJsonPath('data.0.quote.tollStatus', 'toll')->json('data.0.quote.id');
    $this->postJson("/api/mobile/delivery/quotes/$id/select")->assertOk()->assertJsonPath('data.status', 'awaiting_review')->assertJsonPath('data.deliveryTollFee', null)->assertJsonPath('data.totalAmount', null);
    expect(fn () => app(BookingService::class)->createAwaitingPayPalPayment($this->customer, deliveryBookingData($this->payload, $id)))->toThrow(ValidationException::class);
});
it('freezes accepted amounts when settings and vehicle prices change and consumes a quote once', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [deliveryRouteResponse()]])]);
    $id = $this->postJson('/api/mobile/delivery/routes', $this->payload)->json('data.0.quote.id');
    $this->postJson("/api/mobile/delivery/quotes/$id/select")->assertOk();
    DeliveryPricingSetting::current()->update(['minimum_fee' => 999]);
    $this->vehicle->update(['price_per_day' => 8000]);
    $data = deliveryBookingData($this->payload, $id);
    $b = app(BookingService::class)->createAwaitingPayPalPayment($this->customer, $data);
    expect((float) $b->delivery_fee)->toBe(254.0)->and((float) $b->total_amount)->toBe(8654.0)->and(DeliveryQuote::find($id)->status)->toBe('consumed');
    // Payment creation/capture must never reroute the accepted booking.
    Http::assertSentCount(1);
    expect(fn () => app(BookingService::class)->createAwaitingPayPalPayment($this->customer, $data))->toThrow(ValidationException::class);
});
it('rejects expired, foreign, changed and unconfirmed delivery inputs', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [deliveryRouteResponse()]])]);
    $this->postJson('/api/mobile/delivery/routes', [...$this->payload, 'point_confirmed' => false])->assertUnprocessable()->assertJsonValidationErrors('point_confirmed');
    $id = $this->postJson('/api/mobile/delivery/routes', $this->payload)->json('data.0.quote.id');
    $this->postJson("/api/mobile/delivery/quotes/$id/select")->assertOk();
    $data = deliveryBookingData($this->payload, $id);
    foreach (['vehicle_id' => availableVehicle()->id, 'rental_end_at' => now()->addDays(6)->format('Y-m-d H:i'), 'owner_driver_coverage' => 'outside_manila', 'pickup_location' => 'Changed address', 'return_location' => 'Different end trip'] as $field => $value) {
        expect(fn () => app(BookingService::class)->createAwaitingPayPalPayment($this->customer, [...$data, $field => $value]))->toThrow(ValidationException::class);
    }
    $other = customerUser();
    expect(fn () => app(BookingService::class)->createAwaitingPayPalPayment($other, $data))->toThrow(ValidationException::class);
    Sanctum::actingAs($other);
    $this->getJson("/api/mobile/delivery/quotes/$id")->assertNotFound();
    $this->travel(16)->minutes();
    expect(fn () => app(BookingService::class)->createAwaitingPayPalPayment($this->customer, $data))->toThrow(ValidationException::class);
});
it('rejects client prices and discounts on both booking endpoints', function (string $field) {
    $data = ['vehicle_id' => $this->vehicle->id, 'rental_start_at' => $this->payload['rental_start_at'], 'rental_end_at' => $this->payload['rental_end_at'], 'driver_option' => 'owners_driver', 'owner_driver_coverage' => 'metro_manila', 'pickup_location_type' => 'shop', 'pickup_location' => 'Jamjade Garage', 'return_location' => 'Jamjade Garage', 'customer_signature' => 'Signed', 'terms_version' => '2026-10-12', 'down_payment_amount' => 10000, 'payment_method' => 'GCash', 'payment_option' => 'full_payment', 'app_return_url' => 'exp://return', 'app_cancel_url' => 'exp://cancel', $field => 1];
    $this->postJson('/api/mobile/bookings', $data)->assertUnprocessable()->assertJsonValidationErrors($field);
    $this->postJson('/api/mobile/paypal/orders', $data)->assertUnprocessable()->assertJsonValidationErrors($field);
})->with(['discount_total', 'delivery_fee', 'delivery_toll_fee', 'add_ons_total']);
it('fails safely when maps are unavailable or no routes exist', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => []])]);
    $this->postJson('/api/mobile/delivery/routes', $this->payload)->assertUnprocessable();
    expect(DeliveryQuote::count())->toBe(0);
    config(['delivery.google_key' => null]);
    $this->postJson('/api/mobile/delivery/routes', $this->payload)->assertUnprocessable();
});
it('protects pricing from staff and audits admin updates', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $staff->givePermissionTo('manage bookings');
    $this->actingAs($staff, 'web')->getJson('/admin/delivery-pricing')->assertForbidden();
    $actor = vehicleManagerUser();
    $this->actingAs($actor, 'web')->putJson('/admin/delivery-pricing', ['minimum_fee' => 200, 'included_km' => 2, 'per_km_rate' => 30, 'garage_address' => 'Configured garage', 'garage_latitude' => 14.3, 'garage_longitude' => 120.9])->assertOk()->assertJsonPath('data.minimum_fee', 200);
    $this->assertDatabaseHas('activity_log', ['causer_id' => $actor->id, 'log_name' => 'delivery-pricing']);
});
it('resolves addresses through the authenticated server instead of trusting suggestion text', function () {
    Http::fake([
        'places.googleapis.com/v1/places:autocomplete' => Http::response(['suggestions' => [
            ['placePrediction' => ['placeId' => 'real-place', 'text' => ['text' => 'Resolved address']]],
        ]]),
        'places.googleapis.com/v1/places/real-place*' => Http::response(['id' => 'real-place', 'formattedAddress' => 'Resolved address', 'location' => ['latitude' => 14.3, 'longitude' => 120.9]]),
    ]);
    $token = (string) Str::uuid();
    $this->getJson('/api/mobile/delivery/places?input=Re&session_token='.$token)->assertOk()->assertJsonPath('data.0.placeId', 'real-place');
    $this->getJson('/api/mobile/delivery/place?place_id=real-place&session_token='.$token)->assertOk()->assertJsonPath('data.latitude', 14.3);
});

it('keeps financial snapshots while hiding and purging expired provider points', function () {
    $data = withTestDeliveryQuote($this->customer, [
        'vehicle_id' => $this->vehicle->id, 'rental_start_at' => $this->payload['rental_start_at'], 'rental_end_at' => $this->payload['rental_end_at'],
        'pickup_location_type' => 'delivery', 'pickup_location' => 'Customer confirmed street address', 'driver_option' => 'owners_driver', 'owner_driver_coverage' => 'metro_manila',
        'customer_signature' => 'Signed', 'terms_version' => '2026-10-12',
    ], 254, 125);
    $booking = app(BookingService::class)->createAwaitingPayPalPayment($this->customer, $data);
    $this->getJson('/api/mobile/bookings/'.$booking->booking_code)->assertOk()->assertJsonPath('data.deliveryTollFee', 125)->assertJsonPath('data.deliveryLocation.point.latitude', 14.3)->assertJsonPath('data.totalAmount', 8779);
    expect(DeliveryQuote::find($data['delivery_quote_id'])->getRawOriginal('destination_point'))->not->toContain('latitude');
    $this->travel(31)->days();
    $this->getJson('/api/mobile/bookings/'.$booking->booking_code)->assertOk()->assertJsonPath('data.deliveryLocation.point', null)->assertJsonPath('data.totalAmount', 8779);
    $this->artisan('delivery:purge-provider-data')->assertSuccessful();
    expect(DeliveryQuote::find($data['delivery_quote_id'])->destination_point)->toBeNull()->and((float) $booking->fresh()->delivery_toll_fee)->toBe(125.0);
});
it('rejects approval when the selected route changed and still permits staff rejection', function () {
    Http::fake(['routes.googleapis.com/*' => Http::sequence()->push(['routes' => [deliveryRouteResponse(true)]])->push(['routes' => [deliveryRouteResponse(true, 7000)]])]);
    $id = $this->postJson('/api/mobile/delivery/routes', $this->payload)->json('data.0.quote.id');
    $this->postJson("/api/mobile/delivery/quotes/$id/select")->assertOk();
    $actor = vehicleManagerUser();
    $this->actingAs($actor, 'web')->postJson("/admin/delivery-quotes/$id/review", ['decision' => 'approve', 'delivery_toll_fee' => 75])->assertUnprocessable();
    $this->postJson("/admin/delivery-quotes/$id/review", ['decision' => 'reject', 'review_note' => 'Select a fresh available route.'])->assertOk()->assertJsonPath('data.status', 'rejected');
    $this->assertDatabaseHas('notifications', ['user_id' => $this->customer->id, 'title' => 'Delivery request rejected']);
});
it('normalizes offset timestamps before persisting and binding a quote', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [deliveryRouteResponse()]])]);
    $data = [...$this->payload, 'rental_start_at' => now()->addDays(3)->setTime(9, 30)->toIso8601String(), 'rental_end_at' => now()->addDays(5)->setTime(9, 30)->toIso8601String()];
    $data['rental_start_at'] = CarbonImmutable::parse($data['rental_start_at'])->setTimezone('Asia/Manila')->toIso8601String();
    $data['rental_end_at'] = CarbonImmutable::parse($data['rental_end_at'])->setTimezone('Asia/Manila')->toIso8601String();
    $id = $this->postJson('/api/mobile/delivery/routes', $data)->assertOk()->json('data.0.quote.id');
    $this->postJson("/api/mobile/delivery/quotes/$id/select")->assertOk();
    $booking = app(BookingService::class)->createAwaitingPayPalPayment($this->customer, deliveryBookingData($data, $id));
    expect($booking->rental_start_at->equalTo(CarbonImmutable::parse($data['rental_start_at'])))->toBeTrue();
});

it('invalidates an earlier quote when the customer selects a different route for the same schedule', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [deliveryRouteResponse(true), deliveryRouteResponse(true, 9000)]])]);
    $routes = $this->postJson('/api/mobile/delivery/routes', $this->payload)->assertOk()->json('data');
    $first = $routes[0]['quote']['id'];
    $second = $routes[1]['quote']['id'];
    $this->postJson("/api/mobile/delivery/quotes/$first/select")->assertOk()->assertJsonPath('data.status', 'awaiting_review');
    // Requesting fresh routes gives a new offer for a route change.
    $next = $this->postJson('/api/mobile/delivery/routes', $this->payload)->assertOk()->json('data.1.quote.id');
    $this->postJson("/api/mobile/delivery/quotes/$next/select")->assertOk()->assertJsonPath('data.status', 'awaiting_review');
    $this->getJson("/api/mobile/delivery/quotes/$first")->assertJsonPath('data.status', 'superseded');
    $this->postJson("/api/mobile/delivery/quotes/$second/select")->assertUnprocessable();
    expect(Booking::count())->toBe(0);
});

it('prints the accepted initial delivery toll and current delivery terms in confirmations', function () {
    $data = withTestDeliveryQuote($this->customer, [
        'vehicle_id' => $this->vehicle->id, 'rental_start_at' => $this->payload['rental_start_at'], 'rental_end_at' => $this->payload['rental_end_at'],
        'pickup_location_type' => 'delivery', 'pickup_location' => 'Customer confirmed street address', 'driver_option' => 'owners_driver', 'owner_driver_coverage' => 'metro_manila',
        'customer_signature' => 'Signed', 'terms_version' => '2026-10-12',
    ], 254, 125);
    $booking = app(BookingService::class)->createAwaitingPayPalPayment($this->customer, $data);
    $html = view('pdf.bookings.successful-booking', ['booking' => $booking, 'confirmation' => app(BookingConfirmationViewData::class)->make($booking)])->render();
    expect($html)->toContain('Delivery Toll', 'PHP 125.00', 'accepted quote amount')->not->toContain('will be charged PHP 900.00');
});
