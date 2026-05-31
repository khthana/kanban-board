import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SEED_USERS } from '../seed';
import { v4 as uuidv4 } from 'uuid';

const useSession = create(
  persist(
    (set, get) => ({
      currentUserId: null,
      isAuthenticated: false,
      users: SEED_USERS,

      // mock login: accepts any password — swap this call for real POST /auth/login
      login: async (email, password) => {
        const users = get().users;
        const user = users.find(u => u.email === email.trim().toLowerCase());
        if (!user) throw new Error('No account with that email');
        set({ currentUserId: user.id, isAuthenticated: true });
      },

      // mock register: creates user in-memory — swap for real POST /auth/register
      register: async (email, password, displayName) => {
        const users = get().users;
        if (users.some(u => u.email === email.trim().toLowerCase())) {
          throw new Error('An account with that email already exists');
        }
        const newUser = { id: uuidv4(), email: email.trim().toLowerCase(), displayName };
        set(s => ({
          users: [...s.users, newUser],
          currentUserId: newUser.id,
          isAuthenticated: true,
        }));
      },

      logout: () => set({ currentUserId: null, isAuthenticated: false }),

      // dev-only: kept for UserSwitcher during mock phase
      switchUser: (userId) => set({ currentUserId: userId, isAuthenticated: true }),
    }),
    { name: 'kanban_session' }
  )
);

export default useSession;
