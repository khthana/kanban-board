import { create } from 'zustand';
import { login as apiLogin, register as apiRegister, clearToken, getToken } from '../api/client';

function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

function initFromToken() {
  const token = getToken();
  if (!token) return { currentUserId: null, isAuthenticated: false };
  const payload = decodeJwt(token);
  if (!payload || payload.exp * 1000 < Date.now()) {
    clearToken();
    return { currentUserId: null, isAuthenticated: false };
  }
  return { currentUserId: payload.sub, isAuthenticated: true };
}

const useSession = create((set) => ({
  ...initFromToken(),

  login: async (email, password) => {
    const data = await apiLogin(email, password);
    const payload = decodeJwt(data.token);
    set({ currentUserId: payload.sub, isAuthenticated: true });
  },

  register: async (email, password, displayName) => {
    const data = await apiRegister(email, password, displayName);
    const payload = decodeJwt(data.token);
    set({ currentUserId: payload.sub, isAuthenticated: true });
  },

  logout: () => {
    clearToken();
    set({ currentUserId: null, isAuthenticated: false });
  },
}));

export default useSession;
