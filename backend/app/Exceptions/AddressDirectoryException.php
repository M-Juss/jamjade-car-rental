<?php

namespace App\Exceptions;

use RuntimeException;

class AddressDirectoryException extends RuntimeException
{
    public function __construct(
        string $message = 'The address directory is temporarily unavailable.'
    ) {
        parent::__construct($message);
    }
}
