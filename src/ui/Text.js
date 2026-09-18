// src/ui/Text.js
// Замена <Text> из react-native: подставляет семейство Manrope по fontWeight.
// Если в стиле уже задан fontFamily (иконки и т.п.) — не трогаем.

import { Text as RNText, StyleSheet } from 'react-native';

import { familyForWeight } from '../theme/fonts';

export function Text({ style, ...rest }) {
  const flat = StyleSheet.flatten(style);
  const override =
    flat && flat.fontFamily
      ? null
      : {
          fontFamily: familyForWeight(flat && flat.fontWeight),
          fontWeight: 'normal',
        };
  return (
    <RNText {...rest} style={override ? [style, override] : style} />
  );
}

export default Text;
