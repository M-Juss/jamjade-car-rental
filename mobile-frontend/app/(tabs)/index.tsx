import { useAutoHideCustomerTabBar } from '@/components/navigation/CustomerTabBarVisibilityContext';
import { VehicleCatalogScreen } from '@/screens/browse/VehicleCatalogScreen';

export default function BrowseScreen() {
  const handleTabScroll = useAutoHideCustomerTabBar();

  return <VehicleCatalogScreen mode="customer" onScroll={handleTabScroll} />;
}
