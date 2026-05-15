import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import "./App.css";
import { AppRouter } from "./web/app/router";
import { i18n } from "./web/app/i18n";
import { SplashScreen } from "./web/components/SplashScreen";
import { platformApi, queryKeys } from "./web/services/platformApi";

export type Copy = Record<string, unknown>;

export default function App() {
  const queryClient = useQueryClient();
  const shouldShowSplash = typeof window !== "undefined";
  const [videoFinished, setVideoFinished] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [splashMounted, setSplashMounted] = useState(true);
  const fadingOut = shouldShowSplash && splashMounted && videoFinished && dataLoaded;

  useEffect(() => {
    if (!shouldShowSplash || typeof window === "undefined") {
      return;
    }

    let cancelled = false;
    const locale = i18n.language;
    const path = window.location.pathname;
    const loaders: Array<Promise<unknown>> = [];

    const loadCurrentUser = queryClient.fetchQuery({
      queryKey: queryKeys.currentUser,
      queryFn: () => platformApi.getCurrentUser(),
    });

    const syncLocaleVariant = <T,>(
      queryKey: readonly string[],
      localizedQueryKey: readonly string[],
      queryFn: () => Promise<T>,
    ) =>
      queryClient.fetchQuery({ queryKey, queryFn }).then((data) => {
        queryClient.setQueryData(localizedQueryKey, data);
        return data;
      });

    const loadCategories = () =>
      syncLocaleVariant(
        queryKeys.categories,
        [...queryKeys.categories, locale],
        () => platformApi.getCategories(),
      );

    const loadNews = () =>
      syncLocaleVariant(queryKeys.news, [...queryKeys.news, locale], () => platformApi.getNews());

    const loadAlerts = () =>
      syncLocaleVariant(queryKeys.alerts, [...queryKeys.alerts, locale], () => platformApi.getAlerts());

    const addLoader = (loader: Promise<unknown>) => {
      loaders.push(loader);
    };

    addLoader(loadCurrentUser);

    if (path === "/" || path === "") {
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.publicRequests, queryFn: () => platformApi.getPublicRequests() }));
      addLoader(loadAlerts());
      addLoader(loadNews());
      addLoader(loadCategories());
    } else if (path === "/news") {
      addLoader(loadAlerts());
      addLoader(loadNews());
    } else if (path === "/map") {
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.publicRequests, queryFn: () => platformApi.getPublicRequests() }));
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.myRequests, queryFn: () => platformApi.getMyRequests() }));
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.districts, queryFn: () => platformApi.getDistricts() }));
    } else if (path === "/dashboard") {
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.myRequests, queryFn: () => platformApi.getMyRequests() }));
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.savedLocations, queryFn: () => platformApi.getSavedLocations() }));
      addLoader(loadAlerts());
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.notifications, queryFn: () => platformApi.getNotifications() }));
    } else if (path === "/profile") {
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.savedLocations, queryFn: () => platformApi.getSavedLocations() }));
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.notifications, queryFn: () => platformApi.getNotifications() }));
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.districts, queryFn: () => platformApi.getDistricts() }));
    } else if (path === "/requests") {
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.myRequests, queryFn: () => platformApi.getMyRequests() }));
    } else if (path === "/requests/new") {
      addLoader(loadCategories());
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.reasons, queryFn: () => platformApi.getReasons() }));
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.savedLocations, queryFn: () => platformApi.getSavedLocations() }));
    } else if (path === "/operator") {
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.allRequests(), queryFn: () => platformApi.getAllRequests() }));
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.metrics, queryFn: () => platformApi.getMetrics() }));
    } else if (path === "/admin") {
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.metrics, queryFn: () => platformApi.getMetrics() }));
      addLoader(queryClient.fetchQuery({ queryKey: queryKeys.news, queryFn: () => platformApi.getNews() }));
    } else {
      const requestMatch = path.match(/^\/requests\/([^/]+)(?:\/chat)?$/);

      if (requestMatch) {
        addLoader(
          loadCurrentUser.then((user) => queryClient.fetchQuery({
            queryKey: [...queryKeys.request(requestMatch[1]), locale, user?.id ?? "guest"],
            queryFn: () => platformApi.getRequestById(requestMatch[1]),
          })),
        );
      }
    }

    void Promise.allSettled(loaders).then(() => {
      if (!cancelled) {
        setDataLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [queryClient, shouldShowSplash]);

  return (
    <>
      <AppRouter />
      {splashMounted ? (
        <SplashScreen
          fadingOut={fadingOut}
          showProgress={videoFinished && !dataLoaded}
          onFinish={() => setVideoFinished(true)}
          onExited={() => setSplashMounted(false)}
        />
      ) : null}
    </>
  );
}
