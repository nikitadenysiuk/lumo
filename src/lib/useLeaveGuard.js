// src/lib/useLeaveGuard.js
// Подтверждение при попытке уйти с экрана с несохранёнными правками.
//
// Для обычных (не modal) экранов с кнопкой «назад» в шапке.
//
// На native-stack событие beforeRemove НЕ перехватывает ни свайп-назад, ни
// нативную кнопку «назад» (экран успевает закрыться нативно → рассинхрон,
// «screen was removed natively»). Поэтому:
//   - нативную кнопку «назад» подменяем своей (headerLeft) → чистый JS goBack;
//   - системную кнопку «назад» на Android перехватываем BackHandler.
// Свайп-назад оставляем как есть: это осознанный жест «выйти», подтверждение
// на нём не показываем (иначе тот же рассинхрон native-stack).
//
// dirty — есть ли несохранённые изменения. Возвращает allowLeave() (no-op,
// оставлен для совместимости — пути save/delete зовут navigation.goBack() сами).

import { useCallback, useEffect, useRef } from 'react';
import { Alert, BackHandler, Platform, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';

export default function useLeaveGuard(navigation, dirty) {
  const { t } = useT();
  const c = useTheme();
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const confirmLeave = useCallback(() => {
    if (!dirtyRef.current) {
      navigation.goBack();
      return;
    }
    Alert.alert(t('leave.title'), t('leave.msg'), [
      { text: t('leave.stay'), style: 'cancel' },
      {
        text: t('leave.leave'),
        style: 'destructive',
        onPress: () => navigation.goBack(),
      },
    ]);
  }, [navigation, t]);

  useEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      headerLeft: () => (
        <Pressable
          onPress={confirmLeave}
          hitSlop={16}
          style={{ paddingRight: 18, paddingVertical: 6 }}
        >
          <Ionicons
            name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
            size={Platform.OS === 'ios' ? 28 : 24}
            color={c.text}
          />
        </Pressable>
      ),
    });
  }, [navigation, confirmLeave, c.text]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!dirtyRef.current) return false;
        confirmLeave();
        return true;
      });
      return () => sub.remove();
    }, [confirmLeave])
  );

  return () => {};
}
