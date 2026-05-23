import React, { createContext, useContext, useEffect, useState } from 'react';
import { useGetMe, useLogin, useRegister, getGetMeQueryKey } from '@workspace/api-client-react';
import { setSessionExpiredHandler as setApiFetchExpiredHandler } from '@/lib/api';
import { setSessionExpiredHandler } from '@workspace/api-client-react';
import { toast } from '@/hooks/use-toast';

type User = any; // Adjust based on API schema

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);

  const { data: me, isLoading: meLoading, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!token,
      retry: false,
    }
  });

  useEffect(() => {
    if (me) {
      setUser(me);
    }
    if (error) {
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
    }
  }, [me, error]);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  useEffect(() => {
    const handler = () => {
      logout();
      toast({
        title: 'Сессия истекла. Пожалуйста, войдите снова.',
        variant: 'destructive',
      });
      window.location.href = '/login';
    };
    setSessionExpiredHandler(handler);
    setApiFetchExpiredHandler(handler);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
  };

  // Stay in loading state while a token exists but the user hasn't been
  // populated yet (covers the render-cycle gap between useGetMe resolving and
  // the useEffect that syncs `me` → `user` running, as well as cached responses
  // that return meLoading=false on the very first render).
  const authLoading = !!token && (meLoading || (!user && !error));

  return (
    <AuthContext.Provider value={{ user, token, isLoading: authLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
