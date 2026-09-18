// src/i18n/LocaleContext.js
//
// Оборачивает приложение и заставляет экраны перерисовываться
// при смене языка. Экран берёт t() и setLocale() хуком useT().

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  i18n,
  initLocale,
  onLocaleChange,
  setLocale as applyLocale,
  SUPPORTED,
} from './index';

const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(i18n.locale || 'en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initLocale()
      .then((l) => setLocaleState(l))
      .finally(() => setReady(true));
    return onLocaleChange(setLocaleState);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      ready,
      supported: SUPPORTED,
      setLocale: applyLocale,
      // key в value меняется вместе с locale → t пересоздаётся → перерисовка
      t: (key, opts) => i18n.t(key, opts),
    }),
    [locale, ready]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useT должен использоваться внутри <LocaleProvider>');
  return ctx;
}
