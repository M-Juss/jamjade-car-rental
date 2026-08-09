import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import {
  Cake,
  CheckCircle2,
  FileText,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { useAutoHideCustomerTabBar } from '@/components/navigation/CustomerTabBarVisibilityContext';
import {
  DocumentRequirementRow,
  ProfileActionRow,
  ProfileEditButton,
  ProfileInfoRow,
  ProfileKpiGrid,
  ProfileSectionCard,
} from '@/components/profile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ProfileEmergencyContactForm } from '@/forms/profile/ProfileEmergencyContactForm';
import { ProfilePersonalInformationForm } from '@/forms/profile/ProfilePersonalInformationForm';
import {
  CUSTOMER_DOCUMENT_DEFINITIONS,
  hasDocumentDraft,
} from '@/lib/customer/document-verification';
import {
  getCustomerFullName,
  getCustomerInitials,
  useCustomer,
} from '@/lib/customer/customer-store';
import { formatDisplayDate } from '@/utils/calculateAge';
import { useAuth } from '@/providers/AuthProvider';

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
  const { refreshProfile, signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isPersonalEditorOpen, setIsPersonalEditorOpen] = useState(false);
  const [isEmergencyEditorOpen, setIsEmergencyEditorOpen] = useState(false);
  const fullName = getCustomerFullName(customer) || 'New Customer';
  const initials = getCustomerInitials(customer);
  const emergencyName = customer.emergencyContact.name || 'Not provided';
  const relationship = customer.emergencyContact.relationship || 'Not provided';
  const canVerifyDocuments = !customer.isBelow18;
  const requiredDocumentsVerified = CUSTOMER_DOCUMENT_DEFINITIONS
    .filter((document) => !document.optional || customer.documents.passportRequiredByAdmin)
    .every((document) => customer.documentStatuses[document.id] === 'verified');

  useFocusEffect(
    useCallback(() => {
      void refreshProfile().catch(() => undefined);
    }, [refreshProfile]),
  );

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        onScroll={handleTabScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View className="px-5" style={{ paddingBottom: 112 + insets.bottom, paddingTop: insets.top + 10 }}>
          <CustomerTabHeader description="Your profile and self-drive readiness." />

          <View className="mt-6 overflow-hidden rounded-[30px] border border-[#D6E5FF] bg-foreground p-5 shadow-xl shadow-foreground/15">
            <View className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/35" />
            <View className="flex-row items-start gap-4">
              <View className="h-[82px] w-[82px] items-center justify-center overflow-hidden rounded-[28px] border-2 border-surface/45 bg-surface/15">
                {customer.profilePicture ? (
                  <Image source={{ uri: customer.profilePicture }} resizeMode="cover" className="h-full w-full" />
                ) : (
                  <View className="h-full w-full items-center justify-center bg-muted">
                    <Text className="text-[24px] font-black text-primary">{initials}</Text>
                  </View>
                )}
              </View>
              <View className="min-w-0 flex-1">
                <StatusBadge status={customer.selfDriveStatus} />
                <Text className="mt-3 text-[24px] font-black leading-[28px] text-surface" numberOfLines={2}>
                  {fullName}
                </Text>
                <Text className="mt-1 text-[13px] font-semibold leading-5 text-[#D8E5FF]" numberOfLines={1}>
                  {customer.email}
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-5">
            <ProfileKpiGrid
              joinedDate={formatDisplayDate(customer.joinedAt)}
              successfulBookings={customer.successfulBookings}
              totalSpent={customer.totalSpent}
            />
          </View>

          <View className="mt-6">
            <ProfileSectionCard
              headerAction={<ProfileEditButton onPress={() => setIsPersonalEditorOpen(true)} />}
              icon={ShieldCheck}
              title="Personal Information">
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
            <ProfileSectionCard
              headerAction={
                canVerifyDocuments ? (
                  <ProfileEditButton
                    icon={requiredDocumentsVerified ? CheckCircle2 : ShieldCheck}
                    label={requiredDocumentsVerified ? 'Verified' : 'Verify'}
                    onPress={() => router.push('/profile/documents' as Href)}
                    tone={requiredDocumentsVerified ? 'success' : 'default'}
                  />
                ) : null
              }
              icon={FileText}
              title="Self-drive Verification">
              <View>
                {CUSTOMER_DOCUMENT_DEFINITIONS.map((document, index) => (
                  <DocumentRequirementRow
                    compact
                    definition={document}
                    hasDraft={hasDocumentDraft(document.id, customer.documents)}
                    isLast={index === CUSTOMER_DOCUMENT_DEFINITIONS.length - 1}
                    key={document.id}
                    status={customer.documentStatuses[document.id]}
                  />
                ))}
              </View>
              <View className="mt-3 gap-3">
                {!customer.isProfileComplete ? (
                  <ProfileActionRow
                    icon={UserRound}
                    label="Complete missing profile info"
                    onPress={() => router.push('/onboarding/basic-info' as Href)}
                  />
                ) : null}
                {customer.isBelow18 ? (
                  <View className="rounded-[20px] border border-warning-border bg-warning-surface px-4 py-3">
                    <Text className="text-[12px] font-bold leading-5 text-warning">
                      Booking is unavailable because JamJade only accepts bookings from customers aged 18 or older.
                    </Text>
                  </View>
                ) : null}
              </View>
            </ProfileSectionCard>
          </View>

          <View className="mt-5">
            <ProfileSectionCard
              headerAction={<ProfileEditButton onPress={() => setIsEmergencyEditorOpen(true)} />}
              icon={UsersRound}
              title="Emergency Contact">
              <ProfileInfoRow icon={UserRound} label="Contact Name" value={emergencyName} />
              <ProfileInfoRow icon={Phone} label="Contact Number" value={valueOrMissing(customer.emergencyContact.contactNumber)} />
              <ProfileInfoRow icon={UsersRound} isLast label="Relationship" value={relationship} />
            </ProfileSectionCard>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isLoggingOut}
            onPress={async () => {
              if (isLoggingOut) {
                return;
              }

              setIsLoggingOut(true);

              try {
                await signOut();
                router.replace('/login' as Href);
              } finally {
                setIsLoggingOut(false);
              }
            }}
            className="mt-8 min-h-[54px] flex-row items-center justify-center gap-2 rounded-full border border-destructive-border bg-destructive-surface px-5">
            <LogOut size={17} color="#DC2626" strokeWidth={2.45} />
            <Text className="text-[13px] font-black text-destructive">
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <ProfilePersonalInformationForm
        customer={customer}
        onClose={() => setIsPersonalEditorOpen(false)}
        visible={isPersonalEditorOpen}
      />
      <ProfileEmergencyContactForm
        contact={customer.emergencyContact}
        onClose={() => setIsEmergencyEditorOpen(false)}
        visible={isEmergencyEditorOpen}
      />
    </View>
  );
}
