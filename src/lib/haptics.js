// src/lib/haptics.js — тактильный отклик (тихо падает, если недоступно).

import * as Haptics from 'expo-haptics';

export const hSelect = () => Haptics.selectionAsync().catch(() => {});

export const hSuccess = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {}
  );

export const hWarning = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
    () => {}
  );

export const hTap = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
