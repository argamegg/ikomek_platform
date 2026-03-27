import type { PropsWithChildren } from "react";
import type { Copy } from "../../App";
import { primaryRoutes } from "../../data/platformData";
import { useRouter } from "../../router/useRouter";
import type { Locale, User } from "../../types/platform";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

type ShellProps = PropsWithChildren<{
  copy: Copy;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  currentUser: User | null;
  onLogout: () => Promise<void>;
  error: string | null;
}>;

export function Shell({
  children,
  copy,
  locale,
  onLocaleChange,
  currentUser,
  onLogout,
  error,
}: ShellProps) {
  const { pathname } = useRouter();

  return (
    <div className="app-shell">
      <Sidebar routes={primaryRoutes} currentPath={pathname} currentUserName={currentUser?.name} />
      <div className="app-shell__content">
        <Header
          copy={copy}
          locale={locale}
          onLocaleChange={onLocaleChange}
          currentUser={currentUser}
          onLogout={onLogout}
        />
        {error ? (
          <div className="page-error-banner">
            <strong>API error:</strong> {error}
          </div>
        ) : null}
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
