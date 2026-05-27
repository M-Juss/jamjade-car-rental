import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { useAutoHideCustomerTabBar } from '@/components/navigation/CustomerTabBarVisibilityContext';
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
  subtitle,
  summaryText,
  summaryTitle,
}: CustomerTabScreenProps) {
  const insets = useSafeAreaInsets();
  const handleTabScroll = useAutoHideCustomerTabBar();

  return (
    <View style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 112 + insets.bottom, paddingTop: insets.top + 12 },
        ]}
        contentInsetAdjustmentBehavior="never"
        onScroll={handleTabScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}>
        <CustomerTabHeader description={subtitle} />

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryIcon, { backgroundColor: accent }]}>
              <MaterialCommunityIcons name={icon} size={24} color="#FFFFFF" />
            </View>
            <View style={styles.summaryTextWrap}>
              <Text style={styles.summaryTitle}>{summaryTitle}</Text>
              <Text style={styles.summaryText}>{summaryText}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionList}>
          {actions.map((action) => (
            <View key={action.label} style={styles.actionRow}>
              <View style={styles.actionIcon}>
                <MaterialCommunityIcons name={action.icon} size={22} color="#346EF6" />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#91A0B8" />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F8FAFF',
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
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8FF',
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 28,
    padding: 18,
    shadowColor: '#346EF6',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.08,
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
    color: '#17315F',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
  },
  summaryText: {
    color: '#6C7A96',
    fontSize: 13,
    fontWeight: '600',
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
    backgroundColor: '#FFFFFF',
    borderColor: '#E6EEFF',
    borderRadius: 22,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  statValue: {
    color: '#17315F',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  statLabel: {
    color: '#6C7A96',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 3,
  },
  actionList: {
    gap: 10,
    marginTop: 18,
  },
  actionRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E6EEFF',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 14,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF3FF',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  actionLabel: {
    color: '#17315F',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
});
