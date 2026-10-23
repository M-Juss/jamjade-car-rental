<section class="acknowledgement">
    <h2 class="acknowledgement-title">RENTER ACKNOWLEDGEMENT</h2>
    <p class="acknowledgement-copy">
        @if (($confirmation['formatVersion'] ?? 1) >= 3)
        This signature records the renter's acceptance of the rental details and Terms and Conditions at booking.
        @else
        I confirm that the information stated in this invoice and rental agreement is true and correct.
        I also acknowledge that I have read, understood, and agreed to the Terms and Conditions
        of Jamjade Car Rental.
        @endif
    </p>

    <table class="signature-table">
        <tr>
            <td>
                <div class="signature-value">{{ $confirmation['customer']['name'] ?: '&nbsp;' }}</div>
                <div class="signature-label">Renter's Full Name</div>
            </td>
            <td>
                <div class="signature-value">
                    @if ($confirmation['signatureImage'])
                        <img src="{{ $confirmation['signatureImage'] }}" alt="Renter signature">
                    @elseif ($confirmation['signatureText'])
                        {{ $confirmation['signatureText'] }}
                    @else
                        &nbsp;
                    @endif
                </div>
                <div class="signature-label">Signature</div>
            </td>
            <td>
                <div class="signature-value">
                    {{ $confirmation['termsAcceptedAt'] ? $formatDate($confirmation['termsAcceptedAt'], 'F j, Y') : ' ' }}
                </div>
                <div class="signature-label">Date Signed</div>
            </td>
        </tr>
    </table>
</section>
