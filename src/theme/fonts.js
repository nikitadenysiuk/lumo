// src/theme/fonts.js — сопоставление начертания (fontWeight) с семейством Manrope.

export const MANROPE = {
  '100': 'Manrope_300Light',
  '200': 'Manrope_300Light',
  '300': 'Manrope_300Light',
  light: 'Manrope_300Light',
  '400': 'Manrope_400Regular',
  normal: 'Manrope_400Regular',
  regular: 'Manrope_400Regular',
  '500': 'Manrope_500Medium',
  '600': 'Manrope_600SemiBold',
  '700': 'Manrope_700Bold',
  bold: 'Manrope_700Bold',
  '800': 'Manrope_800ExtraBold',
  '900': 'Manrope_800ExtraBold',
};

export const DEFAULT_FAMILY = 'Manrope_400Regular';

export function familyForWeight(weight) {
  if (weight == null) return DEFAULT_FAMILY;
  return MANROPE[String(weight)] || DEFAULT_FAMILY;
}
