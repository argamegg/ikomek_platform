type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

type RequestOption = {
  id: string;
  legacyLabels?: string[];
};

type RequestCategory = {
  id: string;
  i18nKey: string;
  legacyLabels?: string[];
};

export const statusKeyMap: Record<string, string> = {
  pending: 'requests.statuses.pending',
  in_progress: 'requests.statuses.in_progress',
  closed: 'requests.statuses.closed',
  open: 'requests.statuses.open',
  resolved: 'requests.statuses.resolved',
  rejected: 'requests.statuses.rejected',
};

export const priorityKeyMap: Record<string, string> = {
  low: 'priority.low',
  medium: 'priority.medium',
  high: 'priority.high',
};

const REQUEST_CATEGORIES: RequestCategory[] = [
  { id: 'electricity', i18nKey: 'electricity', legacyLabels: ['Electricity', 'Электричество', 'Электр қуаты'] },
  { id: 'water', i18nKey: 'water', legacyLabels: ['Water Supply', 'Water', 'Водоснабжение', 'Сумен қамтамасыз ету'] },
  { id: 'roads', i18nKey: 'roads', legacyLabels: ['Roads', 'Дороги', 'Жолдар'] },
  { id: 'public_order', i18nKey: 'publicOrder', legacyLabels: ['Public Order', 'Нарушение порядка', 'Тәртіп бұзушылық'] },
  { id: 'waste', i18nKey: 'waste', legacyLabels: ['Waste', 'Мусор', 'Қоқыс'] },
  { id: 'heating', i18nKey: 'heating', legacyLabels: ['Heating', 'Отопление', 'Жылыту'] },
  { id: 'street_lighting', i18nKey: 'streetLighting', legacyLabels: ['Street Lighting', 'Уличное освещение', 'Көше жарығы'] },
  { id: 'sewage', i18nKey: 'sewage', legacyLabels: ['Sewage', 'Канализация', 'Кәріз'] },
  { id: 'other', i18nKey: 'other', legacyLabels: ['Other', 'Другое', 'Басқа'] },
];

const PLACE_TYPES: RequestOption[] = [
  { id: 'apartment', legacyLabels: ['Apartment', 'Квартира', 'Пәтер'] },
  { id: 'house', legacyLabels: ['Private House', 'House', 'Частный дом', 'Дом', 'Жеке үй', 'Үй'] },
  { id: 'office', legacyLabels: ['Office', 'Офис', 'Кеңсе'] },
  { id: 'street', legacyLabels: ['Street', 'Улица', 'Көше'] },
  { id: 'park', legacyLabels: ['Park/Square', 'Park', 'Парк/сквер', 'Парк', 'Саябақ/алаң', 'Саябақ'] },
  { id: 'entrance', legacyLabels: ['Entrance', 'Подъезд', 'Кіреберіс'] },
  { id: 'yard', legacyLabels: ['Yard', 'Двор', 'Аула'] },
  { id: 'parking', legacyLabels: ['Parking', 'Паркинг', 'Тұрақ'] },
  { id: 'other', legacyLabels: ['Other', 'Другое', 'Басқа'] },
];

const PROBLEM_TYPES: Record<string, RequestOption[]> = {
  electricity: [
    { id: 'power_outage', legacyLabels: ['Power outage'] },
    { id: 'voltage_issue', legacyLabels: ['Voltage fluctuation'] },
    { id: 'damaged_cables', legacyLabels: ['Damaged cables'] },
    { id: 'street_light', legacyLabels: ['Street light not working'] },
    { id: 'sparks', legacyLabels: ['Sparks/Fire hazard'] },
    { id: 'other', legacyLabels: ['Other electrical issue'] },
  ],
  water: [
    { id: 'no_water', legacyLabels: ['No water supply'] },
    { id: 'low_pressure', legacyLabels: ['Low water pressure'] },
    { id: 'pipe_leak', legacyLabels: ['Pipe leak'] },
    { id: 'dirty_water', legacyLabels: ['Dirty/discolored water'] },
    { id: 'sewage', legacyLabels: ['Sewage problem'] },
    { id: 'other', legacyLabels: ['Other water issue'] },
  ],
  sewage: [
    { id: 'blockage', legacyLabels: ['Sewage blockage', 'Blockage'] },
    { id: 'leak', legacyLabels: ['Sewage leak', 'Leak'] },
    { id: 'odor', legacyLabels: ['Bad sewage smell', 'Odor'] },
    { id: 'overflow', legacyLabels: ['Sewage overflow', 'Overflow'] },
    { id: 'manhole', legacyLabels: ['Open or damaged manhole', 'Manhole issue'] },
    { id: 'other', legacyLabels: ['Other sewage issue'] },
  ],
  roads: [
    { id: 'pothole', legacyLabels: ['Pothole'] },
    { id: 'damaged_pavement', legacyLabels: ['Damaged pavement'] },
    { id: 'road_sign', legacyLabels: ['Missing/damaged road sign'] },
    { id: 'traffic_light', legacyLabels: ['Traffic light issue'] },
    { id: 'road_marking', legacyLabels: ['Road marking needed'] },
    { id: 'other', legacyLabels: ['Other road issue'] },
  ],
  public_order: [
    { id: 'noise', legacyLabels: ['Noise complaint'] },
    { id: 'illegal_parking', legacyLabels: ['Illegal parking'] },
    { id: 'vandalism', legacyLabels: ['Vandalism'] },
    { id: 'abandoned_vehicle', legacyLabels: ['Abandoned vehicle'] },
    { id: 'stray_animals', legacyLabels: ['Stray animals'] },
    { id: 'other', legacyLabels: ['Other public order issue'] },
  ],
  waste: [
    { id: 'overflowing', legacyLabels: ['Overflowing trash bin'] },
    { id: 'illegal_dump', legacyLabels: ['Illegal dump site'] },
    { id: 'missed_collection', legacyLabels: ['Missed garbage collection'] },
    { id: 'hazardous', legacyLabels: ['Hazardous waste'] },
    { id: 'bulk_waste', legacyLabels: ['Bulk waste removal needed'] },
    { id: 'other', legacyLabels: ['Other waste issue'] },
  ],
  heating: [
    { id: 'no_heating', legacyLabels: ['No heating'] },
    { id: 'radiator_leak', legacyLabels: ['Radiator leak'] },
    { id: 'cold_apartment', legacyLabels: ['Cold apartment'] },
    { id: 'overheating', legacyLabels: ['Overheating'] },
    { id: 'noise', legacyLabels: ['Heating system noise'] },
    { id: 'other', legacyLabels: ['Other heating issue'] },
  ],
  street_lighting: [
    { id: 'lamp_out', legacyLabels: ['Lamp not working'] },
    { id: 'flickering', legacyLabels: ['Flickering light'] },
    { id: 'damaged_pole', legacyLabels: ['Damaged pole'] },
    { id: 'dark_area', legacyLabels: ['Dark area needs lighting'] },
    { id: 'timer', legacyLabels: ['Timer malfunction'] },
    { id: 'other', legacyLabels: ['Other lighting issue'] },
  ],
  other: [
    { id: 'general', legacyLabels: ['General complaint'] },
    { id: 'suggestion', legacyLabels: ['Suggestion'] },
    { id: 'question', legacyLabels: ['Question'] },
    { id: 'other', legacyLabels: ['Other'] },
  ],
};

const REASONS: Record<string, RequestOption[]> = {
  electricity: [
    { id: 'infrastructure', legacyLabels: ['Infrastructure failure'] },
    { id: 'weather', legacyLabels: ['Weather damage'] },
    { id: 'overload', legacyLabels: ['System overload'] },
    { id: 'maintenance', legacyLabels: ['Needs maintenance'] },
    { id: 'accident', legacyLabels: ['Accident/External damage'] },
    { id: 'unknown', legacyLabels: ['Unknown cause'] },
  ],
  water: [
    { id: 'pipe_burst', legacyLabels: ['Pipe burst'] },
    { id: 'maintenance', legacyLabels: ['Scheduled maintenance'] },
    { id: 'infrastructure', legacyLabels: ['Old infrastructure'] },
    { id: 'external', legacyLabels: ['External damage'] },
    { id: 'pressure', legacyLabels: ['Pressure issue'] },
    { id: 'unknown', legacyLabels: ['Unknown cause'] },
  ],
  sewage: [
    { id: 'pipe', legacyLabels: ['Pipe problem'] },
    { id: 'blockage', legacyLabels: ['Blockage'] },
    { id: 'wear', legacyLabels: ['Pipe wear'] },
    { id: 'overflow', legacyLabels: ['Overflow'] },
    { id: 'odor', legacyLabels: ['Odor issue'] },
    { id: 'infrastructure', legacyLabels: ['Old infrastructure'] },
    { id: 'rain', legacyLabels: ['Heavy rain'] },
    { id: 'maintenance', legacyLabels: ['Needs maintenance'] },
    { id: 'unknown', legacyLabels: ['Unknown cause'] },
  ],
  roads: [
    { id: 'weather', legacyLabels: ['Weather wear'] },
    { id: 'traffic', legacyLabels: ['Heavy traffic damage'] },
    { id: 'construction', legacyLabels: ['Construction damage'] },
    { id: 'age', legacyLabels: ['Age deterioration'] },
    { id: 'accident', legacyLabels: ['Accident damage'] },
    { id: 'unknown', legacyLabels: ['Unknown cause'] },
  ],
  public_order: [
    { id: 'resident', legacyLabels: ['Resident complaint'] },
    { id: 'safety', legacyLabels: ['Public safety concern'] },
    { id: 'community', legacyLabels: ['Community concern'] },
    { id: 'legal', legacyLabels: ['Legal violation'] },
    { id: 'recurring', legacyLabels: ['Recurring issue'] },
    { id: 'other', legacyLabels: ['Other reason'] },
  ],
  waste: [
    { id: 'schedule', legacyLabels: ['Schedule issue'] },
    { id: 'container', legacyLabels: ['Container damage'] },
    { id: 'illegal', legacyLabels: ['Illegal dumping'] },
    { id: 'volume', legacyLabels: ['Volume increase'] },
    { id: 'access', legacyLabels: ['Access problem'] },
    { id: 'other', legacyLabels: ['Other reason'] },
  ],
  heating: [
    { id: 'boiler', legacyLabels: ['Boiler issue'] },
    { id: 'pipe', legacyLabels: ['Pipe problem'] },
    { id: 'system', legacyLabels: ['System failure'] },
    { id: 'regulation', legacyLabels: ['Temperature regulation'] },
    { id: 'maintenance', legacyLabels: ['Needs maintenance'] },
    { id: 'unknown', legacyLabels: ['Unknown cause'] },
  ],
  street_lighting: [
    { id: 'bulb', legacyLabels: ['Bulb failure'] },
    { id: 'electrical', legacyLabels: ['Electrical issue'] },
    { id: 'vandalism', legacyLabels: ['Vandalism'] },
    { id: 'timer', legacyLabels: ['Timer malfunction'] },
    { id: 'age', legacyLabels: ['Age/Wear'] },
    { id: 'unknown', legacyLabels: ['Unknown cause'] },
  ],
  other: [
    { id: 'quality', legacyLabels: ['Quality of service'] },
    { id: 'safety', legacyLabels: ['Safety concern'] },
    { id: 'environment', legacyLabels: ['Environmental issue'] },
    { id: 'other', legacyLabels: ['Other'] },
  ],
};

const normalize = (value?: string | null) => (value || '').trim().toLowerCase();

const prettify = (value?: string | null) => {
  if (!value) return '';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const translate = (t: TranslationFn, key: string, fallback?: string) => {
  const value = t(key);
  return value === key ? fallback || key : value;
};

const resolveOptionId = (options: RequestOption[], value?: string | null) => {
  const target = normalize(value);
  if (!target) return '';
  const match = options.find((option) => {
    if (normalize(option.id) === target) return true;
    if (target.endsWith(`-${normalize(option.id)}`)) return true;
    return option.legacyLabels?.some((label) => normalize(label) === target);
  });
  return match?.id || value || '';
};

export const getRequestCategoryConfig = (categoryId?: string | null) => {
  const target = normalize(categoryId);
  return REQUEST_CATEGORIES.find((category) => (
    normalize(category.id) === target ||
    category.legacyLabels?.some((label) => normalize(label) === target)
  )) || REQUEST_CATEGORIES.find((category) => category.id === 'other')!;
};

const getProblemOptions = (categoryId?: string | null) => (
  PROBLEM_TYPES[getRequestCategoryConfig(categoryId).id] || PROBLEM_TYPES.other
);

const getReasonOptions = (categoryId?: string | null) => (
  REASONS[getRequestCategoryConfig(categoryId).id] || REASONS.other
);

export const localizeRequestStatus = (status: string | undefined | null, t: TranslationFn) => {
  const key = status ? statusKeyMap[normalize(status)] : undefined;
  return key ? translate(t, key, prettify(status)) : prettify(status);
};

export const localizeRequestPriority = (priority: string | undefined | null, t: TranslationFn) => {
  const key = priority ? priorityKeyMap[normalize(priority)] : undefined;
  return key ? translate(t, key, prettify(priority)) : prettify(priority);
};

export const localizeRequestCategory = (categoryId: string | undefined | null, t: TranslationFn) => {
  const category = getRequestCategoryConfig(categoryId);
  return translate(t, `categories.${category.i18nKey}`, prettify(categoryId));
};

export const localizeRequestPlaceType = (placeType: string | undefined | null, t: TranslationFn) => {
  const id = resolveOptionId(PLACE_TYPES, placeType);
  return translate(t, `placeTypes.${id}`, prettify(placeType));
};

export const localizeRequestProblemType = (
  categoryId: string | undefined | null,
  problemType: string | undefined | null,
  t: TranslationFn,
) => {
  const id = resolveOptionId(getProblemOptions(categoryId), problemType);
  const category = getRequestCategoryConfig(categoryId);
  const localizedProblemType = translate(t, `problemTypes.${category.id}.${id}`, prettify(problemType));
  const fallback = prettify(problemType);

  if (localizedProblemType !== fallback) {
    return localizedProblemType;
  }

  const reasonId = resolveOptionId(getReasonOptions(categoryId), problemType);
  return translate(t, `reasons.${category.id}.${reasonId}`, fallback);
};

export const localizeRequestReason = (
  categoryId: string | undefined | null,
  reason: string | undefined | null,
  t: TranslationFn,
) => {
  const id = resolveOptionId(getReasonOptions(categoryId), reason);
  return translate(t, `reasons.${getRequestCategoryConfig(categoryId).id}.${id}`, prettify(reason));
};

export const localizeRequestDescription = (
  description: string | undefined | null,
  categoryId: string | undefined | null,
  problemType: string | undefined | null,
  reason: string | undefined | null,
  t: TranslationFn,
) => {
  if (!description) return '';

  const problemLabel = localizeRequestProblemType(categoryId, problemType, t);
  const reasonLabel = localizeRequestReason(categoryId, reason, t);
  const defaultDescription = `${problemType || ''} - ${reason || ''}`;

  if (description === defaultDescription) {
    return `${problemLabel} - ${reasonLabel}`;
  }

  const parts = description.split(' - ');
  if (parts.length === 2) {
    const localizedLeft = localizeRequestProblemType(categoryId, parts[0], t);
    const localizedRight = localizeRequestReason(categoryId, parts[1], t);
    if (localizedLeft !== parts[0] || localizedRight !== parts[1]) {
      return `${localizedLeft} - ${localizedRight}`;
    }
  }

  return description;
};

export const localizeAttachmentType = (type: string | undefined | null, t: TranslationFn) => {
  const normalized = normalize(type);
  if (normalized === 'image' || normalized === 'document') {
    return translate(t, `requests.attachmentTypes.${normalized}`, prettify(type));
  }
  return prettify(type);
};
