import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { User } from '@genki/types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://api.genki.in';

type AuthContextType = {
  dbUser: User | null;
  isLoading: boolean;
  syncUser: () => Promise<void>;
  updateDbUser: (patch: Partial<User>) => void;
};

const AuthContext = createContext<AuthContextType>({
  dbUser: null,
  isLoading: false,
  syncUser: async () => {},
  updateDbUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const syncUser = useCallback(async () => {
    if (!clerkUser) return;
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/v1/auth/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setDbUser(data.user ?? data);
      }
    } catch (error) {
      console.warn('[AuthContext] syncUser failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [clerkUser, getToken]);

  // Locally merge fields into dbUser without a round-trip (e.g. after saving an
  // API key we know hasApiKey is now true).
  const updateDbUser = useCallback((patch: Partial<User>) => {
    setDbUser(prev => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ dbUser, isLoading, syncUser, updateDbUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
