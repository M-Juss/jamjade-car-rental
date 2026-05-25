import { CustomerTabScreen } from '@/components/customer/CustomerTabScreen';

export default function NotificationScreen() {
  return (
    <CustomerTabScreen
      accent="#E0507A"
      actions={[
        { icon: 'bell-outline', label: 'See all app notifications' },
        { icon: 'calendar-clock', label: 'Read booking reminders' },
        { icon: 'message-text-outline', label: 'Check service messages' },
      ]}
      icon="bell-outline"
      stats={[
        { label: 'Unread', value: '4' },
        { label: 'Today', value: '7' },
      ]}
      subtitle="A clear inbox for every rental, booking, payment, and service update."
      summaryText="Review all notifications and keep important JamJade updates easy to find."
      summaryTitle="All notifications"
      title="Notifications"
    />
  );
}
