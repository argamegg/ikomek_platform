const tokenKey = "ikomek.accessToken";

export const sessionService = {
  getToken() {
    return window.localStorage.getItem(tokenKey);
  },
  setToken(token: string) {
    window.localStorage.setItem(tokenKey, token);
  },
  clearToken() {
    window.localStorage.removeItem(tokenKey);
  },
};
