import { CustomerTabScreen } from '@/components/customer/CustomerTabScreen';

export default function HistoryScreen() {
  return (
    <CustomerTabScreen
      accent="#1F8A70"
      actions={[
        { icon: 'calendar-clock', label: 'Track upcoming bookings' },
        { icon: 'file-document-outline', label: 'View rental records' },
        { icon: 'receipt', label: 'Open payments and invoices' },
      ]}
      icon="history"
      stats={[
        { label: 'Upcoming', value: '2' },
        { label: 'Completed', value: '18' },
      ]}
      subtitle="Keep booking tracking and rental records in one place."
      summaryText="Review reservations, pickup status, return notes, and previous rental activity."
      summaryTitle="Your booking timeline"
      title="Rental history"
    />
  );
}
