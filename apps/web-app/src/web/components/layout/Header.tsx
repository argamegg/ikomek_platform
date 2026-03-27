import { Globe2, Menu, Plus, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { User } from "../../../types/platform";
import { session } from "../../lib/session";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

type HeaderProps = {
  currentUser: User | null;
  onToggleSidebar: () => void;
  onToggleMobileSidebar: () => void;
  mobileSidebarOpen: boolean;
  onLogout: () => void;
};

export function Header({
  currentUser,
  onToggleSidebar,
  onToggleMobileSidebar,
  mobileSidebarOpen,
  onLogout,
}: HeaderProps) {
  const { t, i18n } = useTranslation();
  const isOperator = currentUser?.roles.includes("operator") ?? false;
  const isAdmin = currentUser?.roles.includes("admin") ?? false;
  const showCitizenActions = Boolean(currentUser) && !isOperator && !isAdmin;
  const accountPath = isAdmin ? "/admin" : isOperator ? "/operator" : "/profile";

  return (
    <header className="topbar">
      <div className="topbar__left">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="topbar__menu topbar__menu--mobile"
          onClick={onToggleMobileSidebar}
          aria-label="Toggle navigation"
        >
          {mobileSidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="topbar__menu topbar__menu--desktop"
          onClick={onToggleSidebar}
          aria-label="Collapse sidebar"
        >
          <Menu size={18} />
        </Button>
        <div className="topbar__search">
          <Input
            aria-label={t("common.search")}
            placeholder={t("common.searchPlaceholder")}
            icon={<Search size={16} />}
          />
        </div>
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
          <>
            {showCitizenActions ? (
              <Link to="/requests/new" className="topbar__cta">
                <Button iconLeft={<Plus size={16} />}>{t("common.submitRequest")}</Button>
              </Link>
            ) : null}
            <div className="topbar__account">
              <Link to={accountPath} className="topbar__profile">
                <span className="topbar__avatar">
                  {currentUser.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <span>
                  <strong>{currentUser.name}</strong>
                  <small>{currentUser.primaryRole}</small>
                </span>
              </Link>
              <Button type="button" variant="ghost" size="sm" className="topbar__logout" onClick={onLogout}>
                {t("common.logout")}
              </Button>
            </div>
          </>
        ) : (
          <Link to="/auth" className="topbar__cta">
            <Button variant="secondary">{t("common.login")}</Button>
          </Link>
        )}
      </div>
    </header>
  );
}
