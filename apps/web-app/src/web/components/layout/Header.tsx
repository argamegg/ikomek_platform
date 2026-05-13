import { ChevronDown, Globe2, LogOut, PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { User } from "../../../types/platform";
import { cn } from "../../lib/cn";
import { session } from "../../lib/session";
import { Button } from "../ui/Button";

type HeaderProps = {
  currentUser: User | null;
  isCompact: boolean;
  onToggleMobileSidebar: () => void;
  mobileSidebarOpen: boolean;
  onLogout: () => void;
};

export function Header({
  currentUser,
  isCompact,
  onToggleMobileSidebar,
  mobileSidebarOpen,
  onLogout,
}: HeaderProps) {
  const { t, i18n } = useTranslation();
  const userRoleLabel = currentUser ? t(`roles.${currentUser.primaryRole}`, currentUser.primaryRole) : "";
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  return (
    <header className={cn("topbar", isCompact && "topbar--compact")}>
      <div className="topbar__left">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("topbar__menu topbar__menu--mobile", mobileSidebarOpen && "topbar__menu--hidden")}
          onClick={onToggleMobileSidebar}
          aria-label="Toggle navigation"
        >
          {mobileSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </Button>
      </div>
      <div className="topbar__right">
        <label className="language-switcher">
          <Globe2 size={16} />
          <select
            value={i18n.language}
            onChange={(event) => {
              const nextLocale = event.target.value;
              session.setLocale(nextLocale);
              void i18n.changeLanguage(nextLocale);
            }}
            aria-label={t("common.language")}
          >
            <option value="en">EN</option>
            <option value="ru">RU</option>
            <option value="kz">KZ</option>
          </select>
        </label>
        {currentUser ? (
          <div className="topbar__profile-menu">
            <button
              type="button"
              className="topbar__profile"
              onClick={() => setProfileMenuOpen((value) => !value)}
              aria-expanded={profileMenuOpen}
              aria-label={t("shell.account")}
            >
              <span className="topbar__avatar">
                {currentUser.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span className="topbar__profile-copy">
                <strong>{currentUser.name}</strong>
                <small>{userRoleLabel}</small>
              </span>
              <ChevronDown size={18} className={cn("topbar__profile-chevron", profileMenuOpen && "topbar__profile-chevron--open")} />
            </button>
            {profileMenuOpen ? (
              <div className="topbar__profile-dropdown">
                <Link to="/profile" onClick={() => setProfileMenuOpen(false)}>
                  <UserRound size={16} />
                  <span>{t("nav.profile")}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    onLogout();
                  }}
                >
                  <LogOut size={16} />
                  <span>{t("common.logout")}</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <Link to="/auth" className="topbar__cta">
            <Button variant="secondary">{t("common.login")}</Button>
          </Link>
        )}
      </div>
    </header>
  );
}
