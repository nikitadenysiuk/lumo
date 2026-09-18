// src/ui/Screen.js — фон экрана: очень мягкий тёплый градиент вместо плоского цвета.

import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../settings/SettingsContext';

export default function Screen({ children, style }) {
  const c = useTheme();
  return (
    <LinearGradient
      colors={c.screenGradient || [c.bg, c.bg]}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </LinearGradient>
  );
}
