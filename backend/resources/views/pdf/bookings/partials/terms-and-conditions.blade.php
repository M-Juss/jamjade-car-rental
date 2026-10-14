<section class="terms-content">
    <div class="terms-section">
        <h2 class="terms-section-title">General Terms and Conditions</h2>
        <ol class="terms-list">
            <li>Gasoline must be refilled upon return of the unit to the same level as when it was endorsed.</li>
            <li>
                Twenty-four (24) hours is the minimum rental period per day. Excess time will be charged as follows:
                <ul>
                    <li>Sedan / Toyota Vios: PHP 200.00 per hour.</li>
                    <li>Van / Hiace / Innova / Fortuner: PHP 300.00 per hour.</li>
                </ul>
            </li>
            @if ($booking->deliveryQuote || $booking->terms_version >= '2026-10-12')
                <li>Garage pickup and return are free. Delivery and any staff-approved toll are charged at the accepted quote amount.</li>
            @else
                <li>Pickup and delivery of the unit to the renter will be charged PHP 900.00.</li>
            @endif
            <li>A rental extension is allowed only after surrendering the unit first and paying the remaining balance.</li>
            <li>The rented vehicle must be clean when returned to the company.</li>
            <li>Pets are not allowed. A PHP 1,000.00 fee will be charged for violations.</li>
            <li>Smoking is strictly prohibited.</li>
            <li>All transactions, including additional charges, must be completed online. All payments must be made payable to Mr. Alvin N. Macalam.</li>
            <li>Cancellation of any vehicle booking or reservation is not allowed due to the possible loss of vehicle availability and profit.</li>
            <li>A down payment upon delivery of the unit is acceptable.</li>
            <li>For down-payment rentals, the remaining balance must be completed within five (5) days from the reservation date or before the scheduled rental date, whichever comes first.</li>
        </ol>
    </div>

    <div class="terms-section">
        <h2 class="terms-section-title">Terms and Conditions for Self-Drive Renters</h2>
        <ol class="terms-list">
            <li>For self-drive renters, all damages will be charged to the renter.</li>
            <li>A refundable participation fee of PHP 10,000.00 must be paid in advance for any damages incurred in an accident.</li>
            <li>A rental fee will be charged for each day the vehicle cannot be used for business because of repairs.</li>
            <li>Physical verification of documentation is required once the vehicle has been delivered.</li>
            <li>Clutch damage will be charged PHP 9,000.00.</li>
            <li>Before operating the vehicle, the renter must calibrate the telematics in the mobile application. Telematics must be active while the vehicle is in motion and may be paused when the renter is outside the vehicle.</li>
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
        </ol>
    </div>
</section>
