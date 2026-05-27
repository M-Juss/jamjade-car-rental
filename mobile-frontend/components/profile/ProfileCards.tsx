import {
  BadgeCheck,
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  type LucideIcon,
  WalletCards,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Image, Pressable, Text, View, type PressableProps } from 'react-native';

import { formatPeso } from '@/lib/browse/pricing';
import {
  getFullName,
  getInitials,
  type CustomerProfile,
} from '@/lib/profile/profile-data';

export const profileColors = {
  brand: '#346EF6',
  ink: '#17315F',
};

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function ProfileHeaderCard({ profile }: { profile: CustomerProfile }) {
  const hasProfilePicture = Boolean(profile.profilePicture);

  return (
    <View className="overflow-hidden rounded-[30px] border border-[#D6E5FF] bg-[#17315F] shadow-xl shadow-[#17315F]/15">
      <View className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#346EF6]/35" />
      <View className="absolute -bottom-14 left-10 h-32 w-32 rounded-full bg-white/10" />
      <View className="p-5">
        <View className="flex-row items-start gap-4">
          <View className="h-[82px] w-[82px] items-center justify-center overflow-hidden rounded-[28px] border-2 border-white/45 bg-white/15">
            {hasProfilePicture ? (
              <Image source={{ uri: profile.profilePicture }} resizeMode="cover" className="h-full w-full" />
            ) : (
              <View className="h-full w-full items-center justify-center bg-[#EEF4FF]">
                <Text className="text-[24px] font-black text-[#346EF6]">{getInitials(profile)}</Text>
              </View>
            )}
          </View>

          <View className="min-w-0 flex-1">
            <View className="self-start flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
              <BadgeCheck size={13} color="#B7F7D0" strokeWidth={2.6} />
              <Text className="text-[10px] font-black uppercase tracking-[0.5px] text-white">
                {profile.accountStatus} Account
              </Text>
            </View>
            <Text className="mt-3 text-[24px] font-black leading-[28px] text-white" numberOfLines={2}>
              {getFullName(profile)}
            </Text>
            <Text className="mt-1 text-[13px] font-semibold leading-5 text-[#D8E5FF]" numberOfLines={1}>
              {profile.email}
            </Text>
          </View>
        </View>

      </View>
    </View>
  );
}

function SummaryItem({
  helper,
  icon: Icon,
  iconClassName,
  iconColor,
  label,
  value,
}: {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  iconClassName: string;
  iconColor: string;
}) {
  return (
    <View className="min-h-[124px] flex-1 rounded-[22px] border border-[#E6EEFF] bg-white p-3.5 shadow-md shadow-[#17315F]/5">
      <View className={`${iconClassName} h-9 w-9 items-center justify-center rounded-full`}>
        <Icon size={18} color={iconColor} strokeWidth={2.45} />
      </View>
      <Text className="mt-3 text-[17px] font-black leading-6 text-[#17315F]" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text className="mt-1 text-[10px] font-black leading-4 text-[#6C7A96]" numberOfLines={2}>
        {label}
      </Text>
      <Text className="mt-0.5 text-[9px] font-bold leading-3 text-[#91A0B8]" numberOfLines={1}>
        {helper}
      </Text>
    </View>
  );
}

export function ProfileSummaryGrid({ profile }: { profile: CustomerProfile }) {
  return (
    <View className="flex-row gap-2.5">
      <SummaryItem
        icon={CalendarCheck2}
        label="Successful Bookings"
        value={profile.successfulBookings.toString()}
        helper="Completed"
        iconClassName="bg-[#ECFDF5]"
        iconColor="#047857"
      />
      <SummaryItem
        icon={WalletCards}
        label="Total Spent"
        value={formatPeso(profile.totalSpent)}
        helper="Payments"
        iconClassName="bg-[#EEF4FF]"
        iconColor={profileColors.brand}
      />
      <SummaryItem
        icon={CalendarDays}
        label="Joined Since"
        value={profile.joinedSince}
        helper="Account"
        iconClassName="bg-[#FFF7ED]"
        iconColor="#C2410C"
      />
    </View>
  );
}

export function ProfileSectionCard({
  actionLabel,
  children,
  icon: Icon,
  title,
}: {
  title: string;
  icon: LucideIcon;
  actionLabel?: string;
  children: ReactNode;
}) {
  return (
    <View className="rounded-[28px] border border-[#E6EEFF] bg-white p-5 shadow-md shadow-[#17315F]/5">
      <View className="mb-4 flex-row items-center gap-2.5">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-[#EEF4FF]">
          <Icon size={20} color={profileColors.brand} strokeWidth={2.45} />
        </View>
        <Text className="min-w-0 flex-1 text-[18px] font-black text-[#17315F]">{title}</Text>
        {actionLabel ? (
          <View className="rounded-full bg-[#ECFDF5] px-3 py-1.5">
            <Text className="text-[10px] font-black uppercase tracking-[0.4px] text-[#047857]">{actionLabel}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function ProfileInfoRow({
  icon: Icon,
  isLast = false,
  label,
  onPress,
  value,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  isLast?: boolean;
  onPress?: PressableProps['onPress'];
}) {
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      className={cx('min-h-[58px] flex-row items-center gap-3 py-3', !isLast && 'border-b border-[#EEF2FF]')}>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F3F7FF]">
        <Icon size={18} color={profileColors.brand} strokeWidth={2.35} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-black uppercase tracking-[0.4px] text-[#91A0B8]">{label}</Text>
        <Text className="mt-1 text-[14px] font-extrabold leading-5 text-[#17315F]" numberOfLines={2}>
          {value}
        </Text>
      </View>
      {onPress ? <ChevronRight size={19} color="#A8B2C3" strokeWidth={2.45} /> : null}
    </Wrapper>
  );
}

export function ProfileActionRow({
  destructive = false,
  icon: Icon,
  label,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  onPress: PressableProps['onPress'];
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={cx(
        'min-h-[58px] flex-row items-center gap-3 rounded-[20px] border px-4',
        destructive ? 'border-[#FECACA] bg-[#FEF2F2]' : 'border-[#EDF2FF] bg-[#FBFCFF]',
      )}>
      <View className={cx('h-10 w-10 items-center justify-center rounded-full', destructive ? 'bg-white' : 'bg-[#EEF4FF]')}>
        <Icon size={18} color={destructive ? '#DC2626' : profileColors.brand} strokeWidth={2.45} />
      </View>
      <Text className={cx('min-w-0 flex-1 text-[14px] font-black', destructive ? 'text-[#DC2626]' : 'text-[#17315F]')}>
        {label}
      </Text>
      <ChevronRight size={19} color={destructive ? '#DC2626' : '#A8B2C3'} strokeWidth={2.45} />
    </Pressable>
  );
}

export function ProfileLoadingState() {
  return (
    <View className="mt-6 gap-4">
      <View className="h-[210px] rounded-[30px] border border-[#DDE8FF] bg-white p-5 shadow-md shadow-[#17315F]/5">
        <View className="h-20 w-20 rounded-[28px] bg-[#EEF4FF]" />
        <View className="mt-5 h-5 w-3/5 rounded-full bg-[#EEF4FF]" />
        <View className="mt-3 h-4 w-4/5 rounded-full bg-[#F3F7FF]" />
        <View className="mt-6 h-11 rounded-full bg-[#EEF4FF]" />
      </View>
      <View className="rounded-[28px] border border-[#E6EEFF] bg-white p-5">
        <Text className="text-[18px] font-black text-[#17315F]">Loading profile information</Text>
        <Text className="mt-2 text-[13px] font-semibold leading-5 text-[#6C7A96]">
          Fetching your customer account details.
        </Text>
      </View>
    </View>
  );
}

export function ProfileErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="mt-6 rounded-[28px] border border-[#FECACA] bg-[#FEF2F2] p-5">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-white">
        <CircleAlert size={23} color="#DC2626" strokeWidth={2.45} />
      </View>
      <Text className="mt-4 text-[20px] font-black text-[#991B1B]">Profile unavailable</Text>
      <Text className="mt-2 text-[13px] font-semibold leading-5 text-[#B45309]">
        We could not load the mock profile information. Try again to return to the saved local profile.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        className="mt-5 min-h-[46px] items-center justify-center rounded-full bg-[#DC2626] px-5">
        <Text className="text-[13px] font-black text-white">Retry</Text>
      </Pressable>
    </View>
  );
}
