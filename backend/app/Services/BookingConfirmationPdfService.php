<?php

namespace App\Services;

use App\Models\Booking;
use Barryvdh\DomPDF\Facade\Pdf as PdfFacade;
use Barryvdh\DomPDF\PDF as DomPdf;
use Illuminate\Http\Response;

class BookingConfirmationPdfService
{
    public function __construct(
        private readonly BookingConfirmationViewData $viewData
    ) {}

    public function make(Booking $booking): DomPdf
    {
        $booking->loadMissing(['user.customerProfile', 'vehicle', 'payments']);

        return PdfFacade::loadView('pdf.bookings.successful-booking', [
            'booking' => $booking,
            'confirmation' => $this->viewData->make($booking),
        ])->setPaper('a4', 'portrait');
    }

    public function render(Booking $booking): string
    {
        return $this->make($booking)->output();
    }

    public function download(Booking $booking): Response
    {
        return $this->make($booking)->download($this->filename($booking));
    }

    public function filename(Booking $booking): string
    {
        $reference = $booking->booking_code ?: (string) $booking->getKey();

        return "Jamjade-Booking-Confirmation-{$reference}.pdf";
    }
}
