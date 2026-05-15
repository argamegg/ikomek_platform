import type {
  Locale,
  NotificationItem,
  RequestPriority,
  RequestStatus,
  UserRole,
} from "../../types/platform";

const statusToneMap: Record<string, "neutral" | "warning" | "success" | "danger" | "info"> = {
  pending: "warning",
  open: "warning",
  in_progress: "info",
  resolved: "success",
  closed: "success",
  rejected: "danger",
};

const priorityBadgeClassMap: Record<RequestPriority, string> = {
  high: "ui-badge--priority-high",
  medium: "ui-badge--priority-medium",
  low: "ui-badge--priority-low",
};

export function formatDate(value: string, locale: Locale = "en") {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatRelativeTime(value: string, locale: Locale = "en") {
  if (!value) {
    return "—";
  }

  const now = Date.now();
  const target = new Date(value).getTime();
  const diff = Math.round((target - now) / 60000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (Math.abs(diff) < 60) {
    return formatter.format(diff, "minute");
  }

  const hours = Math.round(diff / 60);
  if (Math.abs(hours) < 24) {
    return formatter.format(hours, "hour");
  }

  return formatter.format(Math.round(hours / 24), "day");
}

export function formatStatus(status: RequestStatus) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getStatusTone(status: RequestStatus) {
  return statusToneMap[status] ?? "neutral";
}

export function getPriorityBadgeClass(priority: RequestPriority) {
  return priorityBadgeClassMap[priority] ?? priorityBadgeClassMap.medium;
}

export function formatRole(role: UserRole) {
  return role.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatNotificationType(type: NotificationItem["type"]) {
  return type.replace(/\b\w/g, (char) => char.toUpperCase());
}
