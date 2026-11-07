import { themeColors } from '@/constants/theme';
import { MapPinned, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareField } from '@/components/common/KeyboardFormScrollView';
import {
  canSearchGooglePlaces,
  createGooglePlacesSessionToken,
  searchGooglePlaces,
  resolveGooglePlace,
  type ResolvedPlace,
  type PlacePrediction,
} from '@/services/maps/google-places.service';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function LocationSearchWithLabel({
  disabled = false,
  error,
  helperText,
  label,
  onChangeText,
  onSelectPlace,
  placeholder = 'Search pickup location',
  value,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onSelectPlace?: (place: ResolvedPlace) => void;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
  error?: string;
}) {
  const [query, setQuery] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [sessionToken, setSessionToken] = useState(
    createGooglePlacesSessionToken,
  );
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (disabled || !isFocused || trimmedQuery.length < 1) {
      setSuggestions([]);
      setIsLoading(false);
      return undefined;
    }

    setSuggestions([]);

    if (!canSearchGooglePlaces(trimmedQuery)) {
      setIsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsLoading(true);
      setSearchError(null);

      try {
        const placesNewSuggestions = await searchGooglePlaces({
          query: trimmedQuery,
          sessionToken,
          signal: controller.signal,
        });

        if (placesNewSuggestions.length > 0) {
          setSuggestions(placesNewSuggestions);
          return;
        }

        setSuggestions([]);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setSuggestions([]);
        setSearchError(
          'Addresses could not be loaded. Check your connection and try again.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [disabled, isFocused, query, sessionToken]);

  const handleChangeText = (nextValue: string) => {
    if (disabled) {
      return;
    }

    setQuery(nextValue);
    onChangeText(nextValue);
  };

  const handleSelectSuggestion = async (suggestion: PlacePrediction) => {
    if (isResolving) return;
    setIsResolving(true);
    setIsLoading(true);
    try {
      const place = await resolveGooglePlace(
        suggestion.place_id,
        sessionToken,
        suggestion.description,
      );
      setQuery(place.address);
      if (onSelectPlace) onSelectPlace(place);
      else onChangeText(place.address);
    } catch {
      setSearchError(
        'This address could not be resolved. Select another suggestion.',
      );
      return;
    } finally {
      setIsLoading(false);
      setIsResolving(false);
      setSessionToken(createGooglePlacesSessionToken());
    }
    setSuggestions([]);
    setIsFocused(false);
    Keyboard.dismiss();
  };

  const showSuggestions = isFocused && suggestions.length > 0;

  return (
    <KeyboardAwareField
      className="relative mb-4 gap-2"
    >
      <Text className="font-sans text-[12px] font-normal text-secondary-foreground">
        {label}
      </Text>
      <View
        className={cx(
          'min-h-control flex-row items-center rounded-field border bg-surface px-4',
          error
            ? 'border-destructive-border bg-destructive-surface'
            : 'border-border',
          disabled && 'bg-[#F3F6FA] opacity-70',
        )}
      >
        <MapPinned size={18} color={themeColors.primary} strokeWidth={2.35} />
        <TextInput
          value={query}
          onBlur={() => {
            setTimeout(() => setIsFocused(false), 120);
          }}
          onChangeText={handleChangeText}
          onFocus={() => {
            if (!disabled) {
              setIsFocused(true);
            }
          }}
          editable={!disabled && !isResolving}
          placeholder={placeholder}
          placeholderTextColor={themeColors.subtleForeground}
          className="font-sans min-w-0 flex-1 px-3 text-[15px] font-medium text-foreground"
        />
        <Search
          size={16}
          color={themeColors.subtleForeground}
          strokeWidth={2.35}
        />
      </View>

      {showSuggestions ? (
        <View
          className="overflow-hidden rounded-card border border-border bg-surface"
          style={{ elevation: 8, zIndex: 30 }}
        >
          {suggestions.map((suggestion, index) => (
            <Pressable
              disabled={isResolving}
              key={suggestion.place_id}
              accessibilityRole="button"
              onPress={() => handleSelectSuggestion(suggestion)}
              className={cx(
                'flex-row gap-3 px-4 py-3',
                index !== suggestions.length - 1 && 'border-b border-[#EEF2FF]',
              )}
            >
              <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-muted">
                <MapPinned
                  size={15}
                  color={themeColors.primary}
                  strokeWidth={2.35}
                />
              </View>
              <View className="min-w-0 flex-1">
                <Text
                  className="font-sans text-[13px] font-semibold leading-5 text-foreground"
                  numberOfLines={1}
                >
                  {suggestion.structured_formatting?.main_text ??
                    suggestion.description}
                </Text>
                <Text
                  className="font-sans mt-0.5 text-[11px] font-normal leading-4 text-secondary-foreground"
                  numberOfLines={2}
                >
                  {suggestion.structured_formatting?.secondary_text ??
                    suggestion.description}
                </Text>
              </View>
            </Pressable>
          ))}
          <Text
            numberOfLines={1}
            className="font-sans border-t border-border px-4 py-2 text-right text-[12px] font-normal"
            style={{ color: themeColors.googleAttribution }}
          >
            Google Maps
          </Text>
        </View>
      ) : null}

      {searchError && (
        <Text
          accessibilityRole="alert"
          className="font-sans text-caption text-destructive"
        >
          {searchError}
        </Text>
      )}
      {isLoading ? (
        <Text className="font-sans text-[11px] font-medium text-secondary-foreground">
          Searching Google Maps...
        </Text>
      ) : null}
      <View className="px-1">
        {error || helperText ? (
          <Text
            className={cx(
              'font-sans',
              'text-[11px] font-medium leading-4 text-secondary-foreground',
              error && 'text-destructive',
            )}
          >
            {error || helperText}
          </Text>
        ) : null}
      </View>
    </KeyboardAwareField>
  );
}
