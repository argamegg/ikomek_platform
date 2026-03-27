import { type MouseEvent, type PropsWithChildren, useEffect, useMemo, useState } from "react";
import { RouterContext, type RouterContextValue } from "./context";
import { useRouter } from "./useRouter";

function getLocationState() {
  return {
    pathname: window.location.pathname,
    searchParams: new URLSearchParams(window.location.search),
  };
}

export function RouterProvider({ children }: PropsWithChildren) {
  const [locationState, setLocationState] = useState(getLocationState);

  useEffect(() => {
    function handlePopState() {
      setLocationState(getLocationState());
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const value = useMemo<RouterContextValue>(
    () => ({
      pathname: locationState.pathname,
      searchParams: locationState.searchParams,
      navigate(to: string) {
        if (to === locationState.pathname) {
          return;
        }

        window.history.pushState({}, "", to);
        setLocationState(getLocationState());
      },
    }),
    [locationState.pathname, locationState.searchParams],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function RouterLink({
  to,
  className,
  children,
}: PropsWithChildren<{ to: string; className?: string }>) {
  const { navigate } = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    navigate(to);
  }

  return (
    <a href={to} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
