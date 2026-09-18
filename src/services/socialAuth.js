// src/services/socialAuth.js
//
// Вход через Google / Apple / Facebook поверх Supabase Auth.
//
// ЧТО НУЖНО НАСТРОИТЬ (один раз, в дашбордах — код уже готов):
//  1. Supabase → Authentication → Providers: включить Google, Apple, Facebook,
//     вписать Client ID / Secret каждого.
//  2. Supabase → Authentication → URL Configuration → Redirect URLs:
//     добавить  lumo://auth  и  https://<project>.supabase.co/auth/v1/callback
//  3. Google Cloud Console: OAuth-клиент (тип Web) + добавить redirect
//     https://<project>.supabase.co/auth/v1/callback
//  4. Facebook Developers: приложение + Facebook Login + тот же redirect.
//  5. Apple: только на реальном iOS-устройстве или в dev-сборке (в Expo Go
//     кнопка Apple скрывается автоматически). Нужен Apple Developer ($99/год),
//     Service ID и ключ, вписанные в Supabase.

import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { supabase } from './supabaseClient';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri({ scheme: 'lumo', path: 'auth' });

async function setSessionFromUrl(url) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return true;
  }
  if (params.access_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    return true;
  }
  return false;
}

/**
 * Вход через OAuth-провайдера (google | facebook).
 * @returns {Promise<'ok'|'cancelled'>}
 */
export async function signInWithOAuth(provider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type === 'cancel' || res.type === 'dismiss') return 'cancelled';
  if (res.type !== 'success' || !res.url) throw new Error('oauth_failed');

  const ok = await setSessionFromUrl(res.url);
  return ok ? 'ok' : 'cancelled';
}

/** Доступен ли вход через Apple (реальный iOS / dev-build, не Expo Go). */
export async function isAppleAvailable() {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch (e) {
    return false;
  }
}

/** Вход через Apple (Sign in with Apple → Supabase signInWithIdToken). */
export async function signInWithApple() {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  const cred = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!cred.identityToken) throw new Error('apple_no_token');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: cred.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
  return 'ok';
}
