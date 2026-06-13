<?php

namespace App\Enums;

enum TelematicsEventType: string
{
    case StartTrip = 'start_trip';
    case Pause = 'pause';
    case Resume = 'resume';
    case Location = 'location';
    case HarshBrake = 'harsh_brake';
    case SuddenAcceleration = 'sudden_acceleration';
    case SharpTurn = 'sharp_turn';
    case GeofenceExit = 'geofence_exit';
    case GpsLost = 'gps_lost';
    case Overspeed = 'overspeed';
    case AccidentHumanError = 'accident_human_error';
    case AccidentTechnicalError = 'accident_technical_error';

    public function label(): string
    {
        return match ($this) {
            self::StartTrip => 'Start trip',
            self::Pause => 'Pause',
            self::Resume => 'Resume',
            self::Location => 'Location update',
            self::HarshBrake => 'Harsh brake',
            self::SuddenAcceleration => 'Sudden acceleration',
            self::SharpTurn => 'Sharp turn',
            self::GeofenceExit => 'Geofence exit',
            self::GpsLost => 'GPS lost',
            self::Overspeed => 'Overspeed',
            self::AccidentHumanError => 'Accident - human error',
            self::AccidentTechnicalError => 'Accident - technical error',
        };
    }
}
