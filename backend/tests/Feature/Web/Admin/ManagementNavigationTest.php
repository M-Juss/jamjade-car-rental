<?php

use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\CustomerDocument;
use App\Models\DeliveryQuote;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-16T00:30:00+08:00')->utc());
});

afterEach(fn () => CarbonImmutable::setTestNow());

function navigationBooking(string $status = 'confirmed', string $start = '2026-10-16T14:00:00+08:00', string $end = '2026-10-17T14:00:00+08:00'): Booking
{
    return Booking::create([
        'booking_code' => 'BK-NAV-'.strtoupper(bin2hex(random_bytes(4))),
        'user_id' => customerUser()->id, 'vehicle_id' => availableVehicle()->id,
        'rental_type' => RentalType::SelfDrive, 'driver_option' => 'self_drive',
        'rental_start_at' => CarbonImmutable::parse($start)->utc(), 'rental_end_at' => CarbonImmutable::parse($end)->utc(),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Garage', 'return_location' => 'Garage',
        'status' => $status, 'payment_status' => 'paid', 'price_per_day' => 3500,
        'duration_days' => 1, 'subtotal' => 3500, 'total_amount' => 3500, 'remaining_balance' => 0,
    ]);
}

function navigationToll(string $status = 'awaiting_review', string $deadline = '+1 hour'): DeliveryQuote
{
    $customer = customerUser();
    $payload = withTestDeliveryQuote($customer, [
        'vehicle_id' => availableVehicle()->id, 'rental_start_at' => now()->addDays(2),
        'rental_end_at' => now()->addDays(3), 'owner_driver_coverage' => 'metro_manila', 'pickup_location' => 'Sample destination',
    ]);
    $quote = DeliveryQuote::findOrFail($payload['delivery_quote_id']);
    $quote->update(['status' => $status, 'review_deadline' => now()->modify($deadline)]);

    return $quote;
}

it('counts today and earlier unstarted confirmed pickups without legacy toll requests using the Manila date', function () {
    $today = navigationBooking();
    navigationBooking('confirmed', '2026-10-15T14:00:00+08:00', '2026-10-16T14:00:00+08:00');
    navigationBooking('confirmed', '2026-10-17T00:00:00+08:00', '2026-10-18T00:00:00+08:00');
    navigationBooking('confirmed', '2026-10-14T14:00:00+08:00', '2026-10-16T00:30:00+08:00');
    foreach (['pending', 'ongoing', 'returned', 'completed', 'cancelled', 'rejected'] as $status) {
        navigationBooking($status);
    }
    $toll = navigationToll();
    navigationToll('awaiting_review', '-1 second');
    navigationToll('ready');
    navigationToll('rejected');
    $this->actingAs(vehicleManagerUser())->getJson('/admin/navigation-counts')->assertOk()
        ->assertExactJson(['success' => true, 'message' => 'Navigation counts.', 'data' => ['bookings' => 2, 'verification' => 0]]);

    $today->update(['status' => 'ongoing']);
    $toll->update(['status' => 'ready']);
    $this->getJson('/admin/navigation-counts')->assertOk()->assertJsonPath('data.bookings', 1);
});

it('counts required pending documents individually without counting sides legacy records or other roles', function () {
    $customer = documentCustomerUser();
    foreach (CustomerDocument::REQUIRED_SELF_DRIVE_DOCUMENTS as $type) {
        $document = $customer->documents()->create(['document_type' => $type, 'status' => 'pending', 'submitted_at' => now()]);
        $document->syncFiles(['front' => 'test/front.jpg', 'back' => 'test/back.jpg']);
    }
    $customer->documents()->create(['document_type' => CustomerDocument::PASSPORT, 'status' => 'pending']);
    $other = documentCustomerUser();
    $other->documents()->create(['document_type' => CustomerDocument::DRIVERS_LICENSE, 'status' => 'approved']);
    $deleted = $other->documents()->create(['document_type' => CustomerDocument::PROOF_OF_BILLING, 'status' => 'pending']);
    $deleted->delete();
    User::factory()->create()->documents()->create(['document_type' => CustomerDocument::DRIVERS_LICENSE, 'status' => 'pending']);
    $this->actingAs(vehicleManagerUser())->getJson('/admin/navigation-counts')->assertOk()->assertJsonPath('data.verification', 2);
    $customer->documents()->where('document_type', CustomerDocument::DRIVERS_LICENSE)->update(['status' => 'approved']);
    $this->getJson('/admin/navigation-counts')->assertOk()->assertJsonPath('data.verification', 1);
    $customer->documents()->where('document_type', CustomerDocument::PROOF_OF_BILLING)->update(['status' => 'rejected']);
    $this->getJson('/admin/navigation-counts')->assertOk()->assertJsonPath('data.verification', 0);
});

it('returns only counts authorized for the staff member', function (string $permission, string $visible, string $hidden) {
    Role::findByName('staff')->syncPermissions([$permission]);
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->actingAs($staff)->getJson('/admin/navigation-counts')->assertOk()
        ->assertJsonPath('data.'.$visible, 0)->assertJsonPath('data.'.$hidden, null);
})->with([
    ['manage bookings', 'bookings', 'verification'],
    ['review documents', 'verification', 'bookings'],
]);

it('rejects guests inactive accounts drivers and staff without either permission', function () {
    $this->getJson('/admin/navigation-counts')->assertUnauthorized();
    Role::findByName('staff')->syncPermissions([]);
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->actingAs($staff)->getJson('/admin/navigation-counts')->assertForbidden();
    $driver = User::factory()->create();
    $driver->assignRole('driver');
    $driver->givePermissionTo(['manage bookings', 'review documents']);
    $this->actingAs($driver)->getJson('/admin/navigation-counts')->assertForbidden();
    $admin = vehicleManagerUser();
    $admin->update(['is_active' => false]);
    $this->actingAs($admin)->getJson('/admin/navigation-counts')->assertForbidden();
});
