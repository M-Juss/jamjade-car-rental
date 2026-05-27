import { useRouter, type Href } from 'expo-router';
import {
  Cake,
  CreditCard,
  FileText,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { useAutoHideCustomerTabBar } from '@/components/navigation/CustomerTabBarVisibilityContext';
import {
  ChangePasswordModal,
  EditProfileModal,
  ProfileActionRow,
  ProfileErrorState,
  ProfileHeaderCard,
  ProfileInfoRow,
  ProfileLoadingState,
  ProfileSectionCard,
  ProfileSummaryGrid,
} from '@/components/profile';
import {
  getFullName,
  mockCustomerProfile,
  type CustomerProfile,
  type EditProfileForm,
} from '@/lib/profile/profile-data';

type ProfileLoadState = 'ready' | 'loading' | 'error';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const handleTabScroll = useAutoHideCustomerTabBar();
  const [profile, setProfile] = useState<CustomerProfile>(mockCustomerProfile);
  const [profileLoadState, setProfileLoadState] = useState<ProfileLoadState>('ready');
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const fullName = getFullName(profile);

  const handleSaveProfile = (form: EditProfileForm) => {
    setProfile((currentProfile) => ({
      ...currentProfile,
      ...form,
    }));
    setIsEditProfileOpen(false);
  };

  return (
    <View className="flex-1 bg-[#F8FAFF]">
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        onScroll={handleTabScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View className="px-5" style={{ paddingBottom: 112 + insets.bottom, paddingTop: insets.top + 10 }}>
          <CustomerTabHeader description="Keep your account documents ready." />

          {profileLoadState === 'loading' ? (
            <ProfileLoadingState />
          ) : profileLoadState === 'error' ? (
            <ProfileErrorState onRetry={() => setProfileLoadState('ready')} />
          ) : (
            <>
              <View className="mt-6">
                <ProfileHeaderCard profile={profile} />
              </View>

              <View className="mt-5">
                <ProfileSummaryGrid profile={profile} />
              </View>

              <View className="mt-6">
                <ProfileSectionCard icon={ShieldCheck} title="Personal Information">
                  <ProfileInfoRow icon={UserRound} label="Full Name" value={fullName} onPress={() => setIsEditProfileOpen(true)} />
                  <ProfileInfoRow icon={Mail} label="Email" value={profile.email} />
                  <ProfileInfoRow icon={Phone} label="Phone Number" value={profile.phoneNumber} onPress={() => setIsEditProfileOpen(true)} />
                  <ProfileInfoRow icon={MapPin} label="Full Address" value={profile.address} onPress={() => setIsEditProfileOpen(true)} />
                  <ProfileInfoRow
                    icon={Cake}
                    isLast
                    label="Date of Birth"
                    value={profile.dateOfBirth}
                    onPress={() => setIsEditProfileOpen(true)}
                  />
                </ProfileSectionCard>
              </View>

              <View className="mt-5">
                <ProfileSectionCard icon={CreditCard} title="Account Actions">
                  <View className="gap-3">
                    <ProfileActionRow icon={Pencil} label="Edit Profile" onPress={() => setIsEditProfileOpen(true)} />
                    <ProfileActionRow icon={KeyRound} label="Change Password" onPress={() => setIsChangePasswordOpen(true)} />
                    <ProfileActionRow
                      icon={FileText}
                      label="Manage Documents"
                      onPress={() => router.push('/profile/documents' as Href)}
                    />
                  </View>
                </ProfileSectionCard>
              </View>

              <Text className="mt-4 text-center text-[11px] font-bold text-[#91A0B8]">Mock profile data only</Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Logout"
                onPress={() => router.replace('/landing' as Href)}
                className="mt-8 min-h-[54px] flex-row items-center justify-center gap-2 rounded-full border border-[#FECACA] bg-[#FEF2F2] px-5">
                <LogOut size={18} color="#DC2626" strokeWidth={2.55} />
                <Text className="text-[13px] font-black text-[#DC2626]">Logout</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      <EditProfileModal
        profile={profile}
        visible={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        onSave={handleSaveProfile}
      />
      <ChangePasswordModal visible={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
    </View>
  );
}
