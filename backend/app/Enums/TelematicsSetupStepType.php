<?php

namespace App\Enums;

enum TelematicsSetupStepType: string
{
    case DeviceCheck = 'device_check';
    case MotionPermission = 'motion_permission';
    case LocationPermission = 'location_permission';
    case BackgroundLocation = 'background_location';
    case GpsCheck = 'gps_check';
    case GeofenceCheck = 'geofence_check';
    case PhoneMount = 'phone_mount';
    case StationaryCalibration = 'stationary_calibration';
    case ForwardCalibration = 'forward_calibration';
    case BrakingCalibration = 'braking_calibration';
    case LeftTurnCalibration = 'left_turn_calibration';
    case RightTurnCalibration = 'right_turn_calibration';
}
