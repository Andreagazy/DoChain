const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const LAST_ACTIVITY_KEY = 'lastAuthActivityAt';

export const AUTH_IDLE_TIMEOUT_MS = 60 * 60 * 1000;

export const getStoredToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
};

export const saveAuthSession = (token: string, userJson: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, userJson);
    recordAuthActivity();
};

export const clearAuthSession = (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
};

export const recordAuthActivity = (): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
};

export const isAuthSessionIdleExpired = (): boolean => {
    if (typeof window === 'undefined') return false;

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return false;

    const lastActivityAt = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0) {
        recordAuthActivity();
        return false;
    }

    return Date.now() - lastActivityAt >= AUTH_IDLE_TIMEOUT_MS;
};
