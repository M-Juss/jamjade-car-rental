<?php

use App\Enums\DocumentStatus;
use App\Enums\UserRole;
use App\Enums\VehicleStatus;
use App\Models\CustomerDocument;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\DriverAssignmentService;
use App\Support\VehicleInspectionDefinition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
 // ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

function something()
{
    // ..
}

function customerUser(array $attributes = []): User
{
    $user = User::factory()->create(array_merge([
        'password' => Hash::make('password123'),
    ], $attributes));

    $user->assignRole(UserRole::Customer->value);

    $user->customerProfile()->create([
        'first_name' => 'Juan',
        'last_name' => 'Dela Cruz',
        'birthdate' => '2000-01-15',
        'address' => 'Dasmarinas, Cavite',
        'profile_completed_at' => now(),
        'can_self_drive' => true,
        'verification_status' => 'approved',
    ]);

    foreach (CustomerDocument::REQUIRED_SELF_DRIVE_DOCUMENTS as $type) {
        $user->documents()->create([
            'document_type' => $type,
            'file_path' => "seed/{$type}.jpg",
            'status' => DocumentStatus::Approved,
        ]);
    }

    return $user;
}

function documentCustomerUser(): User
{
    $user = User::factory()->create([
        'name' => 'Document Customer',
    ]);
    $user->assignRole(UserRole::Customer->value);
    $user->customerProfile()->create([
        'first_name' => 'Document',
        'last_name' => 'Customer',
        'birthdate' => '2000-01-15',
        'address' => 'Dasmarinas, Cavite',
        'profile_completed_at' => now(),
        'driving_intent' => 'self_drive',
        'verification_status' => 'documents_required',
    ]);

    return $user;
}

function createDriverUser(array $attributes = []): User
{
    $user = User::factory()->create(array_merge(['is_active' => true], $attributes));
    $user->assignRole(DriverAssignmentService::DRIVER_ROLE);

    return $user;
}

function availableVehicle(array $attributes = []): Vehicle
{
    $vehicle = Vehicle::create(array_merge([
        'name' => 'Toyota Vios GR-S',
        'brand' => 'Toyota',
        'model' => 'Vios GR-S',
        'plate_number' => 'TST-'.Str::upper(Str::random(6)),
        'price_per_day' => 3500,
        'seats' => 5,
        'transmission' => 'Automatic',
        'fuel_type' => 'Gasoline',
        'color' => 'White',
        'status' => VehicleStatus::Available,
        'description' => 'Test vehicle',
    ], $attributes));

    $vehicle->images()->create([
        'image_path' => 'https://images.unsplash.com/photo-1549924231-f129b911e442',
        'is_primary' => true,
    ]);

    return $vehicle;
}

function vehicleManagerUser(): User
{
    $user = User::factory()->create();
    $user->assignRole(UserRole::Admin->value);

    return $user;
}

function vehicleSignatureDataUrl(): string
{
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
}

function vehicleConditionPayload(array $overrides = []): array
{
    $checklist = collect(VehicleInspectionDefinition::checklist())
        ->map(fn (array $items) => collect($items)->mapWithKeys(fn (string $label, string $key) => [$key => true])->all())
        ->all();

    return array_replace_recursive([
        'odometer' => 1250,
        'fuel_level' => 6,
        'comments' => 'Initial inspection completed.',
        'checklist' => $checklist,
        'markers' => [],
        'signature_data' => vehicleSignatureDataUrl(),
    ], $overrides);
}
