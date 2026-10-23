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
        return $this->makeRentalInformation($this->viewData->make($booking));
    }

    public function makeRentalInformation(array $confirmation): DomPdf
    {
        return $this->makeDocument(($confirmation['formatVersion'] ?? 1) >= 3
            ? 'pdf.bookings.rental-information' : 'pdf.bookings.legacy-invoice', $confirmation);
    }

    public function makeReceipt(array $confirmation): DomPdf
    {
        return $this->makeDocument('pdf.bookings.payment-receipt', $confirmation);
    }

    private function makeDocument(string $view, array $confirmation): DomPdf
    {
        $pdf = PdfFacade::loadView($view, compact('confirmation'))->setPaper('a4', 'portrait');
        $pdf->render();
        $dompdf = $pdf->getDomPDF();
        $canvas = $dompdf->getCanvas();
        $font = $dompdf->getFontMetrics()->getFont('Noto Sans', 'normal');
        $canvas->page_text($canvas->get_width() - 110, $canvas->get_height() - 35,
            'Page {PAGE_NUM} of {PAGE_COUNT}', $font, 7, [0.57, 0.63, 0.72]);

        return $pdf;
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
        $status = $booking->status->mobileLabel();

        return "{$reference} | {$status} | Rental Information.pdf";
    }
}
