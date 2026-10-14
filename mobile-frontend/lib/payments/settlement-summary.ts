import type { Booking } from '@/types/booking';

export type SettlementSummary = {
  amount: number;
  amountLabel: string;
  description: string;
  buttonLabel: string;
  charges: Booking['additionalCharges'];
  rentalBalance: number;
  showBreakdown: boolean;
  deadline: string | null;
};

export const formatPaymentAmount = (amount: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

export function getSettlementSummary(booking: Booking, responsibility: 'customer' | 'driver' = 'customer'): SettlementSummary {
  const charges = booking.additionalCharges.filter(
    (charge) => charge.responsibility === responsibility && charge.outstandingAmount > 0,
  );
  const chargeCents = charges.reduce((total, charge) => total + Math.round(charge.outstandingAmount * 100), 0);
  const amountCents = responsibility === 'driver' ? chargeCents : Math.round(booking.remainingBalance * 100);
  const amount = Math.max(amountCents, 0) / 100;
  const rentalBalance = Math.max(amountCents - chargeCents, 0) / 100;
  const hasReliableBreakdown = chargeCents <= amountCents;
  const isChargeOnly = chargeCents > 0 && chargeCents === amountCents;
  const isMixed = chargeCents > 0 && rentalBalance > 0;
  const deadline = responsibility === 'customer' && rentalBalance > 0 &&
    (booking.status === 'Pending' || booking.status === 'Confirmed') &&
    booking.paymentStatus === 'Partially Paid' && booking.downPayment > 0 && booking.balanceDueAt
    ? booking.balanceDueAt : null;

  return {
    amount,
    amountLabel: amount <= 0 ? 'No Outstanding Balance' : isChargeOnly ? 'Additional Charges' :
      isMixed || !hasReliableBreakdown ? 'Amount Due' : 'Remaining Rental Balance',
    description: amount <= 0 ? 'You have no outstanding balance for this booking.' :
      !hasReliableBreakdown ? 'This payment settles the outstanding balance recorded for your booking.' :
      isChargeOnly ? 'This payment covers additional charges recorded for your rental.' :
      isMixed ? 'This payment covers your remaining rental balance and the additional charges below.' :
      'This payment settles the remaining cost of your rental.',
    buttonLabel: isChargeOnly ? 'Pay Additional Charges' : isMixed || !hasReliableBreakdown ? 'Pay Outstanding Balance' : 'Pay Rental Balance',
    charges: hasReliableBreakdown ? charges : [],
    rentalBalance,
    showBreakdown: hasReliableBreakdown && chargeCents > 0,
    deadline,
  };
}
