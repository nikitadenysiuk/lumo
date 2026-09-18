// src/theme/palettes.js
//
// Бренд Lumo — палитра «Тёплый неон». Две темы: светлая и тёмная.
// Каждый экран берёт цвета через useTheme().

// Ключи готовых палитр.
export const THEMES = ['light', 'dark'];
// Что пользователь выбирает в настройках ('system' = следовать за системой).
export const THEME_OPTIONS = ['system', 'light', 'dark'];

// Цвета колец БЖУ на Главной (не бренд-цвета, просто различимые).
export const MACRO_COLORS = {
  protein: '#FF6B35',
  fat: '#FBBF24',
  carbs: '#38BDF8',
};

const CORAL = '#FF6B35';
const CORAL_DARK = '#E85A2A';
const CORAL_LIGHT = '#FF9F6B';

// hex → 'rgba(r, g, b, a)'
export function withAlpha(hex, a) {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Акцентные цвета — пользователь выбирает в настройках. 'coral' — дефолт.
export const ACCENTS = [
  { id: 'coral', primary: CORAL, primaryDark: CORAL_DARK, primaryLight: CORAL_LIGHT },
  { id: 'blue', primary: '#3B82F6', primaryDark: '#2563EB', primaryLight: '#93C5FD' },
  { id: 'teal', primary: '#14B8A6', primaryDark: '#0D9488', primaryLight: '#5EEAD4' },
  { id: 'green', primary: '#22C55E', primaryDark: '#16A34A', primaryLight: '#86EFAC' },
  { id: 'violet', primary: '#8B5CF6', primaryDark: '#7C3AED', primaryLight: '#C4B5FD' },
  { id: 'pink', primary: '#EC4899', primaryDark: '#DB2777', primaryLight: '#F9A8D4' },
  { id: 'rose', primary: '#F43F5E', primaryDark: '#E11D48', primaryLight: '#FDA4AF' },
  { id: 'amber', primary: '#F59E0B', primaryDark: '#D97706', primaryLight: '#FCD34D' },
];
export const ACCENT_IDS = ACCENTS.map((a) => a.id);
export const DEFAULT_ACCENT = 'coral';

// Мягкая тень для карточек. Разворачивается в стиль: { ...c.shadow }.
const SHADOW_LIGHT = {
  shadowColor: '#1A1A1A',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};
const SHADOW_DARK = {
  shadowColor: '#000000',
  shadowOpacity: 0.28,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

export const palettes = {
  light: {
    dark: false,
    bg: '#F8F7F5',
    card: '#FFFFFF',
    cardBorder: '#E8E6E3',
    inputBg: '#FFFFFF',
    border: '#E0DEDB',
    divider: '#E8E6E3',
    text: '#1A1A1A',
    textMuted: '#6B6B7B',
    textFaint: '#9A9AA8',
    primary: CORAL,
    primaryDark: CORAL_DARK,
    primaryLight: CORAL_LIGHT,
    onPrimary: '#FFFFFF',
    accentSoft: 'rgba(255, 107, 53, 0.10)',
    barTrack: '#E8E6E3',
    danger: '#EF4444',
    tabBar: '#FFFFFF',
    statusBar: 'dark',
    shadow: SHADOW_LIGHT,
    screenGradient: ['#FBF7F3', '#F6F4F1'],
  },
  dark: {
    dark: true,
    bg: '#0F0F12',
    card: '#1E1E25',
    cardBorder: '#33333F',
    inputBg: '#1E1E25',
    border: '#34343F',
    divider: '#2E2E38',
    text: '#F5F5F7',
    textMuted: '#ADADBD',
    textFaint: '#83838F',
    primary: CORAL,
    primaryDark: CORAL_DARK,
    primaryLight: CORAL_LIGHT,
    onPrimary: '#FFFFFF',
    accentSoft: 'rgba(255, 107, 53, 0.16)',
    barTrack: '#33333F',
    danger: '#F87171',
    tabBar: '#0B0B0E',
    statusBar: 'light',
    shadow: SHADOW_DARK,
    screenGradient: ['#15151B', '#0E0E11'],
  },
};
