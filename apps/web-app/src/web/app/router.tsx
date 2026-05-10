import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { platformApi, queryKeys } from "../services/platformApi";
import { AuthPage } from "../pages/AuthPage";
import { HomePage } from "../pages/HomePage";
import { DashboardPage } from "../pages/DashboardPage";
import { RequestsPage } from "../pages/RequestsPage";
import { NewRequestPage } from "../pages/NewRequestPage";
import { RequestDetailsPage } from "../pages/RequestDetailsPage";
import { RequestChatPage } from "../pages/RequestChatPage";
import { NewsPage } from "../pages/NewsPage";
import { MapPage } from "../pages/MapPage";
import { ProfilePage } from "../pages/ProfilePage";
import SettingsPage from "../pages/SettingsPage";
import { OperatorPage } from "../pages/OperatorPage";
import { AdminPage } from "../pages/AdminPage";
import { NotFoundPage } from "../pages/NotFoundPage";

function GuardFallback() {
  return (
    <div className="guard-fallback">
      <div className="loading-orb" />
      <p>Preparing your workspace…</p>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactElement }) {
  const location = useLocation();
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });

  if (currentUserQuery.isLoading) {
    return <GuardFallback />;
  }

  if (!currentUserQuery.data) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function RoleRoute({ roles, children }: { roles: string[]; children: ReactElement }) {
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });

  if (currentUserQuery.isLoading) {
    return <GuardFallback />;
  }

  if (!currentUserQuery.data) {
    return <Navigate to="/auth" replace />;
  }

  if (!roles.some((role) => currentUserQuery.data?.roles.includes(role))) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
          <Route path="/requests/new" element={<ProtectedRoute><NewRequestPage /></ProtectedRoute>} />
          <Route path="/requests/:requestId" element={<ProtectedRoute><RequestDetailsPage /></ProtectedRoute>} />
          <Route path="/requests/:requestId/chat" element={<ProtectedRoute><RequestChatPage /></ProtectedRoute>} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route
            path="/operator"
            element={
              <RoleRoute roles={["operator", "admin"]}>
                <OperatorPage />
              </RoleRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <RoleRoute roles={["admin"]}>
                <AdminPage />
              </RoleRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
