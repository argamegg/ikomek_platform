import { RouterLink } from "../../router/router";
import type { RouteConfig } from "../../types/platform";

type SidebarProps = {
  routes: RouteConfig[];
  currentPath: string;
  currentUserName?: string;
};

export function Sidebar({ routes, currentPath, currentUserName }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo">109</span>
        <div>
          <p className="eyebrow">iKomek</p>
          <strong>Web Platform</strong>
          <p className="sidebar__user">{currentUserName ?? "Public visitor"}</p>
        </div>
      </div>
      <nav className="sidebar__nav" aria-label="Platform navigation">
        {routes.map((route, index) => (
          <RouterLink
            key={route.path}
            to={route.path}
            className={currentPath === route.path ? "sidebar__link is-active" : "sidebar__link"}
          >
            <span className="sidebar__index">{String(index + 1).padStart(2, "0")}</span>
            <span>{route.label}</span>
          </RouterLink>
        ))}
      </nav>
      <div className="sidebar__note">
        <p className="eyebrow">Shared backend</p>
        <p>
          Web and mobile must stay synchronized for requests, statuses, chats, media,
          saved addresses, news, and profile updates.
        </p>
      </div>
    </aside>
  );
}
