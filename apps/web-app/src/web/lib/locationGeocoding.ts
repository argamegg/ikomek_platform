import { ASTANA_CENTER_LAT, ASTANA_CENTER_LNG } from "./geoFence";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const PHOTON_BASE_URL = "https://photon.komoot.io";
const OVERPASS_BASE_URL = "https://overpass.kumi.systems/api/interpreter";
const SEARCH_LIMIT = 5;
const REVERSE_FALLBACK_RADIUS_METERS = 50;
const PHOTON_REVERSE_TIMEOUT_MS = 1500;
const OVERPASS_REVERSE_TIMEOUT_MS = 2500;
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
  address?: Record<string, string | undefined>;
};

type PhotonFeature = {
  properties?: Record<string, string | number | undefined>;
  geometry?: {
    coordinates?: [number, number];
  };
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

type PhotonReverseResult = {
  label: string;
  hasHouseNumber: boolean;
  isLocaleCompatible: boolean;
};

type OverpassAddressElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string | undefined>;
};

type OverpassAddressResponse = {
  elements?: OverpassAddressElement[];
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

function buildPhotonQuery(query: string) {
  const normalized = query.trim();
  const lower = normalized.toLocaleLowerCase();
  const mentionsAstana =
    lower.includes("astana") ||
    lower.includes("астана") ||
    lower.includes("нур-султан") ||
    lower.includes("nur-sultan");

  return mentionsAstana ? normalized : `${normalized} Астана`;
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

function isHouseNumberLike(value: string | undefined) {
  return Boolean(value?.trim().match(/^\d+[A-Za-zА-Яа-яЁё]?(?:[/-]\d+[A-Za-zА-Яа-яЁё]?)?$/));
}

function inferHouseNumber(displayName: string, street: string | undefined) {
  const parts = displayName.split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return undefined;

  const streetIndex = street
    ? parts.findIndex((part) => part.toLocaleLowerCase().includes(street.toLocaleLowerCase()))
    : -1;
  const orderedCandidates = streetIndex >= 0
    ? [parts[streetIndex - 1], parts[streetIndex + 1], ...parts]
    : parts;

  return orderedCandidates.find(isHouseNumberLike);
}

function uniqueParts(parts: Array<string | undefined>) {
  const seen = new Set<string>();
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .filter((part) => {
      const key = part.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function isCyrillicLocale(locale: string) {
  const normalized = normalizeLocale(locale);
  return normalized === "ru" || normalized === "kk";
}

function hasLatinLetters(value: string | undefined) {
  return Boolean(value?.match(/[A-Za-z]/));
}

function hasCyrillicLetters(value: string | undefined) {
  return Boolean(value?.match(/[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/));
}

function isAddressLocaleCompatible(label: string, locale: string) {
  if (!isCyrillicLocale(locale)) return true;
  if (!hasLatinLetters(label)) return true;

  return hasCyrillicLetters(label) && !/\b(street|avenue|road|lane|boulevard|prospect)\b/i.test(label);
}

function getLocalizedTag(
  tags: Record<string, string | undefined> | undefined,
  baseKeys: string[],
  locale: string,
) {
  if (!tags) return undefined;

  const normalizedLocale = normalizeLocale(locale);
  const localizedKeys = baseKeys.flatMap((key) => [
    `${key}:${normalizedLocale}`,
    normalizedLocale === "kk" ? `${key}:kz` : "",
  ]).filter(Boolean);

  for (const key of [...localizedKeys, ...baseKeys]) {
    const value = tags[key];
    if (value?.trim()) return value;
  }

  return undefined;
}

function buildPrimaryAddressLabel(
  address: Record<string, string | undefined> | undefined,
  fallback: string,
  locale = "ru",
) {
  if (!address) return fallback.trim();

  const street = localizeOverpassStreet(
    address.road ?? address.pedestrian ?? address.footway ?? address.path,
    locale,
  );
  const houseNumber = address.house_number ?? inferHouseNumber(fallback, street);
  const streetLine = uniqueParts([street, houseNumber]).join(", ");
  const city = address.city ?? address.town ?? address.village ?? address.municipality;
  const parts = uniqueParts([
    streetLine,
    address.suburb ?? address.neighbourhood ?? address.quarter,
    city,
  ]);

  return parts.join(", ") || fallback.trim();
}

function normalizeKazakhCyrillicForRussian(value: string) {
  return value
    .replace(/[Әә]/g, (letter) => letter === "Ә" ? "А" : "а")
    .replace(/[Ғғ]/g, (letter) => letter === "Ғ" ? "Г" : "г")
    .replace(/[Ққ]/g, (letter) => letter === "Қ" ? "К" : "к")
    .replace(/[Ңң]/g, (letter) => letter === "Ң" ? "Н" : "н")
    .replace(/[Өө]/g, (letter) => letter === "Ө" ? "О" : "о")
    .replace(/[ҰұҮү]/g, (letter) => letter === letter.toLocaleUpperCase() ? "У" : "у")
    .replace(/[Һһ]/g, (letter) => letter === "Һ" ? "Х" : "х")
    .replace(/[Іі]/g, (letter) => letter === "І" ? "И" : "и");
}

function localizeOverpassStreet(street: string | undefined, locale: string) {
  if (!street || !normalizeLocale(locale).startsWith("ru")) return street;

  if (street.endsWith(" даңғылы")) {
    const name = street.replace(/\s+даңғылы$/, "");
    return `проспект ${name === "Республика" ? "Республики" : normalizeKazakhCyrillicForRussian(name)}`;
  }

  if (street.endsWith(" көшесі")) {
    return `улица ${normalizeKazakhCyrillicForRussian(street.replace(/\s+көшесі$/, ""))}`;
  }

  return normalizeKazakhCyrillicForRussian(street);
}

function getPhotonProperty(properties: Record<string, string | number | undefined> | undefined, key: string) {
  const value = properties?.[key];
  return typeof value === "string" ? value : undefined;
}

function isInsideAstanaSearchBounds(lat: number, lng: number) {
  return (
    lat >= ASTANA_SEARCH_BOUNDS.south &&
    lat <= ASTANA_SEARCH_BOUNDS.north &&
    lng >= ASTANA_SEARCH_BOUNDS.west &&
    lng <= ASTANA_SEARCH_BOUNDS.east
  );
}

function buildPhotonAddressLabel(properties: Record<string, string | number | undefined> | undefined, locale: string) {
  const street = localizeOverpassStreet(
    getPhotonProperty(properties, "street") ??
      getPhotonProperty(properties, "name"),
    locale,
  );
  const houseNumber = getPhotonProperty(properties, "housenumber");
  const city = getPhotonProperty(properties, "city") ?? "Астана";
  const parts = uniqueParts([street, houseNumber, city]);

  return parts.join(", ");
}

function createAbortControllerWithTimeout(timeoutMs: number, parentSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const handleParentAbort = () => controller.abort();
  if (parentSignal?.aborted) {
    controller.abort();
  } else {
    parentSignal?.addEventListener("abort", handleParentAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      parentSignal?.removeEventListener("abort", handleParentAbort);
    },
  };
}

async function searchAstanaAddressesWithPhoton(
  query: string,
  locale: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    q: buildPhotonQuery(query),
    limit: String(SEARCH_LIMIT),
    lat: String(ASTANA_CENTER_LAT),
    lon: String(ASTANA_CENTER_LNG),
  });

  const response = await fetch(`${PHOTON_BASE_URL}/api/?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to geocode address with Photon: ${response.status}`);
  }

  const result = (await response.json()) as PhotonResponse;

  return (result.features ?? [])
    .map((feature, index): GeocodedAddressSuggestion | null => {
      const [lng, lat] = feature.geometry?.coordinates ?? [];
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInsideAstanaSearchBounds(lat, lng)) {
        return null;
      }

      const label = buildPhotonAddressLabel(feature.properties, locale);
      if (!label) return null;

      return {
        id: `${getPhotonProperty(feature.properties, "osm_type") ?? "photon"}-${getPhotonProperty(feature.properties, "osm_id") ?? index}`,
        label,
        secondaryLabel: label,
        lat,
        lng,
      };
    })
    .filter((suggestion): suggestion is GeocodedAddressSuggestion => suggestion !== null);
}

async function reverseGeocodeWithPhoton(
  lat: number,
  lng: number,
  locale: string,
  signal?: AbortSignal,
): Promise<PhotonReverseResult | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
  });

  const response = await fetch(`${PHOTON_BASE_URL}/reverse?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to reverse geocode with Photon: ${response.status}`);
  }

  const result = (await response.json()) as PhotonResponse;
  const feature = result.features?.[0];
  const hasNamedPlace = Boolean(
    getPhotonProperty(feature?.properties, "street") ??
      getPhotonProperty(feature?.properties, "name"),
  );

  if (!feature?.properties || !hasNamedPlace) {
    return null;
  }

  const label = buildPhotonAddressLabel(feature?.properties, locale);

  if (!label) {
    return null;
  }

  return {
    label,
    hasHouseNumber: Boolean(getPhotonProperty(feature?.properties, "housenumber")),
    isLocaleCompatible: isAddressLocaleCompatible(label, locale),
  };
}

async function reverseGeocodeWithPhotonTimeout(
  lat: number,
  lng: number,
  locale: string,
  signal?: AbortSignal,
) {
  const timeoutController = createAbortControllerWithTimeout(PHOTON_REVERSE_TIMEOUT_MS, signal);

  try {
    return await reverseGeocodeWithPhoton(lat, lng, locale, timeoutController.signal);
  } finally {
    timeoutController.cleanup();
  }
}

function buildOverpassAddressLabel(tags: Record<string, string | undefined> | undefined, locale: string) {
  if (!tags) return "";

  const street = localizeOverpassStreet(
    getLocalizedTag(tags, ["addr:street", "addr:place", "name", "official_name"], locale),
    locale,
  );
  const houseNumber = tags["addr:housenumber"];
  const city = getLocalizedTag(tags, ["addr:city", "city"], locale) ?? "Астана";
  const parts = uniqueParts([street, houseNumber, city]);

  return parts.join(", ");
}

function getElementCoordinate(element: OverpassAddressElement) {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat: Number(lat), lng: Number(lng) };
}

function getDistanceScore(lat: number, lng: number, element: OverpassAddressElement) {
  const coordinate = getElementCoordinate(element);
  if (!coordinate) return Number.POSITIVE_INFINITY;

  return Math.hypot(lat - coordinate.lat, lng - coordinate.lng);
}

async function reverseGeocodeWithOverpass(lat: number, lng: number, locale: string, signal?: AbortSignal) {
  const query = [
    "[out:json][timeout:4];",
    "(",
    `way(around:${REVERSE_FALLBACK_RADIUS_METERS},${lat},${lng})["addr:housenumber"];`,
    `node(around:${REVERSE_FALLBACK_RADIUS_METERS},${lat},${lng})["addr:housenumber"];`,
    `relation(around:${REVERSE_FALLBACK_RADIUS_METERS},${lat},${lng})["addr:housenumber"];`,
    ");",
    "out center tags 20;",
  ].join("");
  const body = new URLSearchParams({ data: query });
  const response = await fetch(OVERPASS_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to reverse geocode with Overpass: ${response.status}`);
  }

  const result = (await response.json()) as OverpassAddressResponse;
  const elements = (result.elements ?? [])
    .map((element) => ({
      element,
      label: buildOverpassAddressLabel(element.tags, locale),
    }))
    .filter((item) => item.label)
    .sort((left, right) => {
      const leftLocaleScore = isAddressLocaleCompatible(left.label, locale) ? 0 : 1;
      const rightLocaleScore = isAddressLocaleCompatible(right.label, locale) ? 0 : 1;
      if (leftLocaleScore !== rightLocaleScore) return leftLocaleScore - rightLocaleScore;

      return getDistanceScore(lat, lng, left.element) - getDistanceScore(lat, lng, right.element);
    });

  return elements[0]?.label ?? "";
}

async function reverseGeocodeWithOverpassTimeout(
  lat: number,
  lng: number,
  locale: string,
  signal?: AbortSignal,
) {
  const timeoutController = createAbortControllerWithTimeout(OVERPASS_REVERSE_TIMEOUT_MS, signal);

  try {
    return await reverseGeocodeWithOverpass(lat, lng, locale, timeoutController.signal);
  } finally {
    timeoutController.cleanup();
  }
}

export async function searchAstanaAddresses(
  query: string,
  locale: string,
  signal?: AbortSignal,
) {
  try {
    const photonResults = await searchAstanaAddressesWithPhoton(query, locale, signal);
    if (photonResults.length > 0) {
      return photonResults;
    }
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
  }

  const params = new URLSearchParams({
    q: buildQuery(query),
    format: "jsonv2",
    addressdetails: "1",
    limit: String(SEARCH_LIMIT),
    countrycodes: "kz",
    "accept-language": normalizeLocale(locale),
    viewbox: `${ASTANA_SEARCH_BOUNDS.west},${ASTANA_SEARCH_BOUNDS.north},${ASTANA_SEARCH_BOUNDS.east},${ASTANA_SEARCH_BOUNDS.south}`,
  });

  let response: Response;
  try {
    response = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`, {
      signal,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const results = (await response.json()) as NominatimSearchResult[];

  return results
    .map((result): GeocodedAddressSuggestion | null => {
      const lat = Number(result.lat);
      const lng = Number(result.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      return {
        id: String(result.place_id),
        label: buildPrimaryAddressLabel(result.address, result.display_name, locale),
        secondaryLabel: buildSecondaryLabel(result),
        lat,
        lng,
      };
    })
    .filter((result): result is GeocodedAddressSuggestion => result !== null);
}

export async function reverseGeocodeAstanaPoint(
  lat: number,
  lng: number,
  locale: string,
  signal?: AbortSignal,
) {
  const coordinateFallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  let fastPhotonAddress = "";

  try {
    const photonAddress = await reverseGeocodeWithPhotonTimeout(lat, lng, locale, signal);
    if (photonAddress?.hasHouseNumber && photonAddress.isLocaleCompatible) {
      return photonAddress.label;
    }
    fastPhotonAddress = photonAddress?.isLocaleCompatible ? photonAddress.label : "";
  } catch (error: unknown) {
    if (signal?.aborted && error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
  }

  try {
    const overpassAddress = await reverseGeocodeWithOverpassTimeout(lat, lng, locale, signal);
    if (overpassAddress.trim()) {
      return overpassAddress;
    }
  } catch (error: unknown) {
    if (signal?.aborted && error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
  }

  if (fastPhotonAddress.trim()) {
    return fastPhotonAddress;
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "jsonv2",
    zoom: "18",
    addressdetails: "1",
    "accept-language": normalizeLocale(locale),
  });

  let response: Response;
  try {
    response = await fetch(`${NOMINATIM_BASE_URL}/reverse?${params.toString()}`, {
      signal,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return coordinateFallback;
  }

  if (!response.ok) {
    return coordinateFallback;
  }

  const result = (await response.json()) as NominatimReverseResult;
  return buildPrimaryAddressLabel(result.address, result.display_name ?? coordinateFallback, locale) || coordinateFallback;
}
