import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { I18nextProvider } from "react-i18next";
import { Toaster } from "react-hot-toast";
import { i18n } from "./i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                borderRadius: "16px",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                boxShadow: "0 24px 60px rgba(15, 23, 42, 0.14)",
                padding: "14px 16px",
              },
            }}
          />
        </MotionConfig>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
