import type { RouteConfig } from "../types/platform";

export const homeBenefits = [
  {
    title: "One city platform",
    description:
      "The website extends the same iKomek ecosystem as the mobile app with shared users, requests, news, statuses, chats, and media.",
  },
  {
    title: "Real operational workflow",
    description:
      "Citizens submit requests, operators triage them, departments execute them, and admins monitor the whole system from one shared backend.",
  },
  {
    title: "City visibility",
    description:
      "Maps, alerts, request timelines, district filters, and analytics turn the platform into a daily civic operations tool, not just a form.",
  },
];

export const requestFlowSteps = [
  "Select address or saved place",
  "Choose place, issue type, and reason",
  "Add description and photos",
  "Review the map preview and submit",
];

export const primaryRoutes: RouteConfig[] = [
  { label: "Home", path: "/" },
  { label: "Authentication", path: "/auth" },
  { label: "Citizen dashboard", path: "/dashboard", requiresAuth: true },
  { label: "Submit request", path: "/requests/new", requiresAuth: true },
  { label: "My requests", path: "/requests", requiresAuth: true },
  { label: "News and alerts", path: "/news" },
  { label: "Map and analytics", path: "/map" },
  { label: "Profile and settings", path: "/profile", requiresAuth: true },
  {
    label: "Operator dashboard",
    path: "/operator",
    requiresAuth: true,
    roles: ["operator", "admin"],
  },
  {
    label: "Admin dashboard",
    path: "/admin",
    requiresAuth: true,
    roles: ["admin"],
  },
];
