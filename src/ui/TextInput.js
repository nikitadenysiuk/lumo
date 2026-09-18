// src/ui/TextInput.js
// Замена <TextInput> из react-native: семейство Manrope по fontWeight.

import { TextInput as RNTextInput, StyleSheet } from 'react-native';

import { familyForWeight } from '../theme/fonts';

export function TextInput({ style, ...rest }) {
  const flat = StyleSheet.flatten(style);
  const override =
    flat && flat.fontFamily
      ? null
      : {
          fontFamily: familyForWeight(flat && flat.fontWeight),
          fontWeight: 'normal',
        };
  return (
    <RNTextInput
      {...rest}
      style={override ? [style, override] : style}
    />
  );
}

export default TextInput;
