import { themeColors } from '@/constants/theme';
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
import { getFullName, getInitials, type CustomerProfile } from '@/lib/profile/profile-data';

export const profileColors = {
  brand: themeColors.primary,
  ink: themeColors.foreground,
};

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function ProfileHeaderCard({ profile }: { profile: CustomerProfile }) {
  const hasProfilePicture = Boolean(profile.profilePicture);

  return (
    <View className="overflow-hidden rounded-card border border-border bg-surface ">
      <View className="p-5">
        <View className="flex-row items-start gap-4">
          <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-card border-2 border-surface/45 bg-muted">
            {hasProfilePicture ? (
              <Image
                source={{ uri: profile.profilePicture }}
                resizeMode="cover"
                style={{ height: '100%', width: '100%' }}
              />
            ) : (
              <View className="h-full w-full items-center justify-center bg-muted">
                <Text className="font-sans text-[24px] font-semibold text-primary">
                  {getInitials(profile)}
                </Text>
              </View>
            )}
          </View>

          <View className="min-w-0 flex-1">
            <View className="self-start flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
              <BadgeCheck size={13} color="#B7F7D0" strokeWidth={2.6} />
              <Text className="font-sans text-[11px] font-semibold text-foreground">
                {profile.accountStatus} Account
              </Text>
            </View>
            <Text
              className="font-sans mt-3 text-[24px] font-semibold leading-[28px] text-foreground">
              {getFullName(profile)}
            </Text>
            <Text
              className="font-sans mt-1 text-[13px] font-semibold leading-5 text-secondary-foreground">
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
    <View className="min-h-[92px] min-w-0 flex-1 rounded-card border border-border bg-surface p-3 ">
      <View className="items-start gap-1.5">
        <View className={`${iconClassName} h-7 w-7 items-center justify-center rounded-full`}>
          <Icon size={16} color={iconColor} strokeWidth={2.45} />
        </View>
        <Text
          className="font-sans w-full text-[12px] font-medium leading-4 text-secondary-foreground"
          numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text
        className="font-sans mt-2 text-[16px] font-semibold leading-5 text-foreground"
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
        label="Bookings"
        value={successfulBookings.toString()}
        iconClassName="bg-success-surface"
        iconColor={themeColors.success}
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
        label="Joined"
        value={joinedDate}
        iconClassName="bg-warning-surface"
        iconColor={themeColors.warning}
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
    <View className="rounded-card border border-border bg-surface p-card ">
      <View className="flex-row items-center gap-2.5 pb-3">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-muted">
          <Icon size={20} color={profileColors.brand} strokeWidth={2.45} />
        </View>
        <Text className="font-sans min-w-0 flex-1 text-section font-semibold text-foreground">{title}</Text>
        {actionLabel ? (
          <View className="rounded-full bg-success-surface px-3 py-1.5">
            <Text className="font-sans text-[11px] font-semibold text-success">{actionLabel}</Text>
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
}: {
  label?: string;
  icon?: LucideIcon;
  onPress: PressableProps['onPress'];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[40px] flex-row items-center gap-1.5 rounded-full border border-border bg-background px-3">
      <Icon size={14} color={themeColors.primary} strokeWidth={2.5} />
      <Text className="font-sans text-[12px] font-medium text-primary">{label}</Text>
    </Pressable>
  );
}

export function ProfileInfoRow({
  accessibilityLabel,
  icon: Icon,
  isLast = false,
  label,
  onPress,
  value,
}: {
  accessibilityLabel?: string;
  label: string;
  value: string;
  icon: LucideIcon;
  isLast?: boolean;
  onPress?: PressableProps['onPress'];
}) {
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      className={cx(
        'min-h-[52px] flex-row items-center gap-3 py-2.5',
        !isLast && 'border-b border-[#EEF2FF]',
      )}>
      <View className="h-8 w-8 items-center justify-center rounded-full bg-muted">
        <Icon size={18} color={profileColors.brand} strokeWidth={2.35} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-sans text-[12px] font-medium text-secondary-foreground">{label}</Text>
        <Text className="font-sans mt-1 text-[14px] font-medium leading-5 text-foreground">
          {value}
        </Text>
      </View>
      {onPress ? <ChevronRight size={19} color={themeColors.subtleForeground} strokeWidth={2.45} /> : null}
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
        'min-h-[52px] flex-row items-center gap-3 rounded-[20px] border px-4',
        destructive ? 'border-destructive-border bg-destructive-surface' : 'border-border bg-background',
      )}>
      <View
        className={cx(
          'h-10 w-10 items-center justify-center rounded-full',
          destructive ? 'bg-surface' : 'bg-muted',
        )}>
        <Icon
          size={18}
          color={destructive ? themeColors.destructive : profileColors.brand}
          strokeWidth={2.45}
        />
      </View>
      <Text
        className={cx(
          'font-sans',
          'min-w-0 flex-1 text-[14px] font-medium',
          destructive ? 'text-destructive' : 'text-foreground',
        )}>
        {label}
      </Text>
      <ChevronRight
        size={19}
        color={destructive ? themeColors.destructive : themeColors.subtleForeground}
        strokeWidth={2.45}
      />
    </Pressable>
  );
}

export function ProfileLoadingState() {
  return (
    <View className="mt-6 gap-4">
      <View className="h-[210px] rounded-card border border-border bg-surface p-card ">
        <View className="h-20 w-20 rounded-card bg-muted" />
        <View className="mt-5 h-5 w-3/5 rounded-full bg-muted" />
        <View className="mt-3 h-4 w-4/5 rounded-full bg-muted" />
        <View className="mt-6 h-11 rounded-full bg-muted" />
      </View>
      <View className="rounded-card border border-border bg-surface p-card">
        <Text className="font-sans text-section font-semibold text-foreground">
          Loading profile information
        </Text>
        <Text className="font-sans mt-2 text-[13px] font-normal leading-5 text-secondary-foreground">
          Fetching your customer account details.
        </Text>
      </View>
    </View>
  );
}

export function ProfileErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="mt-6 rounded-card border border-destructive-border bg-destructive-surface p-5">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
        <CircleAlert size={23} color={themeColors.destructive} strokeWidth={2.45} />
      </View>
      <Text className="font-sans mt-4 text-[20px] font-semibold text-destructive">Profile unavailable</Text>
      <Text className="font-sans mt-2 text-[13px] font-semibold leading-5 text-warning">
        We could not load your profile information. Check your connection and try again.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        className="mt-5 min-h-[46px] items-center justify-center rounded-full bg-destructive px-5">
        <Text className="font-sans text-[13px] font-semibold text-foreground">Retry</Text>
      </Pressable>
    </View>
  );
}
