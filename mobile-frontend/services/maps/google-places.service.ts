export type PlacePrediction = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  source?: 'google' | 'local';
};

type GooglePlacesAutocompleteResponse = {
  predictions?: PlacePrediction[];
  status?: string;
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

const PHILIPPINE_LOCATION_CHOICES: PlacePrediction[] = [
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

export const GOOGLE_PLACES_FETCH_MINIMUM_LENGTH = 3;

export function createGooglePlacesSessionToken() {
  return Math.random().toString(36).slice(2);
}

export function canSearchGooglePlaces(query: string) {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) &&
    query.trim().length >= GOOGLE_PLACES_FETCH_MINIMUM_LENGTH;
}

function createManualSuggestion(query: string): PlacePrediction {
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

export function getPhilippinePlaceSuggestions(query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const matchedLocations = PHILIPPINE_LOCATION_CHOICES.filter((location) =>
    location.description.toLowerCase().includes(normalizedQuery),
  );

  return [createManualSuggestion(query), ...matchedLocations].slice(0, 5);
}

function normalizePlacesNewSuggestion(
  suggestion: GooglePlacesNewSuggestion,
): PlacePrediction | null {
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
      secondary_text:
        prediction.structuredFormat?.secondaryText?.text ?? 'Philippines',
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
  const response = await fetch(
    'https://places.googleapis.com/v1/places:autocomplete',
    {
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
    },
  );
  const data = (await response.json()) as GooglePlacesNewAutocompleteResponse;

  if (!response.ok || data.error) {
    return [];
  }

  return (data.suggestions ?? [])
    .map(normalizePlacesNewSuggestion)
    .filter((suggestion): suggestion is PlacePrediction => Boolean(suggestion))
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
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
    { signal },
  );
  const data = (await response.json()) as GooglePlacesAutocompleteResponse;

  if (data.status !== 'OK') {
    return [];
  }

  return (data.predictions ?? [])
    .slice(0, 5)
    .map((prediction) => ({ ...prediction, source: 'google' as const }));
}

export async function searchGooglePlaces({
  query,
  sessionToken,
  signal,
}: {
  query: string;
  sessionToken: string;
  signal: AbortSignal;
}) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  if (!canSearchGooglePlaces(query)) {
    return [];
  }

  const placesNewSuggestions = await fetchPlacesNewSuggestions({
    apiKey,
    query,
    sessionToken,
    signal,
  });

  if (placesNewSuggestions.length > 0) {
    return placesNewSuggestions;
  }

  return fetchLegacyPlacesSuggestions({
    apiKey,
    query,
    sessionToken,
    signal,
  });
}
