import type { RequestPriority, RequestStatus, UserRole } from "../types/platform";

export function formatMetric(value: number, suffix = "") {
  return `${value}${suffix}`;
}

export function formatDate(isoValue: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(isoValue));
}

export function formatStatus(status: RequestStatus) {
  return {
    pending: "Pending",
    in_progress: "In Progress",
    closed: "Closed",
  }[status];
}

export function formatPriority(priority: RequestPriority) {
  return {
    low: "Low",
    normal: "Normal",
    high: "High",
  }[priority];
}

export function formatRole(role: UserRole) {
  return {
    citizen: "Citizen",
    operator: "Operator",
    admin: "Admin",
    executor: "Executor",
  }[role];
}
