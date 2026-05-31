import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SEED_USERS } from '../seed';

const useSession = create(
  persist(
    (set) => ({
      currentUserId: SEED_USERS[0].id,
      users: SEED_USERS,
      switchUser: (userId) => set({ currentUserId: userId }),
    }),
    { name: 'kanban_session' }
  )
);

export default useSession;
