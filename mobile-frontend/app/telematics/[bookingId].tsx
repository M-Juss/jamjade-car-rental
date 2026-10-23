import { AuthenticatedOnly } from '@/components/auth/AuthenticatedOnly';
import { useAuth } from '@/providers/AuthProvider';
import { TelematicsHandoverScreen } from '@/screens/telematics/TelematicsHandoverScreen';

export default function TelematicsRentalRoute() {
  const { user } = useAuth();
  return <AuthenticatedOnly><TelematicsHandoverScreen key={user?.id ?? 'guest'} /></AuthenticatedOnly>;
}
