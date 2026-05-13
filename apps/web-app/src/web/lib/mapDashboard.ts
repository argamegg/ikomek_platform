import type { CivicRequest, District, RequestPriority } from "../../types/platform";
import {
  ASTANA_MAP_DISTRICTS,
  CITY_DISTRICT_ID,
  filterRequestsByDistrict,
  getDistrictLoadLabel,
  getDistrictLoadLevel,
  getRequestDistrictId,
  type DistrictLoadLevel,
} from "../../components/map/mapDistricts";

export type MapLayerState = {
  markers: boolean;
  clusters: boolean;
  heatmap: boolean;
  districts: boolean;
};

export type DistrictCardStat = {
  id: string;
  name: string;
  total: number;
  open: number;
  closed: number;
  loadLevel: DistrictLoadLevel;
  loadLabel: string;
};

export type CategoryStat = {
  key: string;
  label: string;
  count: number;
  percent: number;
};

export type AnalyticsStats = {
  total: number;
  open: number;
  inProgress: number;
  closed: number;
  overdue: number;
  averagePriority: string;
  busiestDistrict: DistrictCardStat | null;
  categories: CategoryStat[];
  recent: CivicRequest[];
  problemZones: string[];
  recommendation: string;
};

const closedStatuses = new Set(["closed", "resolved", "rejected"]);
const inProgressStatuses = new Set(["in_progress"]);
const openStatuses = new Set(["pending", "open"]);

const categoryLabels: Record<string, string> = {
  illegal_dump: "Незаконная свалка",
  public_smoking: "Курение в общественном месте",
  roads: "Дороги",
  street_lighting: "Освещение",
  yard: "Дворы",
  waste: "Мусор",
  water: "Вода",
  safety: "Безопасность",
  other: "Другое",
  electricity: "Электричество",
  heating: "Отопление",
  sewage: "Канализация",
  public_order: "Безопасность",
};

const priorityWeights: Record<string, number> = {
  low: 1,
  information: 1,
  medium: 2,
  warning: 2,
  normal: 2,
  high: 3,
  urgent: 3,
  critical: 4,
};

export const defaultMapLayers: MapLayerState = {
  markers: true,
  clusters: true,
  heatmap: false,
  districts: true,
};

function normalize(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/қ/g, "к")
    .replace(/ң/g, "н")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .trim();
}

export function isClosedRequest(request: CivicRequest) {
  return closedStatuses.has(request.status);
}

export function isInProgressRequest(request: CivicRequest) {
  return inProgressStatuses.has(request.status);
}

export function isOpenRequest(request: CivicRequest) {
  return openStatuses.has(request.status) || (!isClosedRequest(request) && !isInProgressRequest(request));
}

export function isOverdueRequest(request: CivicRequest) {
  if (isClosedRequest(request)) {
    return false;
  }

  const createdAt = new Date(request.createdAt).getTime();

  if (!Number.isFinite(createdAt)) {
    return false;
  }

  const ageHours = (Date.now() - createdAt) / 3_600_000;
  const limitHours = request.priority === "critical" || request.priority === "high" ? 24 : 72;

  return ageHours > limitHours;
}

export function getCategoryKey(request: CivicRequest) {
  const text = normalize(`${request.title} ${request.categoryId} ${request.categoryName} ${request.reasonName} ${request.description}`);

  if (text.includes("свал") || text.includes("dump")) {
    return "illegal_dump";
  }

  if (text.includes("кур") || text.includes("smok")) {
    return "public_smoking";
  }

  if (text.includes("дорог") || text.includes("road") || text.includes("pothole")) {
    return "roads";
  }

  if (text.includes("освещ") || text.includes("lighting") || text.includes("lamp")) {
    return "street_lighting";
  }

  if (text.includes("двор") || text.includes("yard")) {
    return "yard";
  }

  if (text.includes("мусор") || text.includes("waste") || text.includes("trash")) {
    return "waste";
  }

  if (text.includes("вод") || text.includes("water")) {
    return "water";
  }

  if (text.includes("безопас") || text.includes("order") || text.includes("safety")) {
    return "safety";
  }

  const normalizedCategory = normalize(request.categoryId || request.categoryName);
  return categoryLabels[normalizedCategory] ? normalizedCategory : "other";
}

export function getCategoryLabel(categoryKey: string) {
  return categoryLabels[categoryKey] ?? categoryKey;
}

export function getAveragePriorityLabel(requests: CivicRequest[]) {
  if (requests.length === 0) {
    return "—";
  }

  const average =
    requests.reduce((sum, request) => sum + (priorityWeights[request.priority] ?? 2), 0) /
    requests.length;

  if (average >= 3.5) {
    return "Критический";
  }

  if (average >= 2.6) {
    return "Высокий";
  }

  if (average >= 1.7) {
    return "Средний";
  }

  return "Низкий";
}

export function getPriorityWeight(priority: RequestPriority) {
  return priorityWeights[priority] ?? 2;
}

function getAddressZone(address: string) {
  return address
    .split(/[,:]/)[0]
    ?.replace(/\s+/g, " ")
    .trim() || "Не указан адрес";
}

function buildCategoryStats(requests: CivicRequest[]): CategoryStat[] {
  const counts = requests.reduce<Record<string, number>>((accumulator, request) => {
    const key = getCategoryKey(request);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([key, count]) => ({
      key,
      label: getCategoryLabel(key),
      count,
      percent: requests.length > 0 ? Math.round((count / requests.length) * 100) : 0,
    }));
}

function buildProblemZones(requests: CivicRequest[]) {
  const counts = requests.reduce<Record<string, number>>((accumulator, request) => {
    const zone = getAddressZone(request.address);
    accumulator[zone] = (accumulator[zone] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([zone, count]) => `${zone} · ${count} заявок`);
}

function buildRecommendation(
  requests: CivicRequest[],
  activeDistrictName: string,
  categories: CategoryStat[],
  zones: string[],
) {
  if (requests.length === 0) {
    return `${activeDistrictName}: сейчас нет активных точек для анализа. Держите мониторинг включенным и отслеживайте новые обращения.`;
  }

  const topCategory = categories[0]?.label ?? "городским сервисам";
  const topZone = zones[0]?.split(" · ")[0] ?? "самой активной зоне";

  if (activeDistrictName === "Вся Астана") {
    return `По городу чаще всего поступают обращения по направлению «${topCategory}». Рекомендуется усилить контроль в зоне ${topZone} и держать быстрый triage по новым заявкам.`;
  }

  return `В районе ${activeDistrictName} чаще всего поступают обращения по направлению «${topCategory}». Рекомендуется усилить контроль в зоне ${topZone} и проверить повторяющиеся адреса.`;
}

export function buildDistrictStats(requests: CivicRequest[], apiDistricts: District[] = []): DistrictCardStat[] {
  const counts = ASTANA_MAP_DISTRICTS.map((district) =>
    requests.filter((request) => getRequestDistrictId(request) === district.id).length,
  );
  const maxCount = Math.max(...counts, 1);

  return ASTANA_MAP_DISTRICTS.map((district) => {
    const districtRequests = filterRequestsByDistrict(requests, district.id);
    const total = districtRequests.length;
    const loadLevel = getDistrictLoadLevel(total, maxCount);
    const apiName = apiDistricts.find((item) => item.id === district.id || item.code === district.id)?.name;

    return {
      id: district.id,
      name: district.name || apiName || district.id,
      total,
      open: districtRequests.filter(isOpenRequest).length,
      closed: districtRequests.filter(isClosedRequest).length,
      loadLevel,
      loadLabel: getDistrictLoadLabel(loadLevel),
    };
  });
}

export function buildAnalyticsStats(
  requests: CivicRequest[],
  selectedDistrictId: string,
  districtStats: DistrictCardStat[],
): AnalyticsStats {
  const categories = buildCategoryStats(requests);
  const problemZones = buildProblemZones(requests);
  const activeDistrictName =
    selectedDistrictId === CITY_DISTRICT_ID
      ? "Вся Астана"
      : districtStats.find((district) => district.id === selectedDistrictId)?.name ?? "Район";
  const busiestDistrict =
    districtStats.length > 0
      ? [...districtStats].sort((left, right) => right.total - left.total)[0]
      : null;

  return {
    total: requests.length,
    open: requests.filter(isOpenRequest).length,
    inProgress: requests.filter(isInProgressRequest).length,
    closed: requests.filter(isClosedRequest).length,
    overdue: requests.filter(isOverdueRequest).length,
    averagePriority: getAveragePriorityLabel(requests),
    busiestDistrict: selectedDistrictId === CITY_DISTRICT_ID ? busiestDistrict : null,
    categories,
    recent: [...requests]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 5),
    problemZones,
    recommendation: buildRecommendation(requests, activeDistrictName, categories, problemZones),
  };
}

export function getScopedRequests(
  requests: CivicRequest[],
  currentUserId: string | undefined,
  mapMode: string,
) {
  if (mapMode === "my" && currentUserId) {
    return requests.filter((request) => request.citizenId === currentUserId);
  }

  return requests;
}

export function getVisibleRequests(
  requests: CivicRequest[],
  selectedDistrictId: string,
) {
  return selectedDistrictId === CITY_DISTRICT_ID
    ? requests
    : filterRequestsByDistrict(requests, selectedDistrictId);
}
