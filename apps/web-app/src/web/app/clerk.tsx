import { createContext, useCallback, useContext } from "react";
import type { PropsWithChildren } from "react";
import { ClerkProvider, useClerk } from "@clerk/react";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

export const isClerkConfigured = Boolean(clerkPublishableKey);

type OptionalClerkSession = {
  signOutClerk: () => Promise<void>;
};

const OptionalClerkSessionContext = createContext<OptionalClerkSession>({
  signOutClerk: async () => undefined,
});

function ClerkSessionBridge({ children }: PropsWithChildren) {
  const clerk = useClerk();
  const signOutClerk = useCallback(async () => {
    await clerk.signOut();
  }, [clerk]);

  return (
    <OptionalClerkSessionContext.Provider value={{ signOutClerk }}>
      {children}
    </OptionalClerkSessionContext.Provider>
  );
}

export function useOptionalClerkSession() {
  return useContext(OptionalClerkSessionContext);
}

export function OptionalClerkProvider({ children }: PropsWithChildren) {
  if (!clerkPublishableKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      signInUrl="/auth"
      signUpUrl="/auth"
      afterSignOutUrl="/auth"
      appearance={{
        variables: {
          colorPrimary: "#ff6b00",
          borderRadius: "18px",
        },
      }}
    >
      <ClerkSessionBridge>{children}</ClerkSessionBridge>
    </ClerkProvider>
  );
}
