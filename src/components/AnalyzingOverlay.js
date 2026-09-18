import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';

import { useTheme } from '../settings/SettingsContext';

/**
 * Полноэкранное окно прогресса анализа: число 0→100% + полоса,
 * и отдельная линия загрузки у нижнего края экрана.
 * Прогресс имитируется (реальный запрос к Gemini непрозрачен): плавно
 * подъезжает к ~92%, при visible=false — быстро добегает до 100 и гаснет.
 */
export default function AnalyzingOverlay({ visible, label }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [pct, setPct] = useState(0);
  const [render, setRender] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearInterval(timer.current);
    if (visible) {
      setRender(true);
      setPct(0);
      let p = 0;
      timer.current = setInterval(() => {
        p += Math.max(0.4, (92 - p) * 0.05);
        if (p > 92) p = 92;
        setPct(Math.round(p));
      }, 160);
    } else if (render) {
      // добежать до 100 и спрятать
      setPct(100);
      const to = setTimeout(() => setRender(false), 280);
      return () => clearTimeout(to);
    }
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!render) return null;

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.pct}>{pct}%</Text>
        {!!label && <Text style={styles.label}>{label}</Text>}
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </View>

      <View style={styles.bottomTrack}>
        <View style={[styles.bottomFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.72)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
    },
    card: {
      alignItems: 'center',
      paddingHorizontal: 32,
      minWidth: 220,
    },
    pct: { fontSize: 56, fontWeight: '800', color: '#fff' },
    label: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
    track: {
      width: 200,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.2)',
      overflow: 'hidden',
      marginTop: 18,
    },
    fill: { height: 6, borderRadius: 3, backgroundColor: c.primary },
    bottomTrack: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    bottomFill: { height: 4, backgroundColor: c.primary },
  });
