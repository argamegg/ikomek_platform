import * as Location from 'expo-location';
import { ASTANA_CENTER_LAT, ASTANA_CENTER_LNG } from './geoFence';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const PHOTON_BASE_URL = 'https://photon.komoot.io';
const OVERPASS_BASE_URL = 'https://overpass.kumi.systems/api/interpreter';
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

export type AddressLookupResult = {
  latitude: number;
  longitude: number;
  label: string;
};

type NominatimAddress = Record<string, string | undefined>;

type NominatimSearchResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: NominatimAddress;
};

type NominatimReverseResult = {
  display_name?: string;
  address?: NominatimAddress;
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
  type: 'node' | 'way' | 'relation';
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

export function hasUsableCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && !(Math.abs(latitude) < 0.000001 && Math.abs(longitude) < 0.000001);
}

function normalizeLocale(locale: string) {
  if (locale.startsWith('kz') || locale.startsWith('kk')) return 'kk';
  if (locale.startsWith('ru')) return 'ru';
  return 'en';
}

function buildAstanaQuery(address: string) {
  const normalizedAddress = address.trim();
  const lowerAddress = normalizedAddress.toLowerCase();
  const mentionsAstana =
    lowerAddress.includes('астана') ||
    lowerAddress.includes('astana') ||
    lowerAddress.includes('нур-султан') ||
    lowerAddress.includes('nur-sultan');

  return mentionsAstana ? normalizedAddress : `${normalizedAddress}, Астана, Казахстан`;
}

function buildPhotonQuery(address: string) {
  const normalizedAddress = address.trim();
  const lowerAddress = normalizedAddress.toLowerCase();
  const mentionsAstana =
    lowerAddress.includes('астана') ||
    lowerAddress.includes('astana') ||
    lowerAddress.includes('нур-султан') ||
    lowerAddress.includes('nur-sultan');

  return mentionsAstana ? normalizedAddress : `${normalizedAddress} Астана`;
}

function uniqueParts(parts: (string | null | undefined)[]) {
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

function isHouseNumberLike(value: string | undefined) {
  return Boolean(value?.trim().match(/^\d+[A-Za-zА-Яа-яЁё]?(?:[/-]\d+[A-Za-zА-Яа-яЁё]?)?$/));
}

function inferHouseNumber(displayName: string, street: string | undefined) {
  const parts = displayName.split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return undefined;

  const streetIndex = street
    ? parts.findIndex((part) => part.toLocaleLowerCase().includes(street.toLocaleLowerCase()))
    : -1;
  const orderedCandidates = streetIndex >= 0
    ? [parts[streetIndex - 1], parts[streetIndex + 1], ...parts]
    : parts;

  return orderedCandidates.find(isHouseNumberLike);
}

function isCyrillicLocale(locale: string) {
  const normalized = normalizeLocale(locale);
  return normalized === 'ru' || normalized === 'kk';
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

function normalizeKazakhCyrillicForRussian(value: string) {
  return value
    .replace(/[Әә]/g, (letter) => (letter === 'Ә' ? 'А' : 'а'))
    .replace(/[Ғғ]/g, (letter) => (letter === 'Ғ' ? 'Г' : 'г'))
    .replace(/[Ққ]/g, (letter) => (letter === 'Қ' ? 'К' : 'к'))
    .replace(/[Ңң]/g, (letter) => (letter === 'Ң' ? 'Н' : 'н'))
    .replace(/[Өө]/g, (letter) => (letter === 'Ө' ? 'О' : 'о'))
    .replace(/[ҰұҮү]/g, (letter) => (letter === letter.toLocaleUpperCase() ? 'У' : 'у'))
    .replace(/[Һһ]/g, (letter) => (letter === 'Һ' ? 'Х' : 'х'))
    .replace(/[Іі]/g, (letter) => (letter === 'І' ? 'И' : 'и'));
}

function localizeStreet(street: string | undefined, locale: string) {
  if (!street || !normalizeLocale(locale).startsWith('ru')) return street;

  if (street.endsWith(' даңғылы')) {
    const name = street.replace(/\s+даңғылы$/, '');
    return `проспект ${name === 'Республика' ? 'Республики' : normalizeKazakhCyrillicForRussian(name)}`;
  }

  if (street.endsWith(' көшесі')) {
    return `улица ${normalizeKazakhCyrillicForRussian(street.replace(/\s+көшесі$/, ''))}`;
  }

  return normalizeKazakhCyrillicForRussian(street);
}

function buildAddressLabel(address: NominatimAddress | undefined, fallback: string, locale = 'ru') {
  if (!address) return fallback.trim();

  const street = localizeStreet(address.road ?? address.pedestrian ?? address.footway ?? address.path, locale);
  const houseNumber = address.house_number ?? inferHouseNumber(fallback, street);
  const streetLine = uniqueParts([street, houseNumber]).join(', ');
  const city = address.city ?? address.town ?? address.village ?? address.municipality;
  const parts = uniqueParts([
    streetLine,
    address.suburb ?? address.neighbourhood ?? address.quarter,
    city,
  ]);

  return parts.join(', ') || fallback.trim();
}

function getPhotonProperty(properties: Record<string, string | number | undefined> | undefined, key: string) {
  const value = properties?.[key];
  return typeof value === 'string' ? value : undefined;
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
    normalizedLocale === 'kk' ? `${key}:kz` : '',
  ]).filter(Boolean);

  for (const key of [...localizedKeys, ...baseKeys]) {
    const value = tags[key];
    if (value?.trim()) return value;
  }

  return undefined;
}

function isInsideAstanaSearchBounds(latitude: number, longitude: number) {
  return (
    latitude >= ASTANA_SEARCH_BOUNDS.south &&
    latitude <= ASTANA_SEARCH_BOUNDS.north &&
    longitude >= ASTANA_SEARCH_BOUNDS.west &&
    longitude <= ASTANA_SEARCH_BOUNDS.east
  );
}

function buildPhotonAddressLabel(properties: Record<string, string | number | undefined> | undefined, locale: string) {
  const street = localizeStreet(
    getPhotonProperty(properties, 'street') ??
      getPhotonProperty(properties, 'name'),
    locale,
  );
  const houseNumber = getPhotonProperty(properties, 'housenumber');
  const city = getPhotonProperty(properties, 'city') ?? getPhotonProperty(properties, 'state') ?? 'Астана';
  const parts = uniqueParts([street, houseNumber, city]);

  return parts.join(', ');
}

function createAbortControllerWithTimeout(timeoutMs: number, parentSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const handleParentAbort = () => controller.abort();
  if (parentSignal?.aborted) {
    controller.abort();
  } else {
    parentSignal?.addEventListener('abort', handleParentAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      parentSignal?.removeEventListener('abort', handleParentAbort);
    },
  };
}

function isAbortError(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'name' in error &&
      (error as { name?: string }).name === 'AbortError',
  );
}

async function resolveAstanaAddressWithPhoton(
  address: string,
  language: string,
  signal?: AbortSignal,
): Promise<AddressLookupResult | null> {
  const params = new URLSearchParams({
    q: buildPhotonQuery(address),
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
  const feature = (result.features ?? []).find((item) => {
    const [longitude, latitude] = item.geometry?.coordinates ?? [];
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      hasUsableCoordinate(latitude, longitude) &&
      isInsideAstanaSearchBounds(latitude, longitude)
    );
  });
  const [longitude, latitude] = feature?.geometry?.coordinates ?? [];
  const label = buildPhotonAddressLabel(feature?.properties, language);

  if (
    !feature ||
    !label ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !hasUsableCoordinate(latitude, longitude)
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    label,
  };
}

function buildOverpassAddressLabel(tags: Record<string, string | undefined> | undefined, locale: string) {
  if (!tags) return '';

  const street = localizeStreet(
    getLocalizedTag(tags, ['addr:street', 'addr:place', 'name', 'official_name'], locale),
    locale,
  );
  const houseNumber = tags['addr:housenumber'];
  const city = getLocalizedTag(tags, ['addr:city', 'city'], locale) ?? 'Астана';
  const parts = uniqueParts([street, houseNumber, city]);

  return parts.join(', ');
}

function getElementCoordinate(element: OverpassAddressElement) {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude: Number(latitude), longitude: Number(longitude) };
}

function getDistanceScore(latitude: number, longitude: number, element: OverpassAddressElement) {
  const coordinate = getElementCoordinate(element);
  if (!coordinate) return Number.POSITIVE_INFINITY;

  return Math.hypot(latitude - coordinate.latitude, longitude - coordinate.longitude);
}

async function reverseGeocodeWithPhoton(
  latitude: number,
  longitude: number,
  language: string,
  signal?: AbortSignal,
): Promise<PhotonReverseResult | null> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
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
    getPhotonProperty(feature?.properties, 'street') ??
      getPhotonProperty(feature?.properties, 'name'),
  );

  if (!feature?.properties || !hasNamedPlace) {
    return null;
  }

  const label = buildPhotonAddressLabel(feature.properties, language);
  if (!label) return null;

  return {
    label,
    hasHouseNumber: Boolean(getPhotonProperty(feature.properties, 'housenumber')),
    isLocaleCompatible: isAddressLocaleCompatible(label, language),
  };
}

async function reverseGeocodeWithPhotonTimeout(
  latitude: number,
  longitude: number,
  language: string,
  signal?: AbortSignal,
) {
  const timeoutController = createAbortControllerWithTimeout(PHOTON_REVERSE_TIMEOUT_MS, signal);

  try {
    return await reverseGeocodeWithPhoton(latitude, longitude, language, timeoutController.signal);
  } finally {
    timeoutController.cleanup();
  }
}

async function reverseGeocodeWithOverpass(
  latitude: number,
  longitude: number,
  language: string,
  signal?: AbortSignal,
) {
  const query = [
    '[out:json][timeout:4];',
    '(',
    `way(around:${REVERSE_FALLBACK_RADIUS_METERS},${latitude},${longitude})["addr:housenumber"];`,
    `node(around:${REVERSE_FALLBACK_RADIUS_METERS},${latitude},${longitude})["addr:housenumber"];`,
    `relation(around:${REVERSE_FALLBACK_RADIUS_METERS},${latitude},${longitude})["addr:housenumber"];`,
    ');',
    'out center tags 20;',
  ].join('');
  const body = new URLSearchParams({ data: query });
  const response = await fetch(OVERPASS_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: body.toString(),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to reverse geocode with Overpass: ${response.status}`);
  }

  const result = (await response.json()) as OverpassAddressResponse;
  const elements = (result.elements ?? [])
    .map((element) => ({
      element,
      label: buildOverpassAddressLabel(element.tags, language),
    }))
    .filter((item) => item.label)
    .sort((left, right) => {
      const leftLocaleScore = isAddressLocaleCompatible(left.label, language) ? 0 : 1;
      const rightLocaleScore = isAddressLocaleCompatible(right.label, language) ? 0 : 1;
      if (leftLocaleScore !== rightLocaleScore) return leftLocaleScore - rightLocaleScore;

      return getDistanceScore(latitude, longitude, left.element) - getDistanceScore(latitude, longitude, right.element);
    });

  return elements[0]?.label ?? '';
}

async function reverseGeocodeWithOverpassTimeout(
  latitude: number,
  longitude: number,
  language: string,
  signal?: AbortSignal,
) {
  const timeoutController = createAbortControllerWithTimeout(OVERPASS_REVERSE_TIMEOUT_MS, signal);

  try {
    return await reverseGeocodeWithOverpass(latitude, longitude, language, timeoutController.signal);
  } finally {
    timeoutController.cleanup();
  }
}

export function formatExpoGeocodedAddress(
  location: Location.LocationGeocodedAddress,
  fallback: string,
) {
  const streetLine = uniqueParts([location.street ?? location.name, location.streetNumber]).join(', ');
  const parts = uniqueParts([
    streetLine,
    location.district ?? location.subregion,
    location.city ?? location.region,
  ]);

  return parts.join(', ') || fallback;
}

export async function resolveAstanaAddress(
  address: string,
  language: string,
  signal?: AbortSignal,
): Promise<AddressLookupResult | null> {
  const normalizedAddress = address.trim();
  if (!normalizedAddress) return null;

  const query = buildAstanaQuery(normalizedAddress);

  try {
    const photonResult = await resolveAstanaAddressWithPhoton(normalizedAddress, language, signal);
    if (photonResult) {
      return photonResult;
    }
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.warn('Photon address lookup failed:', error);
  }

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      limit: '1',
      addressdetails: '1',
      countrycodes: 'kz',
      'accept-language': normalizeLocale(language || 'ru'),
    });
    const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`, {
      signal,
    });
    if (response.ok) {
      const [result] = (await response.json()) as NominatimSearchResult[];
      const latitude = Number(result?.lat);
      const longitude = Number(result?.lon);
      if (hasUsableCoordinate(latitude, longitude)) {
        return {
          latitude,
          longitude,
          label: buildAddressLabel(result.address, result.display_name || query, language),
        };
      }
    }
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.warn('Nominatim address lookup failed:', error);
  }

  try {
    const [result] = await Location.geocodeAsync(query);
    if (result && hasUsableCoordinate(result.latitude, result.longitude)) {
      return {
        latitude: result.latitude,
        longitude: result.longitude,
        label: query,
      };
    }
  } catch (error) {
    console.warn('Expo address lookup failed:', error);
  }

  return null;
}

export async function reverseGeocodeAstanaPoint(
  latitude: number,
  longitude: number,
  language: string,
  signal?: AbortSignal,
) {
  const fallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  let fastPhotonAddress = '';

  try {
    const photonAddress = await reverseGeocodeWithPhotonTimeout(latitude, longitude, language, signal);
    if (photonAddress?.hasHouseNumber && photonAddress.isLocaleCompatible) {
      return photonAddress.label;
    }
    fastPhotonAddress = photonAddress?.isLocaleCompatible ? photonAddress.label : '';
  } catch (error) {
    if (isAbortError(error)) {
      if (signal?.aborted) throw error;
    } else {
      console.warn('Photon reverse geocode failed:', error);
    }
  }

  try {
    const overpassAddress = await reverseGeocodeWithOverpassTimeout(latitude, longitude, language, signal);
    if (overpassAddress.trim()) {
      return overpassAddress;
    }
  } catch (error) {
    if (isAbortError(error)) {
      if (signal?.aborted) throw error;
    } else {
      console.warn('Overpass reverse geocode failed:', error);
    }
  }

  if (fastPhotonAddress.trim()) {
    return fastPhotonAddress;
  }

  try {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: 'jsonv2',
      zoom: '18',
      addressdetails: '1',
      'accept-language': normalizeLocale(language || 'ru'),
    });
    const response = await fetch(`${NOMINATIM_BASE_URL}/reverse?${params.toString()}`, {
      signal,
    });
    if (response.ok) {
      const result = (await response.json()) as NominatimReverseResult;
      const label = buildAddressLabel(result.address, result.display_name || fallback, language);
      if (label) return label;
    }
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.warn('Nominatim reverse geocode failed:', error);
  }

  try {
    const [result] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (result) {
      return formatExpoGeocodedAddress(result, fallback);
    }
  } catch (error) {
    console.warn('Expo reverse geocode failed:', error);
  }

  return fallback;
}
