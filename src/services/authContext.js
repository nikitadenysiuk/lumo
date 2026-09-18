// src/services/authContext.js
//
// Хранит состояние авторизации и раздаёт его всему приложению через
// React Context. Обёртка <AuthProvider> ставится в App.js один раз,
// а любой экран берёт данные хуком useAuth().

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from './supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  // true, пока не проверили сохранённую сессию при старте приложения
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1) Проверяем, есть ли сохранённая сессия (после перезапуска приложения)
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setLoading(false));

    // 2) Подписываемся на вход/выход/обновление токена
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signUp: (email, password) => supabase.auth.signUp({ email, password }),
      signIn: (email, password) =>
        supabase.auth.signInWithPassword({ email, password }),
      signOut: () => supabase.auth.signOut(),
      resendConfirmation: (email) =>
        supabase.auth.resend({ type: 'signup', email }),
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth должен использоваться внутри <AuthProvider>');
  }
  return ctx;
}
