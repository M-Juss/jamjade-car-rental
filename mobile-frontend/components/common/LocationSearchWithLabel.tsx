import {
  MapPinned,
  Search,
} from 'lucide-react-native';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  canSearchGooglePlaces,
  createGooglePlacesSessionToken,
  getPhilippinePlaceSuggestions,
  searchGooglePlaces,
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
  placeholder = 'Search pickup location',
  value,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
  error?: string;
}) {
  const [query, setQuery] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const sessionToken = useMemo(createGooglePlacesSessionToken, []);

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

    const fallbackSuggestions = getPhilippinePlaceSuggestions(trimmedQuery);
    setSuggestions(fallbackSuggestions);

    if (!canSearchGooglePlaces(trimmedQuery)) {
      setIsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsLoading(true);

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

        setSuggestions(fallbackSuggestions);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setSuggestions(fallbackSuggestions);
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

  const handleSelectSuggestion = (suggestion: PlacePrediction) => {
    setQuery(suggestion.description);
    onChangeText(suggestion.description);
    setSuggestions([]);
    setIsFocused(false);
    Keyboard.dismiss();
  };

  const showSuggestions = isFocused && suggestions.length > 0;
  const hasGoogleSuggestions = suggestions.some((suggestion) => suggestion.source !== 'local');

  return (
    <View className={cx('relative gap-2', error || helperText ? 'mb-8' : 'mb-4')}>
      <Text className="text-[12px] font-black uppercase tracking-[0.7px] text-subtle-foreground">{label}</Text>
      <View
        className={cx(
          'min-h-[56px] flex-row items-center rounded-[24px] border bg-surface px-4',
          error ? 'border-destructive-border bg-destructive-surface' : 'border-border',
          disabled && 'bg-[#F3F6FA] opacity-70',
        )}>
        <MapPinned size={18} color="#346EF6" strokeWidth={2.35} />
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
          editable={!disabled}
          placeholder={placeholder}
          placeholderTextColor="#9AA4B8"
          className="min-w-0 flex-1 px-3 text-[15px] font-bold text-foreground"
        />
        <Search size={16} color="#9AA4B8" strokeWidth={2.35} />
      </View>

      {showSuggestions ? (
        <View
          className="overflow-hidden rounded-[24px] border border-border bg-surface shadow-md shadow-foreground/5"
          style={{ elevation: 8, zIndex: 30 }}>
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={suggestion.place_id}
              accessibilityRole="button"
              onPress={() => handleSelectSuggestion(suggestion)}
              className={cx('flex-row gap-3 px-4 py-3', index !== suggestions.length - 1 && 'border-b border-[#EEF2FF]')}>
              <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-muted">
                <MapPinned size={15} color="#346EF6" strokeWidth={2.35} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-[13px] font-black leading-5 text-foreground" numberOfLines={1}>
                  {suggestion.structured_formatting?.main_text ?? suggestion.description}
                </Text>
                <Text className="mt-0.5 text-[11px] font-semibold leading-4 text-muted-foreground" numberOfLines={2}>
                  {suggestion.structured_formatting?.secondary_text ?? suggestion.description}
                </Text>
              </View>
            </Pressable>
          ))}
          <Text className="border-t border-[#EEF2FF] px-4 py-2 text-right text-[10px] font-black text-subtle-foreground">
            {hasGoogleSuggestions ? 'Powered by Google' : 'Philippines only'}
          </Text>
        </View>
      ) : null}

      {isLoading ? <Text className="text-[11px] font-bold text-subtle-foreground">Searching Google Maps...</Text> : null}
      <View className="absolute left-1 right-1 top-full mt-1.5">
        {error || helperText ? (
          <Text className={cx('text-[11px] font-bold leading-4 text-subtle-foreground', error && 'text-destructive')}>
            {error || helperText}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
