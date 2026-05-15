export const WEB_SESSION_TOKEN_KEY = "ikomek.web.token";
export const WEB_SESSION_TOKEN_CLEARED_EVENT = "ikomek.web.token-cleared";
const LOCALE_KEY = "ikomek.web.locale";

function canUseStorage() {
  return typeof window !== "undefined";
}

export const session = {
  getToken() {
    if (!canUseStorage()) {
      return null;
    }

    return window.localStorage.getItem(WEB_SESSION_TOKEN_KEY);
  },
  setToken(token: string) {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.setItem(WEB_SESSION_TOKEN_KEY, token);
  },
  clearToken() {
    if (!canUseStorage()) {
      return;
    }

    const hadToken = window.localStorage.getItem(WEB_SESSION_TOKEN_KEY) !== null;
    window.localStorage.removeItem(WEB_SESSION_TOKEN_KEY);
    if (hadToken) {
      window.dispatchEvent(new Event(WEB_SESSION_TOKEN_CLEARED_EVENT));
    }
  },
  getLocale() {
    if (!canUseStorage()) {
      return null;
    }

    return window.localStorage.getItem(LOCALE_KEY);
  },
  setLocale(locale: string) {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.setItem(LOCALE_KEY, locale);
  },
};
