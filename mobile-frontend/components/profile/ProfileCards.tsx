import {
  BadgeCheck,
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Pencil,
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
    <View className="overflow-hidden rounded-[30px] border border-[#D6E5FF] bg-foreground shadow-xl shadow-foreground/15">
      <View className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/35" />
      <View className="absolute -bottom-14 left-10 h-32 w-32 rounded-full bg-surface/10" />
      <View className="p-5">
        <View className="flex-row items-start gap-4">
          <View className="h-[82px] w-[82px] items-center justify-center overflow-hidden rounded-[28px] border-2 border-surface/45 bg-surface/15">
            {hasProfilePicture ? (
              <Image source={{ uri: profile.profilePicture }} resizeMode="cover" className="h-full w-full" />
            ) : (
              <View className="h-full w-full items-center justify-center bg-muted">
                <Text className="text-[24px] font-black text-primary">{getInitials(profile)}</Text>
              </View>
            )}
          </View>

          <View className="min-w-0 flex-1">
            <View className="self-start flex-row items-center gap-1.5 rounded-full bg-surface/15 px-3 py-1.5">
              <BadgeCheck size={13} color="#B7F7D0" strokeWidth={2.6} />
              <Text className="text-[10px] font-black uppercase tracking-[0.5px] text-surface">
                {profile.accountStatus} Account
              </Text>
            </View>
            <Text className="mt-3 text-[24px] font-black leading-[28px] text-surface" numberOfLines={2}>
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
  icon: Icon,
  iconClassName,
  iconColor,
  label,
  value,
  valueNumberOfLines = 1,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClassName: string;
  iconColor: string;
  valueNumberOfLines?: number;
}) {
  return (
    <View className="min-h-[116px] flex-1 rounded-[22px] border border-border bg-surface p-3 shadow-md shadow-foreground/5">
      <View className="flex-row items-center gap-2">
        <View className={`${iconClassName} h-8 w-8 items-center justify-center rounded-full`}>
          <Icon size={16} color={iconColor} strokeWidth={2.45} />
        </View>
        <Text className="min-h-[32px] min-w-0 flex-1 text-[10px] font-black leading-4 text-muted-foreground" numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text
        className="mt-3 min-h-[40px] text-[17px] font-black leading-5 text-foreground"
        numberOfLines={valueNumberOfLines}
        adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

export function ProfileSummaryGrid({ profile }: { profile: CustomerProfile }) {
  return (
    <ProfileKpiGrid
      joinedDate={profile.joinedSince}
      successfulBookings={profile.successfulBookings}
      totalSpent={profile.totalSpent}
    />
  );
}

export function ProfileKpiGrid({
  joinedDate,
  successfulBookings,
  totalSpent,
}: {
  successfulBookings: number;
  totalSpent: number;
  joinedDate: string;
}) {
  return (
    <View className="flex-row gap-2.5">
      <SummaryItem
        icon={CalendarCheck2}
        label="Successful Bookings"
        value={successfulBookings.toString()}
        iconClassName="bg-success-surface"
        iconColor="#047857"
      />
      <SummaryItem
        icon={WalletCards}
        label="Amount Spent"
        value={formatPeso(totalSpent)}
        iconClassName="bg-muted"
        iconColor={profileColors.brand}
      />
      <SummaryItem
        icon={CalendarDays}
        label="Joined Date"
        value={joinedDate}
        iconClassName="bg-warning-surface"
        iconColor="#C2410C"
        valueNumberOfLines={2}
      />
    </View>
  );
}

export function ProfileSectionCard({
  actionLabel,
  children,
  headerAction,
  icon: Icon,
  title,
}: {
  title: string;
  icon: LucideIcon;
  actionLabel?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="rounded-[28px] border border-border bg-surface p-5 shadow-md shadow-foreground/5">
      <View className="flex-row items-center gap-2.5 pb-4">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Icon size={20} color={profileColors.brand} strokeWidth={2.45} />
        </View>
        <Text className="min-w-0 flex-1 text-[18px] font-black text-foreground">{title}</Text>
        {actionLabel ? (
          <View className="rounded-full bg-success-surface px-3 py-1.5">
            <Text className="text-[10px] font-black uppercase tracking-[0.4px] text-success">{actionLabel}</Text>
          </View>
        ) : null}
        {headerAction}
      </View>
      <View className="border-t border-[#EEF2FF] pt-2">{children}</View>
    </View>
  );
}

export function ProfileEditButton({
  icon: Icon = Pencil,
  label = 'Edit',
  onPress,
  tone = 'default',
}: {
  label?: string;
  icon?: LucideIcon;
  onPress: PressableProps['onPress'];
  tone?: 'default' | 'success';
}) {
  const isSuccess = tone === 'success';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={cx(
        'min-h-[40px] flex-row items-center gap-1.5 rounded-full border px-3',
        isSuccess
          ? 'border-success-border bg-success-surface'
          : 'border-border bg-background',
      )}>
      <Icon size={14} color={isSuccess ? '#047857' : profileColors.brand} strokeWidth={2.5} />
      <Text className={cx('text-[11px] font-black', isSuccess ? 'text-success' : 'text-primary')}>
        {label}
      </Text>
    </Pressable>
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
      <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Icon size={18} color={profileColors.brand} strokeWidth={2.35} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-black uppercase tracking-[0.4px] text-subtle-foreground">{label}</Text>
        <Text className="mt-1 text-[14px] font-extrabold leading-5 text-foreground" numberOfLines={2}>
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
        destructive ? 'border-destructive-border bg-destructive-surface' : 'border-[#EDF2FF] bg-[#FBFCFF]',
      )}>
      <View className={cx('h-10 w-10 items-center justify-center rounded-full', destructive ? 'bg-surface' : 'bg-muted')}>
        <Icon size={18} color={destructive ? '#DC2626' : profileColors.brand} strokeWidth={2.45} />
      </View>
      <Text className={cx('min-w-0 flex-1 text-[14px] font-black', destructive ? 'text-destructive' : 'text-foreground')}>
        {label}
      </Text>
      <ChevronRight size={19} color={destructive ? '#DC2626' : '#A8B2C3'} strokeWidth={2.45} />
    </Pressable>
  );
}

export function ProfileLoadingState() {
  return (
    <View className="mt-6 gap-4">
      <View className="h-[210px] rounded-[30px] border border-border bg-surface p-5 shadow-md shadow-foreground/5">
        <View className="h-20 w-20 rounded-[28px] bg-muted" />
        <View className="mt-5 h-5 w-3/5 rounded-full bg-muted" />
        <View className="mt-3 h-4 w-4/5 rounded-full bg-muted" />
        <View className="mt-6 h-11 rounded-full bg-muted" />
      </View>
      <View className="rounded-[28px] border border-border bg-surface p-5">
        <Text className="text-[18px] font-black text-foreground">Loading profile information</Text>
        <Text className="mt-2 text-[13px] font-semibold leading-5 text-muted-foreground">
          Fetching your customer account details.
        </Text>
      </View>
    </View>
  );
}

export function ProfileErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="mt-6 rounded-[28px] border border-destructive-border bg-destructive-surface p-5">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
        <CircleAlert size={23} color="#DC2626" strokeWidth={2.45} />
      </View>
      <Text className="mt-4 text-[20px] font-black text-destructive">Profile unavailable</Text>
      <Text className="mt-2 text-[13px] font-semibold leading-5 text-[#B45309]">
        We could not load your profile information. Check your connection and try again.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        className="mt-5 min-h-[46px] items-center justify-center rounded-full bg-destructive px-5">
        <Text className="text-[13px] font-black text-surface">Retry</Text>
      </Pressable>
    </View>
  );
}
