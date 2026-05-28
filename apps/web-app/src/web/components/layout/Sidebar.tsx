import {
  Bell,
  FilePlus2,
  Files,
  Home,
  LogIn,
  Map,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Shield,
  UserRound,
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
  onToggleSidebar: () => void;
};

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

export function Sidebar({
  currentUser,
  collapsed,
  isCompact,
  mobileOpen,
  onCloseMobile,
  onToggleSidebar,
}: SidebarProps) {
  const { t } = useTranslation();
  const isCollapsed = collapsed && !isCompact;
  const isAdmin = currentUser?.roles.includes("admin") ?? false;
  const isOperator = currentUser?.roles.includes("operator") ?? false;
  const userInitials =
    currentUser?.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "IK";
  const userRoleLabel = currentUser ? t(`roles.${currentUser.primaryRole}`, currentUser.primaryRole) : t("shell.guest");
  const brandTagline = t("brand.tagline");

  const mainItems: NavItem[] = [
    { to: "/", label: t("nav.home"), icon: Home },
    { to: "/news", label: t("nav.news"), icon: Bell },
    { to: "/map", label: t("nav.map"), icon: Map },
  ];

  const sections: NavSection[] = [
    { title: t("nav.sections.main"), items: mainItems },
  ];

  if (currentUser && !isOperator && !isAdmin) {
    sections.push({
      title: t("nav.sections.personal"),
      items: [
        { to: "/profile", label: t("nav.dashboard"), icon: UserRound },
        { to: "/requests", label: t("nav.requests"), icon: Files },
        { to: "/requests/new", label: t("nav.newRequest"), icon: FilePlus2 },
      ],
    });
  }

  if (currentUser && (isOperator || isAdmin)) {
    sections.push({
      title: t("nav.sections.personal"),
      items: [{ to: "/profile", label: t("nav.cabinet"), icon: UserRound }],
    });
  }

  if (currentUser && isOperator && !isAdmin) {
    sections.push({
      title: t("nav.sections.workplace"),
      items: [{ to: "/operator", label: t("nav.operator"), icon: Workflow }],
    });
  }

  if (currentUser && isAdmin) {
    sections.push({
      title: t("nav.sections.management"),
      items: [
        { to: "/admin", label: t("nav.admin"), icon: Shield },
        { to: "/operator", label: t("nav.operator"), icon: Workflow },
      ],
    });
  }

  sections.push({
    title: t("nav.sections.system"),
    items: currentUser
      ? [{ to: "/settings", label: t("nav.settings"), icon: Settings2 }]
      : [{ to: "/auth", label: t("nav.auth"), icon: LogIn }],
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
          isCollapsed && "sidebar--collapsed",
          isCompact && "sidebar--compact",
          isCompact && mobileOpen && "sidebar--mobile-open",
        )}
        style={!isCompact ? { width: collapsed ? 94 : "var(--sidebar-width)" } : undefined}
      >
        {!isCompact ? (
          <button
            type="button"
            className="sidebar__collapse-button"
            onClick={onToggleSidebar}
            aria-label={isCollapsed ? t("shell.expandSidebar") : t("shell.collapseSidebar")}
          >
            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        ) : null}
        {isCompact && mobileOpen ? (
          <button
            type="button"
            className="sidebar__collapse-button sidebar__collapse-button--mobile"
            onClick={onCloseMobile}
            aria-label={t("shell.closeNavigation")}
          >
            <PanelLeftClose size={18} />
          </button>
        ) : null}
        <div className="sidebar__brand">
          <div className="sidebar__brand-mark">
            <img src="/appicon1.svg" alt="iKomek" width={54} height={54} />
          </div>
          <div className="sidebar__brand-copy">
            <strong>{t("brand.name")}</strong>
            <span className="sidebar__brand-tagline" title={brandTagline}>
              <span className="sidebar__brand-tagline-track">
                <span>{brandTagline}</span>
                <span aria-hidden="true">{brandTagline}</span>
              </span>
            </span>
          </div>
        </div>
        <nav className="sidebar__nav">
          {sections.map((section) => (
            <div className="sidebar__section" key={section.title}>
              <span className="sidebar__section-title">{isCollapsed ? "-" : section.title}</span>
              {section.items.map((item) => {
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
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar__footer">
          <span className="sidebar__footer-label">{isCollapsed ? "-" : t("shell.account")}</span>
          <div className="sidebar__account">
            <div className="sidebar__account-avatar">
              {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt="" /> : <span>{userInitials}</span>}
            </div>
            <div className="sidebar__account-copy">
              <strong>{currentUser ? currentUser.name : t("shell.guest")}</strong>
              <span>{userRoleLabel}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
