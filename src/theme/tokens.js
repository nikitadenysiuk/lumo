// src/theme/tokens.js — единые токены отступов, радиусов и типографики.

export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };

export const RADIUS = { sm: 8, md: 10, lg: 12, xl: 16, xxl: 20, pill: 999 };

// Начертания используем как значения fontWeight в стилях.
export const TYPE = {
  display: { fontSize: 32, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '800' },
  heading: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
};

export const TABULAR = { fontVariant: ['tabular-nums'] };
