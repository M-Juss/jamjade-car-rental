<table class="header-table">
    <tr>
        <td class="brand">
            <table class="brand-lockup">
                <tr>
                    @if ($logoDataUri)
                        <td class="brand-logo-cell">
                            <img class="brand-logo" src="{{ $logoDataUri }}" alt="Jamjade Car Rental logo">
                        </td>
                    @endif
                    <td class="brand-name-cell">
                        <div class="brand-name">JAMJADE CAR RENTAL</div>
                    </td>
                </tr>
            </table>
            <div class="accent-line"></div>
        </td>
        <td class="document-heading">
            <h1 class="document-title">{{ $documentTitle }}</h1>
            <div class="document-subtitle">{{ $documentSubtitle }}</div>
            <div class="document-meta">
                Date issued: <strong>{{ $formatDate($confirmation['issuedAt'], 'F j, Y') }}</strong><br>
                Booking reference: <strong>{{ $confirmation['bookingReference'] }}</strong>
            </div>
        </td>
    </tr>
</table>
<div class="header-divider"></div>
