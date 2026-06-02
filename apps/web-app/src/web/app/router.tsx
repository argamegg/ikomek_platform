import type { ReactElement } from "react";
import { HandleSSOCallback } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isClerkConfigured } from "./clerk";
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
  const { t } = useTranslation();

  return (
    <div className="guard-fallback">
      <div className="loading-orb" />
      <p>{t("shell.preparing")}</p>
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
    return <Navigate to="/profile" replace />;
  }

  return children;
}

function CitizenRequestsRoute({ children }: { children: ReactElement }) {
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });

  if (currentUserQuery.isLoading) {
    return <GuardFallback />;
  }

  if (currentUserQuery.data?.roles.some((role) => role === "operator" || role === "admin")) {
    return <Navigate to="/operator" replace />;
  }

  return children;
}

function ClerkSsoCallbackRoute() {
  const navigate = useNavigate();

  if (!isClerkConfigured) {
    return <Navigate to="/auth" replace />;
  }

  function navigateToAuth(destination: string) {
    if (destination.startsWith("http")) {
      window.location.assign(destination);
      return;
    }

    navigate(destination, { replace: true });
  }

  return (
    <>
      <GuardFallback />
      <HandleSSOCallback
        navigateToApp={({ decorateUrl }) => {
          navigateToAuth(decorateUrl("/auth"));
        }}
        navigateToSignIn={() => {
          navigate("/auth", { replace: true });
        }}
        navigateToSignUp={() => {
          navigate("/auth", { replace: true });
        }}
      />
    </>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/sso-callback" element={<ClerkSsoCallbackRoute />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/requests" element={<CitizenRequestsRoute><RequestsPage /></CitizenRequestsRoute>} />
          <Route path="/requests/new" element={<ProtectedRoute><NewRequestPage /></ProtectedRoute>} />
          <Route path="/requests/:requestId" element={<RequestDetailsPage />} />
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
