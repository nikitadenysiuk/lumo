// src/services/errors.js
//
// Единая точка перевода технических ошибок в понятный текст.
// Экраны показывают toUserMessage(err) — им не нужно знать детали.

import { t } from '../i18n';

export class AppError extends Error {
  /**
   * @param {string} message - текст для пользователя (уже локализованный)
   * @param {string} code - 'NO_NETWORK' | 'RATE_LIMIT' | 'BAD_JSON' |
   *   'BLOCKED' | 'BAD_KEY' | 'SERVER' | 'NOT_FOUND' | 'NO_DATA' | 'UNKNOWN'
   */
  constructor(message, code = 'UNKNOWN') {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export function isNetworkError(err) {
  if (err?.code === 'NO_NETWORK') return true;
  const m = String(err?.message ?? '').toLowerCase();
  return (
    m.includes('network request failed') ||
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('could not connect') ||
    m.includes('unable to resolve host') ||
    m.includes('timeout')
  );
}

export function toUserMessage(err) {
  if (!err) return t('err.unknown');
  if (err instanceof AppError) return err.message;
  if (isNetworkError(err)) return t('err.network');
  return err.message || t('err.generic');
}
