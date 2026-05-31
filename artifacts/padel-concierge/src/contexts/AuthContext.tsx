import React, { createContext, useContext, useEffect, useState } from 'react';
import { useGetMe, getGetMeQueryKey } from '@workspace/api-client-react';
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

  const { data: me, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!token,
      // Never give up the session over a transient failure. A genuine auth
      // failure (401/403) is terminal and must not be retried; anything else
      // (network blip, timeout, 5xx after backgrounding) is retried so a valid
      // session survives.
      retry: (failureCount: number, err: unknown) => {
        const status = (err as { status?: number })?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 8000),
    }
  });

  // Only a genuine auth failure on /me means the session is invalid.
  const isAuthError =
    !!error &&
    ((error as { status?: number }).status === 401 ||
      (error as { status?: number }).status === 403);

  useEffect(() => {
    if (me) {
      setUser(me);
      // Sliding session: persist the re-issued token returned by /auth/me so the
      // 30-day window keeps rolling forward while the user is active.
      const refreshed = (me as { token?: string }).token;
      if (refreshed && refreshed !== token) {
        localStorage.setItem('token', refreshed);
        setToken(refreshed);
      }
    }
  }, [me]);

  useEffect(() => {
    if (isAuthError) {
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
    }
    // Transient errors are intentionally ignored here: the token is retained and
    // react-query keeps retrying (and refetches on focus/reconnect).
  }, [isAuthError]);

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
  // populated yet. This also covers transient /me failures: as long as the
  // error is NOT a genuine auth error, we keep "loading" (rather than dropping
  // to the login page) so a still-valid session survives network blips while
  // react-query retries/refetches in the background.
  const authLoading = !!token && !user && !isAuthError;

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
