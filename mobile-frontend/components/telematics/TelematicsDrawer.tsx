import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { floatingTabBarContentPadding } from '@/constants/layout';

export type TelematicsTab = 'details' | 'setup' | 'activity';
const tabs = [{ key: 'details', label: 'Full details' }, { key: 'setup', label: 'Device setup' }, { key: 'activity', label: 'Activity' }] as const;

export function telematicsDrawerPositions(height: number, topInset: number, bottomInset: number) {
  const fullTop = topInset + 62;
  return { fullTop, collapsedTop: Math.max(fullTop, Math.min(height * 0.37, height - bottomInset - 370)) };
}

export function TelematicsDrawer({ tab, onTab, expanded, onExpand, unread, summary, children }: {
  tab: TelematicsTab; onTab: (tab: TelematicsTab) => void; expanded: boolean;
  onExpand: (expanded: boolean) => void; unread: number; summary?: ReactNode; children: ReactNode;
}) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { fullTop, collapsedTop } = telematicsDrawerPositions(height, insets.top, insets.bottom);
  const top = useRef(new Animated.Value(fullTop)).current;
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Record<TelematicsTab, number>>({ details: 0, setup: 0, activity: 0 });
  const touchY = useRef(0);
  const collapsing = useRef(false);
  const restoring = useRef(false);
  const drag = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => { top.stopAnimation(); },
    onPanResponderMove: (_, gesture) => {
      const start = expanded ? fullTop : collapsedTop;
      top.setValue(Math.max(fullTop, Math.min(collapsedTop, start + gesture.dy)));
    },
    onPanResponderRelease: (_, gesture) => {
      const nextExpanded = gesture.dy > 35 || gesture.vy > 0.5 ? false : gesture.dy < -35 || gesture.vy < -0.5 ? true : expanded;
      if (nextExpanded !== expanded) onExpand(nextExpanded);
      else Animated.timing(top, { toValue: expanded ? fullTop : collapsedTop, duration: 180, useNativeDriver: false }).start();
    },
    onPanResponderTerminate: () => {
      Animated.timing(top, { toValue: expanded ? fullTop : collapsedTop, duration: 180, useNativeDriver: false }).start();
    },
  }), [collapsedTop, expanded, fullTop, onExpand, top]);
  useEffect(() => {
    collapsing.current = !expanded;
    if (!expanded) {
      offsets.current[tab] = 0;
      scroll.current?.scrollTo({ y: 0, animated: false });
    }
    const animation = Animated.timing(top, { toValue: expanded ? fullTop : collapsedTop, duration: 230, useNativeDriver: false });
    animation.start(() => { collapsing.current = false; });
    return () => animation.stop();
  }, [expanded, fullTop, collapsedTop, top, tab]);
  useLayoutEffect(() => {
    restoring.current = true;
    const target = expanded ? offsets.current[tab] : 0;
    let settle: number | undefined;
    const frame = requestAnimationFrame(() => {
      scroll.current?.scrollTo({ y: target, animated: false });
      settle = requestAnimationFrame(() => { restoring.current = false; });
    });
    return () => { cancelAnimationFrame(frame); if (settle !== undefined) cancelAnimationFrame(settle); };
  }, [tab, expanded]);

  return <Animated.View className="absolute bottom-0 self-center" style={{ top, width: Math.min(560, width - 2 * Math.max(insets.left, insets.right)) }}>
    <View accessibilityRole="tablist" className="flex-row gap-1 px-screen" {...drag.panHandlers}>
      {tabs.map((item) => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: tab === item.key }} accessibilityLabel={`${item.label}${item.key === 'activity' && unread ? `, ${unread} unread` : ''}`} onPress={() => onTab(item.key)} className={`min-h-control min-w-0 flex-1 items-center justify-center rounded-t-field border border-b-0 border-border px-1 py-2 ${expanded ? (tab === item.key ? 'bg-surface' : 'bg-muted') : 'bg-transparent'}`}>
        <Text numberOfLines={2} className={`font-sans text-center text-[13px] font-semibold leading-4 ${tab === item.key ? 'text-primary' : 'text-secondary-foreground'}`}>{item.label}{item.key === 'activity' && unread ? ` (${unread > 99 ? '99+' : unread})` : ''}</Text>
      </Pressable>)}
    </View>
    <View className="flex-1 overflow-hidden rounded-t-sheet border border-b-0 border-border bg-surface">
      <Pressable {...drag.panHandlers} accessibilityRole="button" accessibilityLabel={expanded ? 'Show map' : 'Expand booking panel'} accessibilityState={{ expanded }} onPress={() => onExpand(!expanded)} className="min-h-[44px] items-center justify-center">
        <View className="h-1 w-10 rounded-full bg-border" />
      </Pressable>
      {summary ? <View className="shrink-0 px-card">{summary}</View> : null}
      <ScrollView ref={scroll} className="flex-1" contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator nestedScrollEnabled scrollEventThrottle={16}
        onTouchStart={(event) => { touchY.current = event.nativeEvent.pageY; }}
        onTouchEnd={(event) => { if (expanded && offsets.current[tab] <= 0 && event.nativeEvent.pageY - touchY.current > 55) onExpand(false); }}
        onScroll={(event) => {
          if (restoring.current) return;
          const offset = Math.max(0, event.nativeEvent.contentOffset.y);
          offsets.current[tab] = offset;
          if (!expanded && !collapsing.current && offset > 12) onExpand(true);
        }}
        contentContainerStyle={{ padding: 16, paddingBottom: floatingTabBarContentPadding + insets.bottom + 48 }}>
        {children}
      </ScrollView>
    </View>
  </Animated.View>;
}
