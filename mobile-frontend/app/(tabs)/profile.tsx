import { useRouter, type Href } from 'expo-router';
import {
  Cake,
  FileText,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react-native';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { useAutoHideCustomerTabBar } from '@/components/navigation/CustomerTabBarVisibilityContext';
import {
  ProfileActionRow,
  ProfileInfoRow,
  ProfileSectionCard,
} from '@/components/profile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  getCustomerFullName,
  getCustomerInitials,
  getCustomerStatusLabel,
  useCustomer,
} from '@/lib/customer/customer-store';
import { formatDisplayDate } from '@/utils/calculateAge';

function valueOrMissing(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return 'Not provided';
  }

  return String(value);
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const handleTabScroll = useAutoHideCustomerTabBar();
  const customer = useCustomer();
  const fullName = getCustomerFullName(customer) || 'New Customer';
  const initials = getCustomerInitials(customer);
  const emergencyName = customer.emergencyContact.name || 'Not provided';
  const relationship = customer.emergencyContact.relationship || 'Not provided';
  const documentStatus = customer.documentVerificationStatus
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
  const canVerifyDocuments = !customer.isBelow18 && customer.selfDriveStatus !== 'verified';

  return (
    <View className="flex-1 bg-[#F8FAFF]">
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        onScroll={handleTabScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View className="px-5" style={{ paddingBottom: 112 + insets.bottom, paddingTop: insets.top + 10 }}>
          <CustomerTabHeader description="Your customer profile and self-drive readiness." />

          <View className="mt-6 overflow-hidden rounded-[30px] border border-[#D6E5FF] bg-[#17315F] p-5 shadow-xl shadow-[#17315F]/15">
            <View className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#346EF6]/35" />
            <View className="flex-row items-start gap-4">
              <View className="h-[82px] w-[82px] items-center justify-center overflow-hidden rounded-[28px] border-2 border-white/45 bg-white/15">
                {customer.profilePicture ? (
                  <Image source={{ uri: customer.profilePicture }} resizeMode="cover" className="h-full w-full" />
                ) : (
                  <View className="h-full w-full items-center justify-center bg-[#EEF4FF]">
                    <Text className="text-[24px] font-black text-[#346EF6]">{initials}</Text>
                  </View>
                )}
              </View>
              <View className="min-w-0 flex-1">
                <StatusBadge status={customer.selfDriveStatus} />
                <Text className="mt-3 text-[24px] font-black leading-[28px] text-white" numberOfLines={2}>
                  {fullName}
                </Text>
                <Text className="mt-1 text-[13px] font-semibold leading-5 text-[#D8E5FF]" numberOfLines={1}>
                  {customer.email}
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-5 flex-row gap-2.5">
            <View className="min-h-[104px] flex-1 rounded-[22px] border border-[#E6EEFF] bg-white p-3.5 shadow-md shadow-[#17315F]/5">
              <Text className="text-[20px] font-black text-[#17315F]">
                {customer.isProfileComplete ? 'Complete' : 'Missing'}
              </Text>
              <Text className="mt-1 text-[11px] font-bold leading-4 text-[#6C7A96]">Profile completion</Text>
            </View>
            <View className="min-h-[104px] flex-1 rounded-[22px] border border-[#E6EEFF] bg-white p-3.5 shadow-md shadow-[#17315F]/5">
              <Text className="text-[20px] font-black text-[#17315F]">{valueOrMissing(customer.age)}</Text>
              <Text className="mt-1 text-[11px] font-bold leading-4 text-[#6C7A96]">Computed age</Text>
            </View>
            <View className="min-h-[104px] flex-1 rounded-[22px] border border-[#E6EEFF] bg-white p-3.5 shadow-md shadow-[#17315F]/5">
              <Text className="text-[15px] font-black leading-5 text-[#17315F]" numberOfLines={2}>
                {getCustomerStatusLabel(customer)}
              </Text>
              <Text className="mt-1 text-[11px] font-bold leading-4 text-[#6C7A96]">Self-drive status</Text>
            </View>
          </View>

          <View className="mt-6">
            <ProfileSectionCard icon={ShieldCheck} title="Personal Information">
              <ProfileInfoRow icon={UserRound} label="Full Name" value={fullName} />
              <ProfileInfoRow icon={Mail} label="Email" value={customer.email} />
              <ProfileInfoRow icon={Phone} label="Contact Number" value={valueOrMissing(customer.contactNumber)} />
              <ProfileInfoRow
                icon={Cake}
                label="Birthdate and Age"
                value={`${customer.birthdate ? formatDisplayDate(customer.birthdate) : 'Not provided'} | ${valueOrMissing(customer.age)} years old`}
              />
              <ProfileInfoRow icon={MapPin} isLast label="Address" value={valueOrMissing(customer.address)} />
            </ProfileSectionCard>
          </View>

          <View className="mt-5">
            <ProfileSectionCard icon={UsersRound} title="Emergency Contact">
              <ProfileInfoRow icon={UserRound} label="Contact Name" value={emergencyName} />
              <ProfileInfoRow icon={Phone} label="Contact Number" value={valueOrMissing(customer.emergencyContact.contactNumber)} />
              <ProfileInfoRow icon={UsersRound} isLast label="Relationship" value={relationship} />
            </ProfileSectionCard>
          </View>

          <View className="mt-5">
            <ProfileSectionCard icon={FileText} title="Self-drive Verification">
              <ProfileInfoRow icon={ShieldCheck} label="Self-drive Status" value={getCustomerStatusLabel(customer)} />
              <ProfileInfoRow icon={FileText} isLast label="Document Verification" value={documentStatus} />
              <View className="mt-4 gap-3">
                {!customer.isProfileComplete ? (
                  <ProfileActionRow
                    icon={UserRound}
                    label="Complete missing profile info"
                    onPress={() => router.push('/onboarding/basic-info' as Href)}
                  />
                ) : null}
                {canVerifyDocuments ? (
                  <ProfileActionRow
                    icon={FileText}
                    label={customer.documentVerificationStatus === 'pending-review' ? 'View pending documents' : 'Verify documents'}
                    onPress={() => router.push('/onboarding/document-verification' as Href)}
                  />
                ) : null}
                {customer.isBelow18 ? (
                  <View className="rounded-[20px] border border-[#FED7AA] bg-[#FFF7ED] px-4 py-3">
                    <Text className="text-[12px] font-bold leading-5 text-[#806128]">
                      Self-drive verification is not available for customers below 18.
                    </Text>
                  </View>
                ) : null}
              </View>
            </ProfileSectionCard>
          </View>

          <Text className="mt-4 text-center text-[11px] font-bold text-[#91A0B8]">Mock customer data only</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/landing' as Href)}
            className="mt-8 min-h-[54px] items-center justify-center rounded-full border border-[#DDE8FF] bg-white px-5">
            <Text className="text-[13px] font-black text-[#17315F]">Back to Landing</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
