export const startLogin = () => { if (typeof window !== "undefined") window.location.href = "/login"; };
export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
