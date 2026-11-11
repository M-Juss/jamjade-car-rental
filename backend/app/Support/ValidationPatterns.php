<?php

namespace App\Support;

final class ValidationPatterns
{
    public const PERSON_NAME = '/^[\p{L}\p{M}]+(?:[ \x{27}\x{2019}\x{2D}][\p{L}\p{M}]+)*$/u';

    public const VEHICLE_TEXT = '/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .&\x{27}\x{2019}()\/+-]*$/u';

    public const VEHICLE_COLOR = '/^[\p{L}\p{M}]+(?:[ \x{2F}\x{2D}][\p{L}\p{M}]+)*$/u';

    public const PLATE_NUMBER = '/^[A-Z0-9][A-Z0-9 -]*$/';

    public const DECIMAL_2 = '/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/';

    public const DECIMAL_3 = '/^(?:\d+(?:\.\d{0,3})?|\.\d{1,3})$/';

    public const SIGNED_DECIMAL = '/^-?(?:\d+(?:\.\d{1,8})?|\.\d{1,8})$/';
}
