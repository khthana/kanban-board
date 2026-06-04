import { create } from 'zustand';
import { login as apiLogin, register as apiRegister, getMe, patchMe, clearToken, getToken } from '../api/client';

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
  if (!payload || payload.exp * 1000 < Date.now() + 60_000) {
    clearToken();
    return { currentUserId: null, isAuthenticated: false };
  }
  return { currentUserId: payload.sub, isAuthenticated: true };
}

const useSession = create((set) => ({
  ...initFromToken(),
  displayName: null,
  email: null,

  login: async (email, password) => {
    const data = await apiLogin(email, password);
    const payload = decodeJwt(data.token);
    const profile = await getMe();
    set({ currentUserId: payload.sub, isAuthenticated: true, displayName: profile.displayName, email: profile.email });
  },

  register: async (email, password, displayName) => {
    const data = await apiRegister(email, password, displayName);
    const payload = decodeJwt(data.token);
    const profile = await getMe();
    set({ currentUserId: payload.sub, isAuthenticated: true, displayName: profile.displayName, email: profile.email });
  },

  updateProfile: async (patch) => {
    const updated = await patchMe(patch);
    set({ displayName: updated.displayName, email: updated.email });
  },

  fetchProfile: async () => {
    const profile = await getMe();
    set({ displayName: profile.displayName, email: profile.email });
  },

  logout: () => {
    clearToken();
    set({ currentUserId: null, isAuthenticated: false, displayName: null, email: null });
  },
}));

export default useSession;
