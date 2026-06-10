import axios from 'axios';
import {
  clearAuthSession,
  getStoredToken,
  isAuthSessionIdleExpired,
  recordAuthActivity,
} from './auth-session';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    if (isAuthSessionIdleExpired()) {
      clearAuthSession();
      window.location.href = '/login?reason=session-expired';
      throw new axios.CanceledError('Sesi login berakhir karena tidak aktif.');
    }

    const token = getStoredToken();

    if (token) {
      recordAuthActivity();
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

export default api;
