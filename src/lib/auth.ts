import { User, UserRole } from '@/types';

const AUTH_STORAGE_KEY = 'dlh_user';

export const authService = {
  login: async (email: string, password: string, role: UserRole): Promise<User> => {
    // Simulated login - in real app this would call API Gateway
    const user: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: email.split('@')[0],
      email,
      role,
    };
    
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  logout: () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  },

  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  },

  isAuthenticated: (): boolean => {
    return !!authService.getCurrentUser();
  },
};
