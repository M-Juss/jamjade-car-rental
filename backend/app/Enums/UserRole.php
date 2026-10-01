<?php

namespace App\Enums;

enum UserRole: string
{
    case Admin = 'admin';
    case Staff = 'staff';
    case Driver = 'driver';
    case Customer = 'customer';
}
