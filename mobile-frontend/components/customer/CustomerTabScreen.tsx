import { themeColors } from '@/constants/theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontFamilies } from '@/constants/fonts';

import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import type { CustomerTabIcon } from '@/constants/customer-tabs';

type ScreenStat = {
  label: string;
  value: string;
};

type ScreenAction = {
  icon: CustomerTabIcon;
  label: string;
};

type CustomerTabScreenProps = {
  title: string;
  subtitle: string;
  icon: CustomerTabIcon;
  accent: string;
  summaryTitle: string;
  summaryText: string;
  stats: ScreenStat[];
  actions: ScreenAction[];
};

export function CustomerTabScreen({
  accent,
  actions,
  icon,
  stats,
  summaryText,
  summaryTitle,
  title,
}: CustomerTabScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 112 + insets.bottom, paddingTop: insets.top + 12 },
        ]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}>
        <CustomerTabHeader title={title} />

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryIcon, { backgroundColor: accent }]}>
              <MaterialCommunityIcons name={icon} size={24} color={themeColors.surface} />
            </View>
            <View style={styles.summaryTextWrap}>
              <Text className="font-sans" style={styles.summaryTitle}>
                {summaryTitle}
              </Text>
              <Text className="font-sans" style={styles.summaryText}>
                {summaryText}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text className="font-sans" style={styles.statValue}>
                {stat.value}
              </Text>
              <Text className="font-sans" style={styles.statLabel}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.actionList}>
          {actions.map((action) => (
            <View key={action.label} style={styles.actionRow}>
              <View style={styles.actionIcon}>
                <MaterialCommunityIcons name={action.icon} size={22} color={themeColors.primary} />
              </View>
              <Text className="font-sans" style={styles.actionLabel}>
                {action.label}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={22} color={themeColors.subtleForeground} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: themeColors.background,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 132,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  summaryCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 8,
    padding: 18,
    shadowColor: themeColors.primary,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0,
    shadowRadius: 22,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  summaryIcon: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryTitle: {
    color: themeColors.foreground,
    fontSize: 17,
    fontFamily: fontFamilies.semibold,
    fontWeight: 'normal',
    lineHeight: 22,
  },
  summaryText: {
    color: themeColors.mutedForeground,
    fontSize: 13,
    fontFamily: fontFamilies.semibold,
    fontWeight: 'normal',
    lineHeight: 19,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  statCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 22,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  statValue: {
    color: themeColors.foreground,
    fontSize: 20,
    fontFamily: fontFamilies.semibold,
    fontWeight: 'normal',
    lineHeight: 24,
  },
  statLabel: {
    color: themeColors.mutedForeground,
    fontSize: 12,
    fontFamily: fontFamilies.medium,
    fontWeight: 'normal',
    lineHeight: 16,
    marginTop: 3,
  },
  actionList: {
    gap: 10,
    marginTop: 18,
  },
  actionRow: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: themeColors.muted,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  actionLabel: {
    color: themeColors.foreground,
    flex: 1,
    fontSize: 14,
    fontFamily: fontFamilies.semibold,
    fontWeight: 'normal',
    lineHeight: 19,
  },
});
