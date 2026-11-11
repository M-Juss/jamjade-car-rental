<?php

namespace App\Enums;

enum UserRole: string
{
    case Owner = 'owner';

    case Admin = 'admin';
    case Staff = 'staff';
    case Driver = 'driver';
    case Customer = 'customer';
}
