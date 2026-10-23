<?php

use App\Models\Booking;
use App\Models\DeliveryPricingSetting;
use App\Models\DeliveryQuote;
use App\Models\User;
use App\Services\BookingConfirmationViewData;
use App\Services\BookingService;
use App\Support\BookingAgreement;
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
    return ['vehicle_id' => $routesPayload['vehicle_id'], 'rental_start_at' => $routesPayload['rental_start_at'], 'rental_end_at' => $routesPayload['rental_end_at'], 'driver_option' => 'owners_driver', 'owner_driver_coverage' => $routesPayload['owner_driver_coverage'], 'pickup_location_type' => 'delivery', 'pickup_location' => $routesPayload['destination_address'], 'return_location' => $routesPayload['destination_address'], 'delivery_quote_id' => $id, 'customer_signature' => 'Customer signed', 'terms_version' => '2026-10-12', 'late_return_policy_version' => lateReturnPolicyVersion($routesPayload['vehicle_id'])];
}
it('confirms one fastest estimate with a complete fee and no upfront toll', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [
        [...deliveryRouteResponse(false, 5150), 'duration' => '1800s'],
        [...deliveryRouteResponse(true, 10000), 'duration' => '900.5s'],
        [...deliveryRouteResponse(false, 9000), 'duration' => '950s'],
    ]])]);
    $r = $this->postJson('/api/mobile/delivery/quotes', $this->payload)->assertOk()
        ->assertJsonPath('data.distanceMeters', 10000)->assertJsonPath('data.durationSeconds', 900.5)
        ->assertJsonPath('data.quote.deliveryFee', 375)->assertJsonPath('data.quote.deliveryTollFee', 0)
        ->assertJsonPath('data.quote.status', 'ready')->assertJsonPath('data.quote.requiresRequote', false)
        ->assertJsonPath('data.quote.totalAmount', 8775)->assertJsonMissingPath('data.encodedPolyline');
    Http::assertSent(fn ($request) => $request['travelMode'] === 'DRIVE' && $request['routingPreference'] === 'TRAFFIC_AWARE' && $request['computeAlternativeRoutes'] === true && ! isset($request['extraComputations']));
    expect(Booking::count())->toBe(0)->and(DeliveryQuote::count())->toBe(1);
    $quote = DeliveryQuote::findOrFail($r->json('data.quote.id'));
    expect($quote->reviewed_by)->toBeNull()->and($quote->review_deadline)->toBeNull()
        ->and($quote->pricing_snapshot)->not->toHaveKeys(['distanceMeters', 'durationSeconds', 'encodedPolyline']);
    $this->assertDatabaseCount('notifications', 0);
});
it('breaks equal estimated times by distance and prices unrounded road metres', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [deliveryRouteResponse(false, 10000), deliveryRouteResponse(true, 5150)]])]);
    $this->postJson('/api/mobile/delivery/quotes', $this->payload)->assertOk()
        ->assertJsonPath('data.distanceMeters', 5150)->assertJsonPath('data.quote.deliveryFee', 254);
});
it('applies the minimum fee through the included kilometre', function () {
    $s = DeliveryPricingSetting::current();
    expect($s->fee(0))->toBe(150.0)->and($s->fee(1000))->toBe(150.0)->and($s->fee(1020))->toBe(151.0)->and($s->fee(5150))->toBe(254.0);
});
it('requires fresh confirmation of legacy unconsumed quotes without changing their saved amounts', function () {
    $payload = withTestDeliveryQuote($this->customer, deliveryBookingData($this->payload, 'unused'), 254);
    $q = DeliveryQuote::findOrFail($payload['delivery_quote_id']);
    $snapshot = $q->pricing_snapshot;
    unset($snapshot['policy_version']);
    $q->update(['pricing_snapshot' => $snapshot, 'delivery_toll_fee' => 125]);
    $this->getJson('/api/mobile/delivery/quotes/'.$q->id)->assertOk()
        ->assertJsonPath('data.requiresRequote', true)->assertJsonPath('data.deliveryTollFee', 125);
    expect(fn () => app(BookingService::class)->createAwaitingPayPalPayment($this->customer, $payload))->toThrow(ValidationException::class);
    expect($q->fresh()->delivery_toll_fee)->toBe(125.0)->and($q->fresh()->status)->toBe('ready');
});
it('removes the obsolete customer route choice and staff toll review endpoints', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [deliveryRouteResponse()]])]);
    $id = $this->postJson('/api/mobile/delivery/quotes', $this->payload)->json('data.quote.id');
    $this->postJson('/api/mobile/delivery/routes', $this->payload)->assertNotFound();
    $this->postJson("/api/mobile/delivery/quotes/$id/select")->assertNotFound();
    $this->actingAs(vehicleManagerUser(), 'web')->getJson('/admin/delivery-quotes')->assertNotFound();
    $this->postJson("/admin/delivery-quotes/$id/review", ['decision' => 'approve', 'delivery_toll_fee' => 125])->assertNotFound();
});
it('freezes accepted amounts when settings and vehicle prices change and consumes a quote once', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [deliveryRouteResponse()]])]);
    $id = $this->postJson('/api/mobile/delivery/quotes', $this->payload)->json('data.quote.id');
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
    $this->postJson('/api/mobile/delivery/quotes', [...$this->payload, 'point_confirmed' => false])->assertUnprocessable()->assertJsonValidationErrors('point_confirmed');
    $id = $this->postJson('/api/mobile/delivery/quotes', $this->payload)->json('data.quote.id');
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
    $data = ['vehicle_id' => $this->vehicle->id, 'rental_start_at' => $this->payload['rental_start_at'], 'rental_end_at' => $this->payload['rental_end_at'], 'driver_option' => 'owners_driver', 'owner_driver_coverage' => 'metro_manila', 'pickup_location_type' => 'shop', 'pickup_location' => 'Jamjade Garage', 'return_location' => 'Jamjade Garage', 'customer_signature' => 'Signed', 'terms_version' => '2026-10-12', 'late_return_policy_version' => lateReturnPolicyVersion($this->vehicle->id), 'down_payment_amount' => 10000, 'payment_method' => 'GCash', 'payment_option' => 'full_payment', 'app_return_url' => 'exp://return', 'app_cancel_url' => 'exp://cancel', $field => 1];
    $this->postJson('/api/mobile/bookings', $data)->assertUnprocessable()->assertJsonValidationErrors($field);
    $this->postJson('/api/mobile/paypal/orders', $data)->assertUnprocessable()->assertJsonValidationErrors($field);
})->with(['discount_total', 'delivery_fee', 'delivery_toll_fee', 'add_ons_total']);
it('fails safely when maps are unavailable or no routes exist', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => []])]);
    $this->postJson('/api/mobile/delivery/quotes', $this->payload)->assertUnprocessable();
    expect(DeliveryQuote::count())->toBe(0);
    config(['delivery.google_key' => null]);
    $this->postJson('/api/mobile/delivery/quotes', $this->payload)->assertUnprocessable();
});
it('protects pricing from staff and audits admin updates', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $staff->givePermissionTo('manage bookings');
    $this->actingAs($staff, 'web')->getJson('/admin/delivery-pricing')->assertForbidden();
    $this->putJson('/admin/delivery-pricing', ['minimum_fee' => 200, 'included_km' => 2, 'per_km_rate' => 30])->assertForbidden();
    $actor = vehicleManagerUser();
    $this->actingAs($actor, 'web')->putJson('/admin/delivery-pricing', ['minimum_fee' => 200, 'included_km' => 2, 'per_km_rate' => 30, 'garage_address' => 'Configured garage', 'garage_latitude' => 14.3, 'garage_longitude' => 120.9])->assertOk()->assertJsonPath('data.minimum_fee', 200);
    $this->assertDatabaseHas('activity_log', ['causer_id' => $actor->id, 'log_name' => 'delivery-pricing']);
});
it('updates delivery prices without requiring or overwriting the configured garage', function (bool $unsetPoint) {
    if ($unsetPoint) {
        DeliveryPricingSetting::current()->update(['garage_latitude' => null, 'garage_longitude' => null]);
    }
    $before = DeliveryPricingSetting::current()->snapshot();
    $actor = vehicleManagerUser();
    $this->actingAs($actor, 'web')->putJson('/admin/delivery-pricing', [
        'minimum_fee' => 200, 'included_km' => 2, 'per_km_rate' => 30,
    ])->assertOk()->assertJsonPath('data.minimum_fee', 200)
        ->assertJsonPath('data.included_km', 2)
        ->assertJsonPath('data.per_km_rate', 30)
        ->assertJsonPath('data.garage_address', $before['garage_address'])
        ->assertJsonPath('data.garage_latitude', $before['garage_latitude'])
        ->assertJsonPath('data.garage_longitude', $before['garage_longitude']);

    $after = DeliveryPricingSetting::current()->snapshot();
    foreach (['garage_address', 'garage_latitude', 'garage_longitude'] as $field) {
        expect($after[$field])->toBe($before[$field]);
    }
    Http::assertNothingSent();
})->with([false, true]);
it('validates pricing and optional garage fields without modifying saved settings', function (string $field, mixed $value) {
    $before = DeliveryPricingSetting::current()->snapshot();
    $this->actingAs(vehicleManagerUser(), 'web')->putJson('/admin/delivery-pricing', [
        ...['minimum_fee' => 200, 'included_km' => 2, 'per_km_rate' => 30], $field => $value,
    ])->assertUnprocessable()->assertJsonValidationErrors($field);
    expect(DeliveryPricingSetting::current()->snapshot())->toBe($before);
})->with([
    ['minimum_fee', null], ['minimum_fee', -1], ['minimum_fee', 1.001],
    ['included_km', 1.0001], ['per_km_rate', 1000001],
    ['garage_address', ''], ['garage_latitude', null], ['garage_latitude', 91], ['garage_longitude', -181],
]);
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
        'late_return_policy_version' => lateReturnPolicyVersion($this->vehicle->id),
    ], 254);
    $booking = app(BookingService::class)->createAwaitingPayPalPayment($this->customer, $data);
    $booking->update(['delivery_toll_fee' => 125, 'total_amount' => 8779]);
    $booking->deliveryQuote->update(['pricing_snapshot' => [], 'delivery_toll_fee' => 125]);
    $this->getJson('/api/mobile/bookings/'.$booking->booking_code)->assertOk()->assertJsonPath('data.deliveryTollFee', 125)->assertJsonPath('data.deliveryLocation.point.latitude', 14.3)->assertJsonPath('data.totalAmount', 8779);
    expect(DeliveryQuote::find($data['delivery_quote_id'])->getRawOriginal('destination_point'))->not->toContain('latitude');
    $this->travel(31)->days();
    $this->getJson('/api/mobile/bookings/'.$booking->booking_code)->assertOk()->assertJsonPath('data.deliveryLocation.point', null)->assertJsonPath('data.totalAmount', 8779);
    $this->artisan('delivery:purge-provider-data')->assertSuccessful();
    expect(DeliveryQuote::find($data['delivery_quote_id'])->destination_point)->toBeNull()->and((float) $booking->fresh()->delivery_toll_fee)->toBe(125.0);
});
it('normalizes offset timestamps before persisting and binding a quote', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [deliveryRouteResponse()]])]);
    $data = [...$this->payload, 'rental_start_at' => now()->addDays(3)->setTime(9, 30)->toIso8601String(), 'rental_end_at' => now()->addDays(5)->setTime(9, 30)->toIso8601String()];
    $data['rental_start_at'] = CarbonImmutable::parse($data['rental_start_at'])->setTimezone('Asia/Manila')->toIso8601String();
    $data['rental_end_at'] = CarbonImmutable::parse($data['rental_end_at'])->setTimezone('Asia/Manila')->toIso8601String();
    $id = $this->postJson('/api/mobile/delivery/quotes', $data)->assertOk()->json('data.quote.id');
    $booking = app(BookingService::class)->createAwaitingPayPalPayment($this->customer, deliveryBookingData($data, $id));
    expect($booking->rental_start_at->equalTo(CarbonImmutable::parse($data['rental_start_at'])))->toBeTrue();
});

it('supersedes an earlier quote only after a new location confirmation succeeds', function () {
    Http::fake(['routes.googleapis.com/*' => Http::sequence()
        ->push(['routes' => [deliveryRouteResponse()]])->push(['routes' => []])
        ->push(['routes' => [deliveryRouteResponse(true, 9000)]])]);
    $first = $this->postJson('/api/mobile/delivery/quotes', $this->payload)->assertOk()->json('data.quote.id');
    $this->postJson('/api/mobile/delivery/quotes', $this->payload)->assertUnprocessable();
    expect(DeliveryQuote::find($first)->status)->toBe('ready');
    $next = $this->postJson('/api/mobile/delivery/quotes', $this->payload)->assertOk()->json('data.quote.id');
    $this->getJson("/api/mobile/delivery/quotes/$first")->assertJsonPath('data.status', 'superseded');
    $this->getJson("/api/mobile/delivery/quotes/$next")->assertJsonPath('data.status', 'ready');
    expect(Booking::count())->toBe(0);
});

it('prints the accepted initial delivery toll and current delivery terms in confirmations', function () {
    $data = withTestDeliveryQuote($this->customer, [
        'vehicle_id' => $this->vehicle->id, 'rental_start_at' => $this->payload['rental_start_at'], 'rental_end_at' => $this->payload['rental_end_at'],
        'pickup_location_type' => 'delivery', 'pickup_location' => 'Customer confirmed street address', 'driver_option' => 'owners_driver', 'owner_driver_coverage' => 'metro_manila',
        'customer_signature' => 'Signed', 'terms_version' => '2026-10-12',
        'late_return_policy_version' => lateReturnPolicyVersion($this->vehicle->id),
    ], 254);
    $booking = app(BookingService::class)->createAwaitingPayPalPayment($this->customer, $data);
    $booking->update(['delivery_toll_fee' => 125, 'total_amount' => 8779]);
    $booking->deliveryQuote->update(['pricing_snapshot' => [], 'delivery_toll_fee' => 125]);
    $html = view('pdf.bookings.rental-information', ['booking' => $booking, 'confirmation' => app(BookingConfirmationViewData::class)->make($booking)])->render();
    expect($html)->toContain('Delivery Toll', 'PHP 125.00', 'accepted quote amount')->not->toContain('will be charged PHP 900.00');
});

it('retrieves fresh estimates without changing accepted delivery pricing and hides them from other customers', function () {
    Http::fake(['routes.googleapis.com/*' => Http::sequence()->push(['routes' => [deliveryRouteResponse()]])
        ->push(['routes' => [[...deliveryRouteResponse(false, 12000), 'duration' => '3600s']]])]);
    $id = $this->postJson('/api/mobile/delivery/quotes', $this->payload)->json('data.quote.id');
    $booking = app(BookingService::class)->createAwaitingPayPalPayment($this->customer, deliveryBookingData($this->payload, $id));
    $this->getJson('/api/mobile/bookings/'.$booking->booking_code.'/delivery-estimate')->assertOk()
        ->assertJsonPath('data.distanceMeters', 12000)->assertJsonPath('data.durationSeconds', 3600);
    expect((float) $booking->fresh()->delivery_fee)->toBe(254.0)->and((float) $booking->fresh()->total_amount)->toBe(8654.0);
    Sanctum::actingAs(customerUser());
    $this->getJson('/api/mobile/bookings/'.$booking->booking_code.'/delivery-estimate')->assertNotFound();
    $this->getJson('/api/mobile/delivery/quotes/'.$id.'/estimate')->assertNotFound();
    Http::assertSentCount(2);
});
it('rejects incomplete provider metrics instead of accepting or storing a partial quote', function (array $route) {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [$route]])]);
    $this->postJson('/api/mobile/delivery/quotes', $this->payload)->assertUnprocessable();
    expect(DeliveryQuote::count())->toBe(0);
})->with([
    [['distanceMeters' => 1000]], [['distanceMeters' => -1, 'duration' => '10s']],
    [['distanceMeters' => 1000, 'duration' => 'invalid']], [['distanceMeters' => 1000, 'duration' => '-10s']],
    [['distanceMeters' => 1000.5, 'duration' => '10s']],
]);
it('does not retrieve provider estimates after the saved point expires', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [deliveryRouteResponse()]])]);
    $id = $this->postJson('/api/mobile/delivery/quotes', $this->payload)->json('data.quote.id');
    DeliveryQuote::find($id)->update(['point_expires_at' => now()->subSecond()]);
    $this->getJson('/api/mobile/delivery/quotes/'.$id.'/estimate')->assertUnprocessable();
    Http::assertSentCount(1);
});
it('prints deferred toll notice for new agreements while preserving v2 cancellation and delivery terms', function () {
    Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [deliveryRouteResponse()]])]);
    $id = $this->postJson('/api/mobile/delivery/quotes', $this->payload)->json('data.quote.id');
    $booking = app(BookingService::class)->createAwaitingPayPalPayment($this->customer, [
        ...deliveryBookingData($this->payload, $id), 'terms_version' => BookingAgreement::VERSION,
    ]);
    $render = fn () => view('pdf.bookings.partials.terms-and-conditions', ['confirmation' => app(BookingConfirmationViewData::class)->make($booking)])->render();
    expect($render())->toContain('Actual tolls, if incurred, are billed after the rental.')->not->toContain('staff-approved toll');
    $booking->update(['terms_version' => '2026-10-15-v2']);
    expect($render())->toContain('staff-approved toll', 'Customers may request cancellation')->not->toContain('Actual tolls, if incurred');
});
