import {
  Bell,
  Compass,
  FilePlus2,
  Files,
  Home,
  LayoutDashboard,
  LogIn,
  Map,
  Settings2,
  Shield,
  Workflow,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { User } from "../../../types/platform";
import { cn } from "../../lib/cn";

type SidebarProps = {
  currentUser: User | null;
  collapsed: boolean;
  isCompact: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  requiresAuth?: boolean;
  roles?: string[];
  hiddenForRoles?: string[];
};

export function Sidebar({ currentUser, collapsed, isCompact, mobileOpen, onCloseMobile }: SidebarProps) {
  const { t } = useTranslation();

  const items: NavItem[] = [
    { to: "/", label: t("nav.home"), icon: Home },
    {
      to: "/dashboard",
      label: t("nav.dashboard"),
      icon: LayoutDashboard,
      requiresAuth: true,
      hiddenForRoles: ["operator", "admin"],
    },
    {
      to: "/requests",
      label: t("nav.requests"),
      icon: Files,
      requiresAuth: true,
      hiddenForRoles: ["operator", "admin"],
    },
    {
      to: "/requests/new",
      label: t("nav.newRequest"),
      icon: FilePlus2,
      requiresAuth: true,
      hiddenForRoles: ["operator", "admin"],
    },
    { to: "/news", label: t("nav.news"), icon: Bell },
    { to: "/map", label: t("nav.map"), icon: Map },
    {
      to: "/profile",
      label: t("nav.profile"),
      icon: Settings2,
      requiresAuth: true,
      hiddenForRoles: ["operator", "admin"],
    },
    {
      to: "/operator",
      label: t("nav.operator"),
      icon: Workflow,
      requiresAuth: true,
      roles: ["operator", "admin"],
    },
    {
      to: "/admin",
      label: t("nav.admin"),
      icon: Shield,
      requiresAuth: true,
      roles: ["admin"],
    },
    { to: "/auth", label: t("nav.auth"), icon: LogIn },
  ];

  const allowedItems = items.filter((item) => {
    if (item.requiresAuth && !currentUser) {
      return false;
    }

    if (item.roles && !item.roles.some((role) => currentUser?.roles.includes(role))) {
      return false;
    }

    if (item.hiddenForRoles && item.hiddenForRoles.some((role) => currentUser?.roles.includes(role))) {
      return false;
    }

    if (item.to === "/auth" && currentUser) {
      return false;
    }

    return true;
  });

  return (
    <>
      <div
        className={cn("sidebar-overlay", isCompact && mobileOpen && "sidebar-overlay--visible")}
        onClick={isCompact ? onCloseMobile : undefined}
      />
      <aside
        className={cn(
          "sidebar",
          collapsed && !isCompact && "sidebar--collapsed",
          isCompact && "sidebar--compact",
          isCompact && mobileOpen && "sidebar--mobile-open",
        )}
        style={!isCompact ? { width: collapsed ? 94 : 280 } : undefined}
      >
        <div className="sidebar__brand">
          <div className="sidebar__brand-mark">
            <Compass size={18} />
          </div>
          {!collapsed || isCompact ? (
            <div>
              <strong>{t("brand.name")}</strong>
              <span>{t("brand.tagline")}</span>
            </div>
          ) : null}
        </div>
        <nav className="sidebar__nav">
          {allowedItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to !== "/operator" && item.to !== "/admin"}
                className={({ isActive }) =>
                  cn("sidebar__link", isActive && "sidebar__link--active")
                }
                onClick={isCompact ? onCloseMobile : undefined}
              >
                <Icon size={18} />
                {!collapsed || isCompact ? <span>{item.label}</span> : null}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar__footer">
          <span className="sidebar__footer-label">{t("shell.status")}</span>
          {!collapsed || isCompact ? <p>{currentUser ? t("shell.connected") : t("shell.guest")}</p> : null}
        </div>
      </aside>
    </>
  );
}
