import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IconName = ComponentProps<typeof Ionicons>['name'];
type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

type RequestOption = {
  id: string;
  icon?: IconName;
  legacyLabels?: string[];
};

export type RequestCategory = {
  id: string;
  i18nKey: string;
  icon: IconName;
  color: string;
  legacyLabels?: string[];
};

export const REQUEST_CATEGORIES: RequestCategory[] = [
  { id: 'electricity', i18nKey: 'electricity', icon: 'flash', color: '#FFB300', legacyLabels: ['Electricity', 'Электричество', 'Электр қуаты'] },
  { id: 'water', i18nKey: 'water', icon: 'water', color: '#2196F3', legacyLabels: ['Water Supply', 'Water', 'Водоснабжение', 'Сумен қамтамасыз ету'] },
  { id: 'roads', i18nKey: 'roads', icon: 'car', color: '#607D8B', legacyLabels: ['Roads', 'Дороги', 'Жолдар'] },
  { id: 'public_order', i18nKey: 'publicOrder', icon: 'shield-checkmark', color: '#4CAF50', legacyLabels: ['Public Order', 'Нарушение порядка', 'Тәртіп бұзушылық'] },
  { id: 'waste', i18nKey: 'waste', icon: 'trash', color: '#795548', legacyLabels: ['Waste', 'Мусор', 'Қоқыс'] },
  { id: 'heating', i18nKey: 'heating', icon: 'flame', color: '#FF5722', legacyLabels: ['Heating', 'Отопление', 'Жылыту'] },
  { id: 'street_lighting', i18nKey: 'streetLighting', icon: 'bulb', color: '#FFC107', legacyLabels: ['Street Lighting', 'Уличное освещение', 'Көше жарығы'] },
  { id: 'sewage', i18nKey: 'sewage', icon: 'water', color: '#607D8B', legacyLabels: ['Sewage', 'Канализация', 'Кәріз'] },
  { id: 'other', i18nKey: 'other', icon: 'ellipsis-horizontal', color: '#9E9E9E', legacyLabels: ['Other', 'Другое', 'Басқа'] },
];

export const PLACE_TYPES: RequestOption[] = [
  { id: 'apartment', icon: 'business', legacyLabels: ['Apartment', 'Квартира', 'Пәтер'] },
  { id: 'house', icon: 'home', legacyLabels: ['Private House', 'House', 'Частный дом', 'Дом', 'Жеке үй', 'Үй'] },
  { id: 'office', icon: 'briefcase', legacyLabels: ['Office', 'Офис', 'Кеңсе'] },
  { id: 'street', icon: 'navigate', legacyLabels: ['Street', 'Улица', 'Көше'] },
  { id: 'park', icon: 'leaf', legacyLabels: ['Park/Square', 'Park', 'Парк/сквер', 'Парк', 'Саябақ/алаң', 'Саябақ'] },
  { id: 'other', icon: 'ellipsis-horizontal', legacyLabels: ['Other', 'Другое', 'Басқа'] },
];

export const PROBLEM_TYPES: Record<string, RequestOption[]> = {
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

export const REASONS: Record<string, RequestOption[]> = {
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
    return option.legacyLabels?.some((label) => normalize(label) === target);
  });
  return match?.id || value || '';
};

export const getCategoryConfig = (categoryId?: string | null) => {
  const target = normalize(categoryId);
  return REQUEST_CATEGORIES.find((category) => (
    normalize(category.id) === target ||
    category.legacyLabels?.some((label) => normalize(label) === target)
  )) || REQUEST_CATEGORIES.find((category) => category.id === 'other')!;
};

export const getProblemOptions = (categoryId?: string | null) => (
  PROBLEM_TYPES[getCategoryConfig(categoryId).id] || PROBLEM_TYPES.other
);

export const getReasonOptions = (categoryId?: string | null) => (
  REASONS[getCategoryConfig(categoryId).id] || REASONS.other
);

export const localizeCategory = (categoryId: string | undefined | null, t: TranslationFn) => {
  const category = getCategoryConfig(categoryId);
  return translate(t, `categories.${category.i18nKey}`, prettify(categoryId));
};

export const localizePlaceType = (placeType: string | undefined | null, t: TranslationFn) => {
  const id = resolveOptionId(PLACE_TYPES, placeType);
  return translate(t, `placeTypes.${id}`, prettify(placeType));
};

export const localizeProblemType = (
  categoryId: string | undefined | null,
  problemType: string | undefined | null,
  t: TranslationFn,
) => {
  const id = resolveOptionId(getProblemOptions(categoryId), problemType);
  return translate(t, `problemTypes.${getCategoryConfig(categoryId).id}.${id}`, prettify(problemType));
};

export const localizeReason = (
  categoryId: string | undefined | null,
  reason: string | undefined | null,
  t: TranslationFn,
) => {
  const id = resolveOptionId(getReasonOptions(categoryId), reason);
  return translate(t, `reasons.${getCategoryConfig(categoryId).id}.${id}`, prettify(reason));
};

export const localizeRequestDescription = (
  description: string | undefined | null,
  categoryId: string | undefined | null,
  problemType: string | undefined | null,
  reason: string | undefined | null,
  t: TranslationFn,
) => {
  if (!description) return '';

  const problemLabel = localizeProblemType(categoryId, problemType, t);
  const reasonLabel = localizeReason(categoryId, reason, t);
  const defaultDescription = `${problemType || ''} - ${reason || ''}`;

  if (description === defaultDescription) {
    return `${problemLabel} - ${reasonLabel}`;
  }

  const parts = description.split(' - ');
  if (parts.length === 2) {
    const localizedLeft = localizeProblemType(categoryId, parts[0], t);
    const localizedRight = localizeReason(categoryId, parts[1], t);
    if (localizedLeft !== parts[0] || localizedRight !== parts[1]) {
      return `${localizedLeft} - ${localizedRight}`;
    }
  }

  return description;
};

export { getStatusTranslationKey } from './requestMeta';
