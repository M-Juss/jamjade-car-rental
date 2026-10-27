import { floatingTabBarContentPadding } from '@/constants/layout';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import {
  Cake,
  CheckCircle2,
  FileText,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
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
import { ChangeEmailForm } from '@/forms/account/ChangeEmailForm';
import { ChangePasswordForm } from '@/forms/account/ChangePasswordForm';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { CUSTOMER_DOCUMENT_DEFINITIONS, hasDocumentDraft } from '@/lib/customer/document-verification';
import { getCustomerFullName, getCustomerInitials, useCustomer } from '@/lib/customer/customer-store';
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
  const customer = useCustomer();
  const { refreshProfile } = useAuth();
  const [isPersonalEditorOpen, setIsPersonalEditorOpen] = useState(false);
  const [isEmergencyEditorOpen, setIsEmergencyEditorOpen] = useState(false);
  const [isEmailEditorOpen, setIsEmailEditorOpen] = useState(false);
  const [isPasswordEditorOpen, setIsPasswordEditorOpen] = useState(false);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const toast = useFormToast();
  const fullName = getCustomerFullName(customer) || 'New Customer';
  const initials = getCustomerInitials(customer);
  const emergencyName = customer.emergencyContact.name || 'Not provided';
  const relationship = customer.emergencyContact.relationship || 'Not provided';
  const canVerifyDocuments = !customer.isBelow18;
  const requiredDocumentsVerified = CUSTOMER_DOCUMENT_DEFINITIONS.every(
    (document) => customer.documentStatuses[document.id] === 'verified',
  );

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
        showsVerticalScrollIndicator={false}>
        <View
          className="w-full max-w-[560px] self-center px-screen"
          style={{ paddingBottom: floatingTabBarContentPadding + insets.bottom, paddingTop: insets.top + 10 }}>
          <CustomerTabHeader title="Profile" showLogout />

          <View className="mt-3 overflow-hidden rounded-card border border-border bg-surface p-card">
            <View className="flex-row items-center gap-3">
              <View className="h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-field border border-border bg-muted">
                {customer.profilePicture && customer.profilePicture !== failedPhoto ? (
                  <Image
                    accessibilityLabel="Profile photo"
                    source={{ uri: customer.profilePicture }}
                    onError={() => setFailedPhoto(customer.profilePicture)}
                    resizeMethod="resize"
                    resizeMode="cover"
                    style={{ height: '100%', width: '100%' }}
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center bg-muted">
                    <Text className="font-sans text-[24px] font-semibold text-primary">{initials}</Text>
                  </View>
                )}
              </View>
              <View className="min-w-0 flex-1">
                <Text
                  className="font-sans text-[22px] font-semibold leading-[28px] text-foreground">
                  {fullName}
                </Text>
                <Text
                  className="font-sans mt-1 text-[13px] font-medium leading-[18px] text-secondary-foreground">
                  {customer.email}
                </Text>
                <View className="mt-2">
                  <StatusBadge status={customer.selfDriveStatus} />
                </View>
              </View>
            </View>
          </View>

          <View className="mt-4">
            <ProfileKpiGrid
              joinedDate={formatDisplayDate(customer.joinedAt)}
              successfulBookings={customer.successfulBookings}
              totalSpent={customer.totalSpent}
            />
          </View>

          <View className="mt-4">
            <ProfileSectionCard
              headerAction={<ProfileEditButton onPress={() => setIsPersonalEditorOpen(true)} />}
              icon={ShieldCheck}
              title="Personal Information">
              <ProfileInfoRow icon={UserRound} label="Full Name" value={fullName} />
              <ProfileInfoRow
                icon={Phone}
                label="Contact Number"
                value={valueOrMissing(customer.contactNumber)}
              />
              <ProfileInfoRow
                icon={Cake}
                label="Birthdate"
                value={customer.birthdate ? formatDisplayDate(customer.birthdate) : 'Not provided'}
              />
              <ProfileInfoRow icon={MapPin} isLast label="Address" value={valueOrMissing(customer.address)} />
            </ProfileSectionCard>
          </View>

          <View className="mt-4">
            <ProfileSectionCard icon={LockKeyhole} title="Account Information">
              <ProfileInfoRow
                accessibilityLabel="Change sign-in email"
                icon={Mail}
                label="Sign-in Email"
                value={customer.email}
                onPress={() => setIsEmailEditorOpen(true)}
              />
              <ProfileInfoRow
                accessibilityLabel="Change password"
                icon={LockKeyhole}
                isLast
                label="Password"
                value="Change password"
                onPress={() => setIsPasswordEditorOpen(true)}
              />
            </ProfileSectionCard>
          </View>

          <View className="mt-4">
            <ProfileSectionCard
              headerAction={
                canVerifyDocuments ? (
                  <ProfileEditButton
                    icon={requiredDocumentsVerified ? CheckCircle2 : ShieldCheck}
                    label={requiredDocumentsVerified ? 'Verified' : 'Verify'}
                    onPress={() => router.push('/profile/documents' as Href)}
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
                    <Text className="font-sans text-[12px] font-medium leading-5 text-warning">
                      Booking is unavailable because JamJade only accepts bookings from customers aged 18 or
                      older.
                    </Text>
                  </View>
                ) : null}
              </View>
            </ProfileSectionCard>
          </View>

          <View className="mt-4">
            <ProfileSectionCard
              headerAction={<ProfileEditButton onPress={() => setIsEmergencyEditorOpen(true)} />}
              icon={UsersRound}
              title="Emergency Contact">
              <ProfileInfoRow icon={UserRound} label="Contact Name" value={emergencyName} />
              <ProfileInfoRow
                icon={Phone}
                label="Contact Number"
                value={valueOrMissing(customer.emergencyContact.contactNumber)}
              />
              <ProfileInfoRow icon={UsersRound} isLast label="Relationship" value={relationship} />
            </ProfileSectionCard>
          </View>

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
      <ChangeEmailForm
        email={customer.email}
        visible={isEmailEditorOpen}
        onClose={() => setIsEmailEditorOpen(false)}
        onSaved={() => toast.showToast('Your sign-in email has been updated.', 'success')}
      />
      <ChangePasswordForm visible={isPasswordEditorOpen} onClose={() => setIsPasswordEditorOpen(false)} />
      <FormToast
        message={toast.message}
        title={toast.title}
        variant={toast.variant}
        onDismiss={toast.clearToast}
      />
    </View>
  );
}
