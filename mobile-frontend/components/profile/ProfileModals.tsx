import { X } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  type CustomerProfile,
  type EditProfileForm,
} from '@/lib/profile/profile-data';
import {
  sanitizePersonName,
  sanitizePhoneNumber,
} from '@/forms/validation';

import { cx } from '@/components/profile/ProfileCards';

function SheetModal({
  children,
  onClose,
  title,
  visible,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/35">
        <Pressable accessibilityRole="button" className="flex-1" onPress={onClose} />
        <View
          className="max-h-[88%] rounded-t-[32px] bg-[#F8FAFF] px-5 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom + 18, 28) }}>
          <View className="mb-4 items-center">
            <View className="h-1.5 w-12 rounded-full bg-[#CBD5E1]" />
          </View>
          <View className="mb-4 flex-row items-center gap-3">
            <Text className="min-w-0 flex-1 text-[22px] font-black text-[#17315F]">{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close modal"
              hitSlop={8}
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-white">
              <X size={19} color="#64748B" strokeWidth={2.45} />
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormField({
  error,
  keyboardType,
  label,
  maxLength,
  onChangeText,
  secureTextEntry = false,
  value,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  maxLength?: number;
  secureTextEntry?: boolean;
  error?: string;
}) {
  return (
    <View>
      <Text className="mb-2 text-[12px] font-black uppercase tracking-[0.4px] text-[#6C7A96]">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        maxLength={maxLength}
        placeholderTextColor="#9AA4B8"
        secureTextEntry={secureTextEntry}
        className={cx(
          'min-h-[52px] rounded-[18px] border bg-white px-4 text-[14px] font-bold text-[#17315F]',
          error ? 'border-[#FCA5A5]' : 'border-[#DDE8FF]',
        )}
      />
      {error ? <Text className="mt-1.5 text-[11px] font-bold text-[#DC2626]">{error}</Text> : null}
    </View>
  );
}

export function EditProfileModal({
  onClose,
  onSave,
  profile,
  visible,
}: {
  profile: CustomerProfile;
  visible: boolean;
  onClose: () => void;
  onSave: (form: EditProfileForm) => void;
}) {
  const [form, setForm] = useState<EditProfileForm>({
    firstName: profile.firstName,
    lastName: profile.lastName,
    phoneNumber: profile.phoneNumber,
    address: profile.address,
    dateOfBirth: profile.dateOfBirth,
  });

  useEffect(() => {
    if (visible) {
      setForm({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phoneNumber: profile.phoneNumber,
        address: profile.address,
        dateOfBirth: profile.dateOfBirth,
      });
    }
  }, [profile, visible]);

  const updateForm = (key: keyof EditProfileForm, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  };

  return (
    <SheetModal title="Edit Profile" visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="gap-3">
          <FormField
            label="First Name"
            value={form.firstName}
            maxLength={100}
            onChangeText={(value) => updateForm('firstName', sanitizePersonName(value))}
          />
          <FormField
            label="Last Name"
            value={form.lastName}
            maxLength={100}
            onChangeText={(value) => updateForm('lastName', sanitizePersonName(value))}
          />
          <FormField
            label="Phone Number"
            value={form.phoneNumber}
            maxLength={11}
            onChangeText={(value) => updateForm('phoneNumber', sanitizePhoneNumber(value))}
            keyboardType="phone-pad"
          />
          <FormField label="Full Address" value={form.address} onChangeText={(value) => updateForm('address', value)} />
          <FormField
            label="Date of Birth"
            value={form.dateOfBirth}
            onChangeText={(value) => updateForm('dateOfBirth', value)}
          />
        </View>
        <View className="mt-5 flex-row gap-3">
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="min-h-[50px] flex-1 items-center justify-center rounded-full border border-[#DDE8FF] bg-white px-4">
            <Text className="text-[13px] font-black text-[#17315F]">Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onSave(form)}
            className="min-h-[50px] flex-1 items-center justify-center rounded-full bg-[#346EF6] px-4 shadow-md shadow-[#346EF6]/20">
            <Text className="text-[13px] font-black text-white">Save Changes</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SheetModal>
  );
}

export function ChangePasswordModal({ onClose, visible }: { visible: boolean; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!visible) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [visible]);

  return (
    <SheetModal title="Change Password" visible={visible} onClose={onClose}>
      <View className="gap-3">
        <FormField
          label="Current Password"
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <FormField
          label="New Password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <FormField
          label="Confirm Password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
      </View>
      <Text className="mt-4 rounded-[18px] bg-[#EEF4FF] px-4 py-3 text-[12px] font-semibold leading-5 text-[#346EF6]">
        Password changes are not available in the mobile app yet.
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled
        className="mt-5 min-h-[50px] items-center justify-center rounded-full bg-[#CBD5E1] px-5">
        <Text className="text-[13px] font-black text-white">Unavailable</Text>
      </Pressable>
    </SheetModal>
  );
}
