import { CustomerTabScreen } from '@/components/customer/CustomerTabScreen';

export default function TelematicsScreen() {
  return (
    <CustomerTabScreen
      accent="#6D47F8"
      actions={[
        { icon: 'steering', label: 'Monitor active trip status' },
        { icon: 'speedometer', label: 'Check driving and distance signals' },
        { icon: 'map-marker-path', label: 'Review current route activity' },
      ]}
      icon="steering"
      stats={[
        { label: 'Active trip', value: '1' },
        { label: 'Range left', value: '82%' },
      ]}
      subtitle="Monitor your active trip and driving signals."
      summaryText="Use this area while a rental is in progress to view driving, distance, and vehicle signals."
      summaryTitle="Live drive view"
      title="Telematics"
    />
  );
}
