<?php

namespace App\Enums;

enum TelematicsEventType: string
{
    case TripStarted = 'trip_started';
    case TripPaused = 'trip_paused';
    case TripResumed = 'trip_resumed';
    case TripEnded = 'trip_ended';
    case GeofenceEnter = 'geofence_enter';
    case GeofenceExit = 'geofence_exit';
    case GpsUnavailable = 'gps_unavailable';
    case LocationPermissionRevoked = 'location_permission_revoked';
    case DeviceOrientationChanged = 'device_orientation_changed';
    case TelemetryInterrupted = 'telemetry_interrupted';
    case HarshAcceleration = 'harsh_acceleration';
    case HarshBraking = 'harsh_braking';
    case HarshLeftTurn = 'harsh_left_turn';
    case HarshRightTurn = 'harsh_right_turn';

    public function label(): string
    {
        return match ($this) {
            self::TripStarted => 'Trip started',
            self::TripPaused => 'Trip paused',
            self::TripResumed => 'Trip resumed',
            self::TripEnded => 'Trip ended',
            self::GeofenceEnter => 'Geofence entered',
            self::GeofenceExit => 'Geofence exit',
            self::GpsUnavailable => 'GPS unavailable',
            self::LocationPermissionRevoked => 'Location permission revoked',
            self::DeviceOrientationChanged => 'Device orientation changed',
            self::TelemetryInterrupted => 'Telemetry interrupted',
            self::HarshAcceleration => 'Harsh acceleration',
            self::HarshBraking => 'Harsh braking',
            self::HarshLeftTurn => 'Harsh left turn',
            self::HarshRightTurn => 'Harsh right turn',
        };
    }
}
