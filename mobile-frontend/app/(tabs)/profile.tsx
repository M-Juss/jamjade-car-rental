import { CustomerTabScreen } from '@/components/customer/CustomerTabScreen';

export default function ProfileScreen() {
  return (
    <CustomerTabScreen
      accent="#17315F"
      actions={[
        { icon: 'account-circle-outline', label: 'Manage customer information' },
        { icon: 'file-document-outline', label: 'Update documents' },
        { icon: 'cog-outline', label: 'Open account settings' },
      ]}
      icon="account-circle-outline"
      stats={[
        { label: 'Verified docs', value: '3' },
        { label: 'Member tier', value: 'Gold' },
      ]}
      subtitle="Customer information, documents, preferences, and account settings."
      summaryText="Keep your personal details and rental requirements ready for faster bookings."
      summaryTitle="Customer profile"
      title="Profile"
    />
  );
}
