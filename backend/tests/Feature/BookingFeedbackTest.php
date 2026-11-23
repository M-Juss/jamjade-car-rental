<?php

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\BookingFeedback;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    $this->travelTo(now()->setDate(2026, 11, 21)->startOfDay());
});

function feedbackBooking(?User $customer = null, array $attributes = []): Booking
{
    return Booking::create([
        'booking_code' => 'BK-'.Str::upper(Str::random(8)), 'user_id' => ($customer ?? customerUser())->id,
        'vehicle_id' => availableVehicle()->id, 'rental_type' => RentalType::SelfDrive,
        'status' => BookingStatus::Completed, 'completed_at' => '2026-11-20 01:00:00',
        'rental_start_at' => '2026-11-19 01:00:00', 'rental_end_at' => '2026-11-20 01:00:00',
        'pickup_location_type' => 'shop', 'pickup_location' => 'Garage', 'return_location' => 'Garage',
        'price_per_day' => 1500, 'duration_days' => 1, 'subtotal' => 1500, 'total_amount' => 1500,
        ...$attributes,
    ]);
}

function savedFeedback(Booking $booking, array $attributes = []): BookingFeedback
{
    return $booking->feedback()->create([
        'customer_id' => $booking->user_id, 'rating' => 5, 'comment' => 'Clean and comfortable.',
        ...$attributes,
    ]);
}

it('accepts one owned completed rental review for either rental type and safely retries', function (RentalType $type) {
    $booking = feedbackBooking(attributes: ['rental_type' => $type]);
    Sanctum::actingAs($booking->user);
    $url = '/api/mobile/bookings/'.$booking->id.'/feedback';
    $payload = ['rating' => 4, 'comment' => '  Good service.  ', 'is_featured' => true, 'customer_id' => 999];
    $first = $this->postJson($url, $payload)->assertOk()->assertJsonPath('data.comment', 'Good service.')->assertJsonPath('data.rating', 4)->json('data.id');
    $this->postJson($url, $payload)->assertOk()->assertJsonPath('data.id', $first);
    $this->postJson($url, [...$payload, 'rating' => 5])->assertConflict();
    expect(BookingFeedback::count())->toBe(1)
        ->and($booking->feedback->customer_id)->toBe($booking->user_id)
        ->and($booking->feedback->is_featured)->toBeFalse();
    $this->getJson('/api/mobile/bookings/'.$booking->id)->assertOk()->assertJsonPath('data.canLeaveFeedback', false)->assertJsonPath('data.feedback.id', $first);
})->with([RentalType::SelfDrive, RentalType::OwnersDriver]);

it('requires ownership and completion and rejects drivers and management authors', function () {
    $booking = feedbackBooking(attributes: ['status' => BookingStatus::Returned]);
    $payload = ['rating' => 5];
    $url = '/api/mobile/bookings/'.$booking->id.'/feedback';
    $this->postJson($url, $payload)->assertUnauthorized();
    Sanctum::actingAs(customerUser());
    $this->postJson($url, $payload)->assertForbidden();
    Sanctum::actingAs(createDriverUser());
    $this->postJson($url, $payload)->assertForbidden();
    Sanctum::actingAs(vehicleManagerUser());
    $this->postJson($url, $payload)->assertForbidden();
    Sanctum::actingAs($booking->user);
    $this->postJson($url, $payload)->assertUnprocessable()->assertJsonValidationErrors('rating');
    $booking->update(['status' => BookingStatus::Cancelled]);
    $this->postJson($url, $payload)->assertUnprocessable();
    $booking->delete();
    $this->postJson($url, $payload)->assertNotFound();
    expect(BookingFeedback::count())->toBe(0);
});

it('validates stars and optional comments without requiring publication permission', function () {
    $booking = feedbackBooking();
    Sanctum::actingAs($booking->user);
    $url = '/api/mobile/bookings/'.$booking->id.'/feedback';
    foreach ([0, 6, 2.5, 'bad', null] as $rating) {
        $this->postJson($url, ['rating' => $rating])->assertUnprocessable()->assertJsonValidationErrors('rating');
    }
    $this->postJson($url, ['rating' => 5, 'comment' => str_repeat('x', 1001)])->assertUnprocessable()->assertJsonValidationErrors('comment');
    $this->postJson($url, ['rating' => 1, 'comment' => '   ', 'allows_publication' => true])->assertOk()->assertJsonPath('data.comment', null)->assertJsonMissingPath('data.allowsPublication');
    expect($booking->feedback->publication_consented_at)->toBeNull();
});

it('publishes only starred written reviews without a customer permission gate and hides private details', function () {
    $customer = customerUser(['name' => 'Review Customer']);
    $customer->customerProfile()->update(['first_name' => 'Review', 'last_name' => 'Customer']);
    $review = savedFeedback(feedbackBooking($customer), ['rating' => 3]);
    savedFeedback(feedbackBooking(), ['is_featured' => true, 'comment' => null]);
    savedFeedback(feedbackBooking(), ['is_featured' => true, 'comment' => '   ']);
    savedFeedback(feedbackBooking(attributes: ['status' => BookingStatus::Cancelled]), ['is_featured' => true]);
    $deleted = feedbackBooking();
    savedFeedback($deleted, ['is_featured' => true]);
    $deleted->delete();
    $inactive = feedbackBooking(customerUser(['is_active' => false]));
    savedFeedback($inactive, ['is_featured' => true]);
    $this->getJson('/api/testimonials')->assertOk()->assertJsonCount(0, 'data');
    $admin = vehicleManagerUser();
    $this->actingAs($admin)->putJson('/admin/feedback/'.$review->id.'/featured', ['is_featured' => true])->assertOk()->assertJsonPath('data.isFeatured', true);
    $public = $this->getJson('/api/testimonials')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Review C.')->assertJsonPath('data.0.rating', 3)->json('data.0');
    expect(array_keys($public))->toBe(['id', 'name', 'rating', 'comment']);
    $this->putJson('/admin/feedback/'.$review->id.'/featured', ['is_featured' => false])->assertOk();
    $this->getJson('/api/testimonials')->assertOk()->assertJsonCount(0, 'data');
    $unwritten = savedFeedback(feedbackBooking(), ['comment' => null]);
    $this->putJson('/admin/feedback/'.$unwritten->id.'/featured', ['is_featured' => true])->assertUnprocessable()->assertJsonValidationErrors('is_featured');
});

it('always masks the public surname and uses saved customer first names', function () {
    $customer = customerUser(['name' => 'Account Display Full Surname']);
    $customer->customerProfile()->update(['first_name' => 'Maria Clara', 'last_name' => 'Ñunez']);
    $review = savedFeedback(feedbackBooking($customer), ['is_featured' => true]);
    $this->getJson('/api/testimonials')->assertOk()->assertJsonPath('data.0.name', 'Maria Clara Ñ.');
    $customer->customerProfile()->delete();
    $customer->update(['name' => 'Legacy Middle Surname']);
    $this->getJson('/api/testimonials')->assertOk()->assertJsonPath('data.0.name', 'Legacy S.');
    $customer->update(['name' => 'Solo']);
    $this->getJson('/api/testimonials')->assertOk()->assertJsonPath('data.0.name', 'Solo');
});

it('ignores historical publication permission when starring and retrying reviews', function () {
    $booking = feedbackBooking();
    $review = savedFeedback($booking, ['publication_consented_at' => null]);
    Sanctum::actingAs($booking->user);
    $this->postJson('/api/mobile/bookings/'.$booking->id.'/feedback', ['rating' => 5, 'comment' => 'Clean and comfortable.'])->assertOk()->assertJsonPath('data.id', $review->id);
    $admin = vehicleManagerUser();
    $this->actingAs($admin)->putJson('/admin/feedback/'.$review->id.'/featured', ['is_featured' => true])->assertOk();
    $this->getJson('/api/testimonials')->assertOk()->assertJsonCount(1, 'data');
});

it('allows report staff to read lifetime feedback but only admin and owner can curate', function () {
    $customer = customerUser();
    $review = savedFeedback(feedbackBooking($customer));
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $url = '/admin/reports/customers/'.$customer->id.'/feedback';
    $this->actingAs($staff)->getJson($url.'?per_page=1')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('meta.average_rating', 5);
    $this->putJson('/admin/feedback/'.$review->id.'/featured', ['is_featured' => true])->assertForbidden();
    $staff->revokePermissionTo('view reports');
    $staff->removeRole('staff');
    $this->getJson($url)->assertForbidden();
    $owner = User::factory()->create();
    $owner->assignRole(['admin', 'owner']);
    $this->actingAs($owner)->putJson('/admin/feedback/'.$review->id.'/featured', ['is_featured' => true])->assertOk();
    $this->putJson('/admin/feedback/'.$review->id.'/featured', ['is_featured' => 'invalid'])->assertUnprocessable();
    $this->getJson($url.'?per_page=51')->assertUnprocessable();
});

it('keeps all ratings lifetime regardless of report dates, vehicle filters, stars or sharing', function () {
    $customer = customerUser();
    $current = feedbackBooking($customer);
    savedFeedback($current, ['rating' => 5, 'is_featured' => true]);
    $older = savedFeedback(feedbackBooking($customer, ['completed_at' => '2025-01-01 01:00:00']), ['rating' => 1, 'comment' => null, 'publication_consented_at' => null]);
    $older->forceFill(['created_at' => now()->subYear()])->save();
    feedbackBooking($customer); // Unrated bookings do not count as zero.
    $deleted = feedbackBooking($customer);
    savedFeedback($deleted, ['rating' => 1]);
    $deleted->delete();
    savedFeedback(feedbackBooking($customer, ['status' => BookingStatus::Cancelled]), ['rating' => 1]);
    $this->actingAs(vehicleManagerUser());
    $this->getJson('/admin/reports?section=customers&period=day&date=2026-11-20&vehicle_id='.$current->vehicle_id)->assertOk()
        ->assertJsonPath('data.table.rows.0.lifetime_rating', 3)->assertJsonPath('data.table.rows.0.rating_count', 2)->assertJsonPath('data.table.rows.0.customer_id', $customer->id);
    $this->getJson('/admin/reports/customers/'.$customer->id.'/feedback?per_page=1')->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('meta.total', 2)->assertJsonPath('meta.last_page', 2)->assertJsonPath('meta.average_rating', 3);
    $this->getJson('/admin/reports/customers/'.$customer->id.'/feedback?per_page=1&page=2')->assertOk()->assertJsonPath('data.0.rating', 1);
});
