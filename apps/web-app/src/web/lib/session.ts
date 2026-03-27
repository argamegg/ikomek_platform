const TOKEN_KEY = "ikomek.web.token";
const LOCALE_KEY = "ikomek.web.locale";

function canUseStorage() {
  return typeof window !== "undefined";
}

export const session = {
  getToken() {
    if (!canUseStorage()) {
      return null;
    }

    return window.localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken() {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.removeItem(TOKEN_KEY);
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
