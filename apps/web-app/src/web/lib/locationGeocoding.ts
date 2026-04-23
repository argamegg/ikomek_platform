import { ASTANA_CENTER_LAT, ASTANA_CENTER_LNG } from "./geoFence";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const SEARCH_LIMIT = 5;
const ASTANA_SEARCH_BOUNDS = {
  west: ASTANA_CENTER_LNG - 1.05,
  south: ASTANA_CENTER_LAT - 0.72,
  east: ASTANA_CENTER_LNG + 1.05,
  north: ASTANA_CENTER_LAT + 0.72,
};

export type GeocodedAddressSuggestion = {
  id: string;
  label: string;
  secondaryLabel?: string;
  lat: number;
  lng: number;
};

type NominatimSearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: Record<string, string | undefined>;
};

type NominatimReverseResult = {
  display_name?: string;
};

function normalizeLocale(locale: string) {
  return locale === "kz" ? "kk" : locale;
}

function buildQuery(query: string) {
  const normalized = query.trim();
  const lower = normalized.toLowerCase();
  const mentionsAstana =
    lower.includes("astana") ||
    lower.includes("астана") ||
    lower.includes("нур-султан") ||
    lower.includes("nur-sultan");

  return mentionsAstana ? normalized : `${normalized}, Astana, Kazakhstan`;
}

function buildSecondaryLabel(result: NominatimSearchResult) {
  const address = result.address ?? {};
  const parts = [
    address.road,
    address.house_number,
    address.suburb,
    address.city ?? address.town ?? address.village,
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(", ");
  }

  return result.display_name;
}

export async function searchAstanaAddresses(
  query: string,
  locale: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    q: buildQuery(query),
    format: "jsonv2",
    addressdetails: "1",
    limit: String(SEARCH_LIMIT),
    countrycodes: "kz",
    "accept-language": normalizeLocale(locale),
    viewbox: `${ASTANA_SEARCH_BOUNDS.west},${ASTANA_SEARCH_BOUNDS.north},${ASTANA_SEARCH_BOUNDS.east},${ASTANA_SEARCH_BOUNDS.south}`,
  });

  const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to geocode address: ${response.status}`);
  }

  const results = (await response.json()) as NominatimSearchResult[];

  return results
    .map((result) => {
      const lat = Number(result.lat);
      const lng = Number(result.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      return {
        id: String(result.place_id),
        label: result.display_name,
        secondaryLabel: buildSecondaryLabel(result),
        lat,
        lng,
      } satisfies GeocodedAddressSuggestion;
    })
    .filter((result): result is GeocodedAddressSuggestion => Boolean(result));
}

export async function reverseGeocodeAstanaPoint(
  lat: number,
  lng: number,
  locale: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "jsonv2",
    zoom: "18",
    "accept-language": normalizeLocale(locale),
  });

  const response = await fetch(`${NOMINATIM_BASE_URL}/reverse?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to reverse geocode point: ${response.status}`);
  }

  const result = (await response.json()) as NominatimReverseResult;
  return result.display_name?.trim() ?? "";
}
