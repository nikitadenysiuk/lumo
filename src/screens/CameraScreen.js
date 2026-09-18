import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Text } from '../ui/Text';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { analyzeFoodPhoto } from '../services/aiService';
import { getAnalysisQuota, logSearch } from '../services/supabaseClient';
import { lookupBarcode } from '../services/openFoodFacts';
import { toUserMessage } from '../services/errors';
import { useT } from '../i18n/LocaleContext';
import { useTheme } from '../settings/SettingsContext';
import { hTap, hSelect } from '../lib/haptics';
import AnalyzingOverlay from '../components/AnalyzingOverlay';
import PromptModal from '../components/PromptModal';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'];

// Ужимаем фото до 1024px по ширине и жмём в JPEG перед отправкой.
async function shrinkToBase64(uri) {
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return out.base64;
}

export default function CameraScreen({ navigation }) {
  const { t } = useT();
  const c = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  // 'idle' | 'capturing' | 'analyzing' | 'lookup'
  const [status, setStatus] = useState('idle');
  const [mode, setMode] = useState('photo'); // 'photo' | 'barcode'
  const changeMode = useCallback((m) => {
    setMode(m);
    SecureStore.setItemAsync('cam_mode', m).catch(() => {});
  }, []);
  useEffect(() => {
    SecureStore.getItemAsync('cam_mode')
      .then((v) => {
        if (v === 'barcode' || v === 'photo') setMode(v);
      })
      .catch(() => {});
  }, []);
  const [torch, setTorch] = useState(false);
  const [quota, setQuota] = useState(null);
  const [manual, setManual] = useState(false);
  const cameraRef = useRef(null);
  const busyRef = useRef(false);
  const scanLockRef = useRef(false); // защита от повторного срабатывания штрих-кода
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  const busy = status !== 'idle';

  const onFocus = useCallback(() => {
    scanLockRef.current = false;
    getAnalysisQuota()
      .then(setQuota)
      .catch((e) => console.warn('quota', e?.message));
  }, []);

  useFocusEffect(onFocus);

  function isOverLimit() {
    return quota && !quota.is_pro && quota.remaining <= 0;
  }

  // --- Анализ фото через Gemini ---
  async function runAnalysis(getBase64, setCapturingNow) {
    if (busyRef.current) return;
    if (isOverLimit()) {
      navigation.navigate('Paywall');
      return;
    }
    busyRef.current = true;
    if (setCapturingNow) setStatus('capturing');
    try {
      const base64 = await getBase64();
      if (!base64) {
        setStatus('idle');
        return;
      }
      setStatus('analyzing');
      const result = await analyzeFoodPhoto(base64);
      // лимит списывает Edge Function; здесь просто обновляем счётчик
      getAnalysisQuota()
        .then(setQuota)
        .catch((e) => console.warn('quota refresh', e?.message));
      logSearch({
        kind: 'photo',
        title: result.food_name,
        calories: result.calories,
        payload: result,
      });
      navigation.navigate('Result', { result, photoBase64: base64 });
    } catch (err) {
      if (err?.code === 'QUOTA') {
        navigation.navigate('Paywall');
        return;
      }
      Alert.alert(t('cam.analyzeFail'), toUserMessage(err));
    } finally {
      busyRef.current = false;
      setStatus('idle');
    }
  }

  function takePhoto() {
    hTap();
    runAnalysis(async () => {
      if (!cameraRef.current) return null;
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        shutterSound: false,
      });
      return shrinkToBase64(photo.uri);
    }, true);
  }

  function pickFromLibrary() {
    runAnalysis(async () => {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        exif: false,
      });
      if (res.canceled) return null;
      // Показываем оверлей сразу, пока идёт сжатие большого фото из галереи.
      setStatus('capturing');
      return shrinkToBase64(res.assets[0].uri);
    }, false);
  }

  // --- Сканирование штрих-кода (Open Food Facts, лимит не тратится) ---
  async function lookupCode(data) {
    if (busyRef.current) return;
    scanLockRef.current = true;
    busyRef.current = true;
    setStatus('lookup');
    try {
      const product = await lookupBarcode(data);
      logSearch({
        kind: 'barcode',
        title: product.brand ? `${product.name} (${product.brand})` : product.name,
        calories: product.per100.calories,
        photo_url: product.imageUrl || null,
        payload: product,
      });
      navigation.navigate('BarcodeResult', { product });
    } catch (err) {
      const canAddManually =
        err?.code === 'NOT_FOUND' || err?.code === 'NO_DATA';
      const buttons = [
        {
          text: t('common.ok'),
          style: canAddManually ? 'cancel' : 'default',
          onPress: () => (scanLockRef.current = false),
        },
      ];
      if (canAddManually) {
        buttons.push({
          text: t('cam.addCustom'),
          onPress: () => {
            scanLockRef.current = false;
            navigation.navigate('CustomProduct');
          },
        });
      }
      Alert.alert(t('cam.barcodeTitle'), toUserMessage(err), buttons);
    } finally {
      busyRef.current = false;
      setStatus('idle');
    }
  }

  function handleBarcode({ data }) {
    if (scanLockRef.current || busyRef.current) return;
    lookupCode(data);
  }

  function submitManualCode(code) {
    const digits = String(code).replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 14) {
      Alert.alert(t('cam.manualTitle'), t('cam.manualBad'));
      return;
    }
    setManual(false);
    lookupCode(digits);
  }

  if (!permission) {
    return <View style={[styles.center, { backgroundColor: c.bg }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Ionicons
          name="camera-outline"
          size={44}
          color={c.textMuted}
          style={{ marginBottom: 12 }}
        />
        <Text style={[styles.permissionText, { color: c.text }]}>
          {t('cam.needPermission')}
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: c.primary }]}
          onPress={requestPermission}
        >
          <Text style={[styles.buttonText, { color: c.onPrimary }]}>
            {t('cam.allow')}
          </Text>
        </Pressable>
      </View>
    );
  }

  const scanning = mode === 'barcode' && !busy;

  const TorchButton = () => (
    <Pressable
      style={[styles.roundBtn, torch && styles.roundBtnOn]}
      onPress={() => {
        hSelect();
        setTorch((v) => !v);
      }}
    >
      <Ionicons
        name={torch ? 'flash' : 'flash-off'}
        size={20}
        color={torch ? '#111' : '#fff'}
      />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        onBarcodeScanned={scanning ? handleBarcode : undefined}
      />

      <AnalyzingOverlay
        visible={busy}
        label={
          status === 'capturing'
            ? t('cam.prepping')
            : status === 'lookup'
            ? t('cam.lookup')
            : t('cam.analyzing')
        }
      />

      {quota && !quota.is_pro && mode === 'photo' && !busy && (
        <Pressable
          style={[styles.quota, { top: insets.top + 12 }]}
          onPress={() => navigation.navigate('Paywall')}
        >
          <Ionicons name="sparkles" size={13} color="#fff" />
          <Text style={styles.quotaText}>
            {quota.remaining > 0
              ? t('home.freeLeft', { n: quota.remaining, limit: quota.limit })
              : t('home.freeOut')}
          </Text>
        </Pressable>
      )}

      {mode === 'barcode' && !busy && (
        <View style={styles.scanWrap} pointerEvents="none">
          <View style={styles.scanBox}>
            <View style={[styles.corner, styles.cornerTL, { borderColor: c.primary }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: c.primary }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: c.primary }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: c.primary }]} />
          </View>
          <Text style={styles.scanHint}>{t('cam.scanHint')}</Text>
        </View>
      )}

      <View style={[styles.bottom, { paddingBottom: tabBarHeight + 22 }]}>
        <View style={styles.modeSwitch}>
          <Pressable
            style={[styles.modeTab, mode === 'photo' && styles.modeTabOn]}
            onPress={() => {
              hSelect();
              changeMode('photo');
            }}
          >
            <Ionicons
              name="camera"
              size={15}
              color={mode === 'photo' ? '#111' : '#fff'}
            />
            <Text
              style={[styles.modeText, mode === 'photo' && styles.modeTextOn]}
            >
              {t('cam.modePhoto')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeTab, mode === 'barcode' && styles.modeTabOn]}
            onPress={() => {
              hSelect();
              scanLockRef.current = false;
              changeMode('barcode');
            }}
          >
            <Ionicons
              name="barcode"
              size={15}
              color={mode === 'barcode' ? '#111' : '#fff'}
            />
            <Text
              style={[styles.modeText, mode === 'barcode' && styles.modeTextOn]}
            >
              {t('cam.modeBarcode')}
            </Text>
          </Pressable>
        </View>

        {mode === 'photo' ? (
          <View style={styles.controls}>
            <Pressable
              style={[styles.roundBtn, busy && styles.dim]}
              onPress={pickFromLibrary}
              disabled={busy}
              accessibilityLabel={t('cam.gallery')}
            >
              <Ionicons name="images" size={22} color="#fff" />
            </Pressable>

            <Pressable
              onPress={takePhoto}
              disabled={busy}
              style={({ pressed }) => [
                styles.shutterOuter,
                pressed && styles.shutterPressed,
                busy && styles.dim,
              ]}
            >
              <View style={styles.shutterInner} />
            </Pressable>

            <TorchButton />
          </View>
        ) : (
          <View style={styles.controlsBarcode}>
            <Pressable
              style={styles.manualBtn}
              onPress={() => {
                hSelect();
                setManual(true);
              }}
            >
              <Ionicons name="keypad-outline" size={16} color="#fff" />
              <Text style={styles.manualText}>{t('cam.manualEntry')}</Text>
            </Pressable>
            <TorchButton />
          </View>
        )}
      </View>

      <PromptModal
        visible={manual}
        onClose={() => setManual(false)}
        onSubmit={submitManualCode}
        title={t('cam.manualTitle')}
        placeholder={t('cam.manualPlaceholder')}
        confirmLabel={t('cam.manualFind')}
        cancelLabel={t('common.cancel')}
        keyboardType="number-pad"
        maxLength={14}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionText: { textAlign: 'center', marginBottom: 16, fontSize: 16 },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  buttonText: { fontWeight: '700' },

  quota: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    maxWidth: '75%',
  },
  quotaText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  scanWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBox: { width: 250, height: 160 },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#FF6B35',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanHint: {
    color: '#fff',
    marginTop: 22,
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
  },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },

  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 22,
    padding: 4,
    marginBottom: 22,
  },
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 18,
  },
  modeTabOn: { backgroundColor: '#fff' },
  modeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modeTextOn: { color: '#111' },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 40,
  },
  controlsBarcode: { alignItems: 'center', width: '100%', gap: 16 },
  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  manualText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  roundBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  roundBtnOn: { backgroundColor: '#fff', borderColor: '#fff' },
  dim: { opacity: 0.4 },

  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterPressed: { transform: [{ scale: 0.92 }] },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
});
