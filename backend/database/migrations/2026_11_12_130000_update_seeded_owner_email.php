<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            $owner = User::role('owner')->where('email', 'jamjade.carrentalofficial@gmail.com')->lockForUpdate()->first();
            if (! $owner) {
                return;
            }

            if (User::where('email', 'ofcl.jamjadecarrental@gmail.com')->exists()) {
                throw new RuntimeException('Cannot update the owner email because the intended address is already in use.');
            }

            $owner->update(['email' => 'ofcl.jamjadecarrental@gmail.com']);
        });
    }

    public function down(): void
    {
        // Keep the confirmed account email when rolling back database changes.
    }
};
