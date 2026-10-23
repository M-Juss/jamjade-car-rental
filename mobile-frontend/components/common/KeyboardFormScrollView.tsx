import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  View,
  type KeyboardEvent,
  type ScrollViewProps,
  type ViewProps,
} from 'react-native';

import { getFocusedFieldScrollOffset } from '@/lib/keyboard/scroll-offset';

const fieldClearance = 12;
const FieldScrollContext = createContext<{
  focus: (field: View | null) => void;
  blur: (field: View | null) => void;
  refresh: () => void;
} | null>(null);

// The screen or modal owns keyboard resizing. Temporary space at the end of the
// content lets the entire form scroll higher while the keyboard is open.
export function KeyboardFormScrollView({
  children,
  contentContainerStyle,
  onContentSizeChange,
  onLayout,
  onScroll,
  style,
  scrollResetKey,
  ...props
}: ScrollViewProps & { scrollResetKey?: string }) {
  const scroll = useRef<ScrollView>(null);
  const focusedField = useRef<View | null>(null);
  const scrollOffset = useRef(0);
  const frame = useRef<number | null>(null);
  const [keyboardSpace, setKeyboardSpace] = useState(() => Keyboard.metrics()?.height ?? 0);

  useEffect(() => {
    if (scrollResetKey === undefined) return;
    focusedField.current = null;
    scrollOffset.current = 0;
    const resetFrame = requestAnimationFrame(() => scroll.current?.scrollTo({ y: 0, animated: false }));
    return () => cancelAnimationFrame(resetFrame);
  }, [scrollResetKey]);

  const refresh = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const field = focusedField.current;
      const viewport = scroll.current;
      if (!field || !viewport) return;

      viewport.getNativeScrollRef()?.measureInWindow((_x, viewportTop, _width, viewportHeight) => {
        field.measureInWindow((_fieldX, fieldTop, _fieldWidth, fieldHeight) => {
          if (focusedField.current !== field || scroll.current !== viewport) return;

          const offset = getFocusedFieldScrollOffset({
            fieldTop,
            fieldHeight,
            viewportTop,
            viewportHeight,
            // Android's resized viewport is already above the keyboard, including
            // dialog windows whose origin can differ from screen coordinates.
            keyboardTop: Platform.OS === 'ios' ? Keyboard.metrics()?.screenY : undefined,
            scrollOffset: scrollOffset.current,
            clearance: fieldClearance,
          });
          if (offset !== null && Math.abs(offset - scrollOffset.current) > 1) {
            viewport.scrollTo({ y: offset, animated: true });
          }
        });
      });
    });
  }, []);

  const focus = useCallback((field: View | null) => {
    focusedField.current = field;
    refresh();
  }, [refresh]);
  const blur = useCallback((field: View | null) => {
    if (focusedField.current === field) focusedField.current = null;
  }, []);
  const context = useMemo(() => ({ focus, blur, refresh }), [focus, blur, refresh]);

  useEffect(() => {
    const showKeyboard = (event: KeyboardEvent) => {
      setKeyboardSpace(Math.max(0, event.endCoordinates.height));
      refresh();
    };
    const hideKeyboard = () => {
      setKeyboardSpace(0);
      refresh();
    };
    const updateKeyboardFrame = () => {
      setKeyboardSpace(Math.max(0, Keyboard.metrics()?.height ?? 0));
      refresh();
    };
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', showKeyboard),
      Keyboard.addListener('keyboardDidHide', hideKeyboard),
    ];
    if (Platform.OS === 'ios') {
      subscriptions.push(Keyboard.addListener('keyboardDidChangeFrame', updateKeyboardFrame));
    }
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      focusedField.current = null;
    };
  }, [refresh]);

  return (
    <FieldScrollContext.Provider value={context}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
        automaticallyAdjustKeyboardInsets={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        {...props}
        ref={scroll}
        style={[{ flexShrink: 1, minHeight: 0 }, style]}
        contentContainerStyle={[{ paddingBottom: fieldClearance }, contentContainerStyle]}
        onLayout={(event) => {
          onLayout?.(event);
          refresh();
        }}
        onContentSizeChange={(width, height) => {
          onContentSizeChange?.(width, height);
          refresh();
        }}
        onScroll={(event) => {
          scrollOffset.current = event.nativeEvent.contentOffset.y;
          onScroll?.(event);
        }}>
        {children}
        {keyboardSpace > 0 ? (
          <View
            accessible={false}
            importantForAccessibility="no"
            pointerEvents="none"
            style={{ height: keyboardSpace, flexShrink: 0 }}
          />
        ) : null}
      </ScrollView>
    </FieldScrollContext.Provider>
  );
}

export function KeyboardAwareField({ onFocus, onBlur, onLayout, ...props }: ViewProps) {
  const context = useContext(FieldScrollContext);
  const field = useRef<View>(null);

  useEffect(() => {
    const currentField = field.current;
    return () => context?.blur(currentField);
  }, [context]);

  return (
    <View
      {...props}
      ref={field}
      collapsable={false}
      onFocus={(event) => {
        context?.focus(field.current);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        context?.blur(field.current);
        onBlur?.(event);
      }}
      onLayout={(event) => {
        onLayout?.(event);
        context?.refresh();
      }}
    />
  );
}
