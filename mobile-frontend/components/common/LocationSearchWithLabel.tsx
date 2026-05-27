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

type GooglePlacePrediction = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  source?: 'google' | 'local';
};

type GooglePlacesAutocompleteResponse = {
  predictions?: GooglePlacePrediction[];
  status?: string;
  error_message?: string;
};

type GooglePlacesNewSuggestion = {
  placePrediction?: {
    placeId?: string;
    text?: {
      text?: string;
    };
    structuredFormat?: {
      mainText?: {
        text?: string;
      };
      secondaryText?: {
        text?: string;
      };
    };
  };
};

type GooglePlacesNewAutocompleteResponse = {
  suggestions?: GooglePlacesNewSuggestion[];
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

const PHILIPPINE_LOCATION_CHOICES: GooglePlacePrediction[] = [
  {
    description: 'Dasmarinas, Cavite, Philippines',
    place_id: 'local-ph-dasmarinas-cavite',
    source: 'local',
    structured_formatting: {
      main_text: 'Dasmarinas',
      secondary_text: 'Cavite, Philippines',
    },
  },
  {
    description: 'Imus, Cavite, Philippines',
    place_id: 'local-ph-imus-cavite',
    source: 'local',
    structured_formatting: {
      main_text: 'Imus',
      secondary_text: 'Cavite, Philippines',
    },
  },
  {
    description: 'Bacoor, Cavite, Philippines',
    place_id: 'local-ph-bacoor-cavite',
    source: 'local',
    structured_formatting: {
      main_text: 'Bacoor',
      secondary_text: 'Cavite, Philippines',
    },
  },
  {
    description: 'General Trias, Cavite, Philippines',
    place_id: 'local-ph-general-trias-cavite',
    source: 'local',
    structured_formatting: {
      main_text: 'General Trias',
      secondary_text: 'Cavite, Philippines',
    },
  },
  {
    description: 'Tagaytay, Cavite, Philippines',
    place_id: 'local-ph-tagaytay-cavite',
    source: 'local',
    structured_formatting: {
      main_text: 'Tagaytay',
      secondary_text: 'Cavite, Philippines',
    },
  },
  {
    description: 'Alabang, Muntinlupa, Metro Manila, Philippines',
    place_id: 'local-ph-alabang-muntinlupa',
    source: 'local',
    structured_formatting: {
      main_text: 'Alabang',
      secondary_text: 'Muntinlupa, Metro Manila, Philippines',
    },
  },
  {
    description: 'Makati, Metro Manila, Philippines',
    place_id: 'local-ph-makati',
    source: 'local',
    structured_formatting: {
      main_text: 'Makati',
      secondary_text: 'Metro Manila, Philippines',
    },
  },
  {
    description: 'Bonifacio Global City, Taguig, Metro Manila, Philippines',
    place_id: 'local-ph-bgc-taguig',
    source: 'local',
    structured_formatting: {
      main_text: 'Bonifacio Global City',
      secondary_text: 'Taguig, Metro Manila, Philippines',
    },
  },
  {
    description: 'Mall of Asia, Pasay, Metro Manila, Philippines',
    place_id: 'local-ph-moa-pasay',
    source: 'local',
    structured_formatting: {
      main_text: 'Mall of Asia',
      secondary_text: 'Pasay, Metro Manila, Philippines',
    },
  },
  {
    description: 'Ninoy Aquino International Airport, Pasay, Metro Manila, Philippines',
    place_id: 'local-ph-naia-pasay',
    source: 'local',
    structured_formatting: {
      main_text: 'Ninoy Aquino International Airport',
      secondary_text: 'Pasay, Metro Manila, Philippines',
    },
  },
];

const GOOGLE_FETCH_MINIMUM_LENGTH = 3;

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function getGoogleMapsApiKey() {
  return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
}

function createManualSuggestion(query: string): GooglePlacePrediction {
  const trimmedQuery = query.trim();

  return {
    description: trimmedQuery,
    place_id: `manual-ph-${trimmedQuery.toLowerCase()}`,
    source: 'local',
    structured_formatting: {
      main_text: `Use "${trimmedQuery}"`,
      secondary_text: 'Manual pickup address in the Philippines',
    },
  };
}

function getPhilippineFallbackSuggestions(query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const matchedLocations = PHILIPPINE_LOCATION_CHOICES.filter((location) =>
    location.description.toLowerCase().includes(normalizedQuery),
  );

  return [createManualSuggestion(query), ...matchedLocations].slice(0, 5);
}

function normalizePlacesNewSuggestion(suggestion: GooglePlacesNewSuggestion): GooglePlacePrediction | null {
  const prediction = suggestion.placePrediction;
  const description = prediction?.text?.text;

  if (!prediction || !description) {
    return null;
  }

  return {
    description,
    place_id: prediction.placeId ?? description,
    source: 'google',
    structured_formatting: {
      main_text: prediction.structuredFormat?.mainText?.text ?? description,
      secondary_text: prediction.structuredFormat?.secondaryText?.text ?? 'Philippines',
    },
  };
}

async function fetchPlacesNewSuggestions({
  apiKey,
  query,
  sessionToken,
  signal,
}: {
  apiKey: string;
  query: string;
  sessionToken: string;
  signal: AbortSignal;
}) {
  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    body: JSON.stringify({
      includedRegionCodes: ['ph'],
      input: query,
      languageCode: 'en',
      regionCode: 'PH',
      sessionToken,
    }),
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text',
    },
    method: 'POST',
    signal,
  });
  const data = (await response.json()) as GooglePlacesNewAutocompleteResponse;

  if (!response.ok || data.error) {
    return [];
  }

  return (data.suggestions ?? [])
    .map(normalizePlacesNewSuggestion)
    .filter((suggestion): suggestion is GooglePlacePrediction => Boolean(suggestion))
    .slice(0, 5);
}

async function fetchLegacyPlacesSuggestions({
  apiKey,
  query,
  sessionToken,
  signal,
}: {
  apiKey: string;
  query: string;
  sessionToken: string;
  signal: AbortSignal;
}) {
  const params = new URLSearchParams({
    components: 'country:ph',
    input: query,
    key: apiKey,
    language: 'en',
    region: 'ph',
    sessiontoken: sessionToken,
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`, {
    signal,
  });
  const data = (await response.json()) as GooglePlacesAutocompleteResponse;

  if (data.status === 'OK') {
    return (data.predictions ?? [])
      .slice(0, 5)
      .map((prediction) => ({ ...prediction, source: 'google' as const }));
  }

  return [];
}

export function LocationSearchWithLabel({
  helperText,
  label,
  onChangeText,
  placeholder = 'Search pickup location',
  value,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  helperText?: string;
}) {
  const [query, setQuery] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<GooglePlacePrediction[]>([]);
  const sessionToken = useMemo(() => Math.random().toString(36).slice(2), []);
  const apiKey = getGoogleMapsApiKey();

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!isFocused || trimmedQuery.length < 1) {
      setSuggestions([]);
      setIsLoading(false);
      return undefined;
    }

    const fallbackSuggestions = getPhilippineFallbackSuggestions(trimmedQuery);
    setSuggestions(fallbackSuggestions);

    if (!apiKey || trimmedQuery.length < GOOGLE_FETCH_MINIMUM_LENGTH) {
      setIsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsLoading(true);

      try {
        const placesNewSuggestions = await fetchPlacesNewSuggestions({
          apiKey,
          query: trimmedQuery,
          sessionToken,
          signal: controller.signal,
        });

        if (placesNewSuggestions.length > 0) {
          setSuggestions(placesNewSuggestions);
          return;
        }

        const legacySuggestions = await fetchLegacyPlacesSuggestions({
          apiKey,
          query: trimmedQuery,
          sessionToken,
          signal: controller.signal,
        });

        setSuggestions(legacySuggestions.length > 0 ? legacySuggestions : fallbackSuggestions);
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
  }, [apiKey, isFocused, query, sessionToken]);

  const handleChangeText = (nextValue: string) => {
    setQuery(nextValue);
    onChangeText(nextValue);
  };

  const handleSelectSuggestion = (suggestion: GooglePlacePrediction) => {
    setQuery(suggestion.description);
    onChangeText(suggestion.description);
    setSuggestions([]);
    setIsFocused(false);
    Keyboard.dismiss();
  };

  const showSuggestions = isFocused && suggestions.length > 0;
  const hasGoogleSuggestions = suggestions.some((suggestion) => suggestion.source !== 'local');

  return (
    <View className="gap-2">
      <Text className="text-[12px] font-black uppercase tracking-[0.7px] text-[#91A0B8]">{label}</Text>
      <View className="min-h-[56px] flex-row items-center rounded-[24px] border border-[#E6EEFF] bg-white px-4">
        <MapPinned size={18} color="#346EF6" strokeWidth={2.35} />
        <TextInput
          value={query}
          onBlur={() => {
            setTimeout(() => setIsFocused(false), 120);
          }}
          onChangeText={handleChangeText}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          placeholderTextColor="#9AA4B8"
          className="min-w-0 flex-1 px-3 text-[15px] font-bold text-[#17315F]"
        />
        <Search size={16} color="#9AA4B8" strokeWidth={2.35} />
      </View>

      {showSuggestions ? (
        <View
          className="overflow-hidden rounded-[24px] border border-[#E6EEFF] bg-white shadow-md shadow-[#17315F]/5"
          style={{ elevation: 8, zIndex: 30 }}>
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={suggestion.place_id}
              accessibilityRole="button"
              onPress={() => handleSelectSuggestion(suggestion)}
              className={cx('flex-row gap-3 px-4 py-3', index !== suggestions.length - 1 && 'border-b border-[#EEF2FF]')}>
              <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-[#EEF4FF]">
                <MapPinned size={15} color="#346EF6" strokeWidth={2.35} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-[13px] font-black leading-5 text-[#17315F]" numberOfLines={1}>
                  {suggestion.structured_formatting?.main_text ?? suggestion.description}
                </Text>
                <Text className="mt-0.5 text-[11px] font-semibold leading-4 text-[#6C7A96]" numberOfLines={2}>
                  {suggestion.structured_formatting?.secondary_text ?? suggestion.description}
                </Text>
              </View>
            </Pressable>
          ))}
          <Text className="border-t border-[#EEF2FF] px-4 py-2 text-right text-[10px] font-black text-[#91A0B8]">
            {hasGoogleSuggestions ? 'Powered by Google' : 'Philippines only'}
          </Text>
        </View>
      ) : null}

      {isLoading ? <Text className="text-[11px] font-bold text-[#91A0B8]">Searching Google Maps...</Text> : null}
      {helperText ? <Text className="text-[11px] font-bold leading-4 text-[#91A0B8]">{helperText}</Text> : null}
    </View>
  );
}
