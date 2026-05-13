type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

export const statusKeyMap: Record<string, string> = {
  pending: 'requests.statuses.pending',
  in_progress: 'requests.statuses.in_progress',
  closed: 'requests.statuses.closed',
  open: 'requests.statuses.open',
  resolved: 'requests.statuses.resolved',
  rejected: 'requests.statuses.rejected',
};

export const priorityKeyMap: Record<string, string> = {
  low: 'requests.priorities.low',
  medium: 'requests.priorities.medium',
  high: 'requests.priorities.high',
  warning: 'requests.priorities.medium',
  normal: 'requests.priorities.medium',
  info: 'requests.priorities.low',
  information: 'requests.priorities.low',
  urgent: 'requests.priorities.high',
  critical: 'requests.priorities.high',
};

const prettify = (value?: string | null) => {
  if (!value) return '';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const translate = (t: TranslationFn, key: string, fallback?: string) => {
  const value = t(key);
  return value === key ? fallback || key : value;
};

export const getStatusTranslationKey = (status: string) => (
  statusKeyMap[status] ?? status
);

export const getPriorityTranslationKey = (priority: string) => (
  priorityKeyMap[priority] ?? priority
);

export const localizeRequestStatus = (status: string | undefined | null, t: TranslationFn) => {
  const key = status ? statusKeyMap[status] : undefined;
  return key ? translate(t, key, prettify(status)) : prettify(status);
};

export const localizeRequestPriority = (priority: string | undefined | null, t: TranslationFn) => {
  const key = priority ? priorityKeyMap[priority] : undefined;
  return key ? translate(t, key, prettify(priority)) : prettify(priority);
};
