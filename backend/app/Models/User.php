<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'phone_number',
        'password',
        'email_verified_at',
        'phone_verified_at',
        'is_active',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    public function customerProfile(): HasOne
    {
        return $this->hasOne(CustomerProfile::class);
    }

    public function emergencyContacts(): HasMany
    {
        return $this->hasMany(EmergencyContact::class);
    }

    public function completeEmergencyContacts(): HasMany
    {
        return $this->emergencyContacts()
            ->whereRaw("TRIM(name) <> ''")
            ->whereRaw("TRIM(relationship) <> ''")
            ->whereRaw("TRIM(phone_number) <> ''");
    }

    public function hasCompleteEmergencyContact(): bool
    {
        return $this->complete_emergency_contacts_exists ?? $this->completeEmergencyContacts()->exists();
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(CustomerDocument::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function responsibleAdditionalCharges(): HasMany
    {
        return $this->hasMany(BookingAdditionalCharge::class, 'responsible_user_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function createdVehicleInspections(): HasMany
    {
        return $this->hasMany(VehicleInspection::class, 'created_by');
    }

    public function vehicleInspectionSignatures(): HasMany
    {
        return $this->hasMany(VehicleInspectionSignature::class);
    }

    public function createdGeofences(): HasMany
    {
        return $this->hasMany(Geofence::class, 'created_by');
    }

    public function assignedBookingGeofences(): HasMany
    {
        return $this->hasMany(BookingGeofence::class, 'assigned_by');
    }

    public function telematicsSetupSteps(): HasMany
    {
        return $this->hasMany(TelematicsSetupStep::class, 'actor_user_id');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
            'password' => 'hashed',
        ];
    }
}
