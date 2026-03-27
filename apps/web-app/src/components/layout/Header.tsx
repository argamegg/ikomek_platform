import type { Copy } from "../../App";
import type { Locale, User } from "../../types/platform";
import { RouterLink } from "../../router/router";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

type HeaderProps = {
  copy: Copy;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  currentUser: User | null;
  onLogout: () => Promise<void>;
};

const locales: Locale[] = ["en", "ru", "kz"];

export function Header({
  copy,
  locale,
  onLocaleChange,
  currentUser,
  onLogout,
}: HeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{copy.header.kicker}</p>
        <h1>{copy.header.title}</h1>
        <p className="topbar__summary">{copy.header.summary}</p>
        <div className="badge-row topbar__badges">
          <Badge
            label={currentUser ? currentUser.primaryRole.toUpperCase() : "PUBLIC ACCESS"}
            tone="accent"
          />
          <Badge
            label={currentUser ? currentUser.email : "Unauthenticated"}
            tone={currentUser ? "success" : "neutral"}
          />
        </div>
      </div>
      <div className="topbar__actions">
        <div className="locale-switch" aria-label={copy.header.languageLabel}>
          {locales.map((item) => (
            <button
              key={item}
              type="button"
              className={item === locale ? "locale-switch__item is-active" : "locale-switch__item"}
              onClick={() => onLocaleChange(item)}
            >
              {item.toUpperCase()}
            </button>
          ))}
        </div>
        <RouterLink to="/requests/new" className="button button--primary">
          {copy.header.primaryAction}
        </RouterLink>
        <RouterLink to="/map" className="button button--ghost">
          {copy.header.secondaryAction}
        </RouterLink>
        {currentUser ? (
          <Button label="Logout" variant="danger" onClick={() => void onLogout()} />
        ) : (
          <RouterLink to="/auth" className="button button--ghost">
            Sign in
          </RouterLink>
        )}
      </div>
    </header>
  );
}
