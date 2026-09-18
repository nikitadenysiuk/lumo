// src/components/PromptModal.js — простой центрированный диалог с одним полем ввода.
// Кросс-платформенная замена Alert.prompt (который только на iOS).

import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';

import { useTheme } from '../settings/SettingsContext';
import Button from '../ui/Button';

export default function PromptModal({
  visible,
  onClose,
  onSubmit,
  title,
  placeholder,
  confirmLabel,
  cancelLabel,
  keyboardType = 'default',
  maxLength,
  initial = '',
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [val, setVal] = useState(initial);

  useEffect(() => {
    if (visible) setVal(initial);
  }, [visible, initial]);

  const submit = () => {
    const v = val.trim();
    if (v) onSubmit(v);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            value={val}
            onChangeText={setVal}
            placeholder={placeholder}
            placeholderTextColor={c.textFaint}
            keyboardType={keyboardType}
            maxLength={maxLength}
            autoFocus
            onSubmitEditing={submit}
            returnKeyType="done"
          />
          <View style={styles.row}>
            <Button
              label={cancelLabel}
              variant="ghost"
              fullWidth={false}
              onPress={onClose}
              style={styles.btn}
            />
            <Button
              label={confirmLabel}
              fullWidth={false}
              disabled={!val.trim()}
              onPress={submit}
              style={styles.btn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: 28,
    },
    card: {
      width: '100%',
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 18,
    },
    title: { fontSize: 15, fontWeight: '800', color: c.text, marginBottom: 12 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 17,
      color: c.text,
      backgroundColor: c.inputBg,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: 14,
    },
    btn: { minWidth: 96 },
  });
