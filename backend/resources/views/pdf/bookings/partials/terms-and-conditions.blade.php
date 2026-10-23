@php($currentAgreement = in_array($confirmation['agreementVersion'] ?? '', ['2026-10-15-v2', '2026-10-17-v3', \App\Support\BookingAgreement::VERSION], true))
@php($deferredTollAgreement = in_array($confirmation['agreementVersion'] ?? '', ['2026-10-17-v3', \App\Support\BookingAgreement::VERSION], true))
<section class="terms-content">
    <div class="terms-section">
        <h2 class="terms-section-title">General Terms and Conditions</h2>
        <ol class="terms-list">
            <li>Gasoline must be refilled upon return of the unit to the same level as when it was endorsed.</li>
            <li>
                Twenty-four (24) hours is the minimum rental period per day.
                @if ($confirmation['lateReturnPolicy'])
                Late returns for this booking are charged as follows:
                <ul>
                    <li>{{ $confirmation['lateReturnPolicy']['seatBracket'] === 'up_to_5' ? '5 seats or fewer' : '6 seats or more' }}:
                        PHP {{ number_format($confirmation['lateReturnPolicy']['hourlyRate'], 2) }} per late hour.</li>
                    <li>Any late return costs at least one hour. After the first hour, remaining time rounds up only when it exceeds 30 minutes.</li>
                    <li>Long delays continue hourly without conversion to a daily rate. Physical receipt stops the late clock. Staff reviews additional charges.</li>
                </ul>
                @else
                Excess time is governed by the originally accepted rental agreement. Staff must review those terms before applying a late charge.
                @endif
            </li>
            @if ($deferredTollAgreement)
                <li>Garage pickup and return are free. Delivery is charged at the accepted quote amount. Actual tolls, if incurred, are billed after the rental.</li>
            @elseif ($confirmation['currentDeliveryTerms'])
                <li>Garage pickup and return are free. Delivery and any staff-approved toll are charged at the accepted quote amount.</li>
            @else
                <li>Pickup and delivery of the unit to the renter will be charged PHP 900.00.</li>
            @endif
            <li>A rental extension is allowed only after surrendering the unit first and paying the remaining balance.</li>
            <li>The rented vehicle must be clean when returned to the company.</li>
            <li>Pets are not allowed. A PHP 1,000.00 fee will be charged for violations.</li>
            <li>Smoking is strictly prohibited.</li>
            <li>All transactions, including additional charges, must be completed online. All payments must be made payable to Mr. Alvin N. Macalam.</li>
            @if ($currentAgreement)
            <li>A 50% down payment confirms the reservation. The remaining balance must be successfully paid before the rental start date begins. If the deadline is missed, the booking is cancelled and the down payment is forfeited.</li>
            <li>Customers may request cancellation and provide a reason. The owner decides refund eligibility and amount individually, subject to applicable law. Cancellation does not guarantee a refund.</li>
            <li>The vehicle is reserved for the agreed rental interval. Pickup may be arranged later within that interval. Late collection does not reduce the price or extend the return deadline.</li>
            <li>After the entire reserved period ends without collection or an approved cancellation, staff may record a no-show. All rental payments are non-refundable for a no-show, subject to applicable law.</li>
            @else
            <li>Cancellation of any vehicle booking or reservation is not allowed due to the possible loss of vehicle availability and profit.</li>
            <li>A down payment upon delivery of the unit is acceptable.</li>
            <li>For down-payment rentals, the remaining balance must be completed within five (5) days from the reservation date or before the scheduled rental date, whichever comes first.</li>
            @endif
        </ol>
    </div>

    <div class="terms-section">
        <h2 class="terms-section-title">Terms and Conditions for Self-Drive Renters</h2>
        <ol class="terms-list">
            <li>For self-drive renters, all damages will be charged to the renter.</li>
            @unless ($currentAgreement)
            <li>A refundable participation fee of PHP 10,000.00 must be paid in advance for any damages incurred in an accident.</li>
            @endunless
            <li>A rental fee will be charged for each day the vehicle cannot be used for business because of repairs.</li>
            <li>Physical verification of documentation is required once the vehicle has been delivered.</li>
            <li>Clutch damage will be charged PHP 9,000.00.</li>
            @if ($currentAgreement)
            <li>Before operating the vehicle, the renter must complete Jamjade’s staff-controlled telematics handover. Any future mobile monitoring requires clear consent and an authorized trip start.</li>
            @else
            <li>Before operating the vehicle, the renter must calibrate the telematics in the mobile application. Telematics must be active while the vehicle is in motion and may be paused when the renter is outside the vehicle.</li>
            @endif
        </ol>
    </div>

    <div class="terms-section">
        <h2 class="terms-section-title">Terms and Conditions for Renting a Car with Owner's Driver</h2>
        <ol class="terms-list">
            <li>
                Renting a car with the owner's driver includes an additional daily fee based on travel coverage:
                <ul>
                    <li>Within Metro Manila: PHP 700.00 per day.</li>
                    <li>Outside Metro Manila: PHP 1,000.00 per day.</li>
                </ul>
            </li>
            <li>The renter is responsible for the driver's accommodations.</li>
            @if (($confirmation['agreementVersion'] ?? '') === \App\Support\BookingAgreement::VERSION)
            <li>The assigned Driver may share the vehicle’s latest location with you and JamJade during the rental after agreeing to location sharing. Sharing starts after staff releases the vehicle and stops when the Driver stops sharing or staff receives the vehicle.</li>
            @endif
        </ol>
    </div>
</section>
