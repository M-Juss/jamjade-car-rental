import { themeColors } from '@/constants/theme';
import {
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Pencil,
  WalletCards,
  type LucideIcon,
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
    <View className="overflow-hidden rounded-card border border-border bg-surface">
      <View className="p-card">
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
            <Text className="font-sans text-caption text-secondary-foreground">{profile.accountStatus} account</Text>
            <Text
              className="font-sans mt-1 text-[20px] font-semibold leading-[26px] text-foreground">
              {getFullName(profile)}
            </Text>
            <Text
              className="font-sans mt-1 text-caption text-secondary-foreground">
              {profile.email}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function SummaryItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <View className="min-w-[88px] flex-1 gap-1 rounded-card border border-border bg-surface p-2.5">
      <View className="flex-row items-center gap-1">
        <Icon size={14} color={profileColors.brand} strokeWidth={2} accessible={false} />
        <Text className="font-sans min-w-0 flex-1 text-caption text-secondary-foreground">{label}</Text>
      </View>
      <Text className="font-sans text-body font-semibold text-foreground">{value}</Text>
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
    <View className="flex-row flex-wrap gap-2.5">
      <SummaryItem
        icon={CalendarCheck2}
        label="Bookings"
        value={successfulBookings.toString()}
      />
      <SummaryItem
        icon={WalletCards}
        label="Spent"
        value={formatPeso(totalSpent)}
      />
      <SummaryItem
        icon={CalendarDays}
        label="Joined"
        value={joinedDate}
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
    <View className="rounded-card border border-border bg-surface p-card">
      <View className="mb-2 min-h-[32px] flex-row items-center gap-2">
        <Icon size={16} color={profileColors.brand} strokeWidth={2} />
        <Text className="font-sans min-w-0 flex-1 text-section font-semibold text-foreground">{title}</Text>
        {actionLabel ? (
          <View className="rounded-full bg-success-surface px-3 py-1.5">
            <Text className="font-sans text-[11px] font-semibold text-success">{actionLabel}</Text>
          </View>
        ) : null}
        {headerAction}
      </View>
      <View className="border-t border-border pt-1">{children}</View>
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
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      className="h-8 w-8 items-center justify-center rounded-field">
      <Icon size={16} color={themeColors.primary} strokeWidth={2} />
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
        'min-h-control flex-row items-center gap-3 py-2.5',
        !isLast && 'border-b border-border',
      )}>
      <Icon size={18} color={profileColors.brand} strokeWidth={2} />
      <View className="min-w-0 flex-1">
        <Text className="font-sans text-caption text-secondary-foreground">{label}</Text>
        <Text className="font-sans mt-1 text-body text-foreground">
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
        'min-h-control flex-row items-center gap-3 rounded-field border px-4 py-3',
        destructive ? 'border-destructive-border bg-destructive-surface' : 'border-border bg-background',
      )}>
      <Icon
        size={18}
        color={destructive ? themeColors.destructive : profileColors.brand}
        strokeWidth={2.45}
      />
      <Text
        className={cx(
          'font-sans',
          'min-w-0 flex-1 text-body font-medium',
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
    <View className="mt-section gap-4">
      <View className="h-[210px] rounded-card border border-border bg-surface p-card">
        <View className="h-20 w-20 rounded-card bg-muted" />
        <View className="mt-section h-5 w-3/5 rounded-full bg-muted" />
        <View className="mt-3 h-4 w-4/5 rounded-full bg-muted" />
        <View className="mt-section h-11 rounded-full bg-muted" />
      </View>
      <View className="rounded-card border border-border bg-surface p-card">
        <Text className="font-sans text-section font-semibold text-foreground">
          Loading profile information
        </Text>
      </View>
    </View>
  );
}

export function ProfileErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="mt-section rounded-card border border-destructive-border bg-destructive-surface p-card">
      <CircleAlert size={23} color={themeColors.destructive} strokeWidth={2} />
      <Text className="font-sans mt-4 text-[20px] font-semibold text-destructive">Profile unavailable</Text>
      <Text className="font-sans mt-2 text-body text-destructive">
        We could not load your profile information. Check your connection and try again.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        className="mt-section min-h-control items-center justify-center rounded-field bg-destructive px-screen">
        <Text className="font-sans text-button font-medium text-surface">Retry</Text>
      </Pressable>
    </View>
  );
}
