import { AnimatePresence, motion } from "framer-motion";
import type { PropsWithChildren } from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { queryKeys, getErrorMessage, platformApi } from "../../services/platformApi";
import { AIAssistantWidget } from "../AIAssistantWidget";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: PropsWithChildren) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isCompactShell, setIsCompactShell] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1199px)").matches : false,
  );
  const location = useLocation();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });

  const shellState = useMemo(
    () => ({
      currentUser: currentUserQuery.data ?? null,
    }),
    [currentUserQuery.data],
  );

  async function handleLogout() {
    try {
      await platformApi.logout();
      await queryClient.invalidateQueries();
      toast.success(t("common.logout"));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 1199px)");
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsCompactShell(event.matches);
    };

    setIsCompactShell(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, []);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isCompactShell) {
      return undefined;
    }

    setCollapsed(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = mobileSidebarOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCompactShell, mobileSidebarOpen]);

  return (
    <div className="app-frame">
      <Sidebar
        currentUser={shellState.currentUser}
        collapsed={collapsed}
        isCompact={isCompactShell}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onToggleSidebar={() => setCollapsed((value) => !value)}
      />
      <div className="app-frame__content">
        <Header
          currentUser={shellState.currentUser}
          isCompact={isCompactShell}
          onToggleMobileSidebar={() => setMobileSidebarOpen((value) => !value)}
          mobileSidebarOpen={mobileSidebarOpen}
          onLogout={() => void handleLogout()}
        />
        {currentUserQuery.error ? (
          <div className="global-banner">
            {getErrorMessage(currentUserQuery.error)}
          </div>
        ) : null}
        <main className="page-shell">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
              className="page-shell__inner"
            >
              {children ?? <Outlet />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {shellState.currentUser?.primaryRole === "citizen" ? <AIAssistantWidget /> : null}
    </div>
  );
}
