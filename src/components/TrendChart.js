// src/components/TrendChart.js
// Простой график (линия или столбцы) на react-native-svg.
// data: [{ t: number (мс), v: number }] — предполагается отсортированным по t.
// Скраббер: ведёшь пальцем по графику → вертикальная линия + значение и дата за день.

import {
  useMemo,
  useState,
} from 'react';
import { StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Polygon,
  Polyline,
  Rect,
  Stop,
} from 'react-native-svg';

import { useTheme } from '../settings/SettingsContext';
import { hSelect } from '../lib/haptics';

const PAD = 10;

export default function TrendChart({
  data = [],
  type = 'line',
  height = 150,
  color,
  goal = null,
  tMin,
  tMax,
  fmt = (v) => String(Math.round(v)),
  emptyText = '',
  locale,
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [w, setW] = useState(0);
  const [scrub, setScrub] = useState(null); // индекс точки под пальцем
  const stroke = color || c.primary;

  const pts = data.filter((d) => Number.isFinite(d.v));
  const lo0 = Math.min(...pts.map((d) => d.v), goal ?? Infinity);
  const hi0 = Math.max(...pts.map((d) => d.v), goal ?? -Infinity);
  const pad = (hi0 - lo0) * 0.15 || Math.max(1, hi0 * 0.1);
  const vMin = type === 'bar' ? 0 : Math.max(0, lo0 - pad);
  const vMax = hi0 + pad || 1;

  const t0 = tMin ?? Math.min(...pts.map((d) => d.t));
  const t1 = tMax ?? Math.max(...pts.map((d) => d.t));
  const tSpan = t1 - t0 || 1;

  const X = (t) => PAD + ((t - t0) / tSpan) * (w - PAD * 2);
  const Y = (v) =>
    height - PAD - ((v - vMin) / (vMax - vMin || 1)) * (height - PAD * 2);

  const hasData = pts.length > 0 && w > 0;
  const gid = `tcArea-${String(stroke).replace(/[^a-z0-9]/gi, '')}`;
  const linePoints = hasData
    ? pts.map((d) => `${X(d.t)},${Y(d.v)}`).join(' ')
    : '';
  const areaPoints = hasData
    ? `${X(pts[0].t)},${height - PAD} ${linePoints} ${X(
        pts[pts.length - 1].t
      )},${height - PAD}`
    : '';

  // подобрать ближайшую точку к касанию по горизонтали
  function pick(e) {
    if (!hasData) return;
    const x = e.nativeEvent.locationX;
    const tt = t0 + ((x - PAD) / (w - PAD * 2 || 1)) * tSpan;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i += 1) {
      const d = Math.abs(pts[i].t - tt);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setScrub((prev) => {
      if (prev !== best) hSelect();
      return best;
    });
  }

  const sPt = scrub != null && pts[scrub] ? pts[scrub] : null;
  const sX = sPt ? Math.max(PAD, Math.min(w - PAD, X(sPt.t))) : 0;
  const tipW = 92;
  const tipLeft = sPt ? Math.max(0, Math.min(w - tipW, sX - tipW / 2)) : 0;
  const sDate = sPt
    ? new Date(sPt.t).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
      })
    : '';

  return (
    <View
      style={[styles.wrap, { height }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {!hasData ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        <>
          <Svg width={w} height={height}>
            {type !== 'bar' && (
              <Defs>
                <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={stroke} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={stroke} stopOpacity={0.02} />
                </LinearGradient>
              </Defs>
            )}
            {type !== 'bar' && (
              <Polygon points={areaPoints} fill={`url(#${gid})`} />
            )}
            {goal != null && (
              <Line
                x1={PAD}
                x2={w - PAD}
                y1={Y(goal)}
                y2={Y(goal)}
                stroke={c.textFaint}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            )}

            {type === 'bar'
              ? pts.map((d, i) => {
                  const bw = Math.max(2, (w - PAD * 2) / pts.length - 2);
                  const bx = X(d.t) - bw / 2;
                  const by = Y(d.v);
                  return (
                    <Rect
                      key={i}
                      x={Math.max(PAD, bx)}
                      y={by}
                      width={bw}
                      height={Math.max(0, height - PAD - by)}
                      rx={2}
                      fill={stroke}
                      opacity={d.v > 0 ? (scrub === i ? 1 : 0.85) : 0}
                    />
                  );
                })
              : (
                <>
                  <Polyline
                    points={pts.map((d) => `${X(d.t)},${Y(d.v)}`).join(' ')}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {pts.map((d, i) => (
                    <Circle key={i} cx={X(d.t)} cy={Y(d.v)} r={2.5} fill={stroke} />
                  ))}
                </>
              )}

            {sPt && (
              <>
                <Line
                  x1={sX}
                  x2={sX}
                  y1={PAD}
                  y2={height - PAD}
                  stroke={c.textMuted}
                  strokeWidth={1}
                />
                <Circle cx={sX} cy={Y(sPt.v)} r={5.5} fill={c.card} />
                <Circle cx={sX} cy={Y(sPt.v)} r={4} fill={stroke} />
              </>
            )}
          </Svg>

          <Text style={[styles.axis, styles.axisTop]}>{fmt(vMax)}</Text>
          <Text style={[styles.axis, styles.axisBottom]}>{fmt(vMin)}</Text>

          {sPt && (
            <View style={[styles.tip, { left: tipLeft, width: tipW }]}>
              <Text style={styles.tipValue}>{fmt(sPt.v)}</Text>
              <Text style={styles.tipDate}>{sDate}</Text>
            </View>
          )}

          <View
            style={StyleSheet.absoluteFill}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => true}
            onResponderGrant={pick}
            onResponderMove={pick}
            onResponderRelease={() => setScrub(null)}
            onResponderTerminate={() => setScrub(null)}
          />
        </>
      )}
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    wrap: { width: '100%', justifyContent: 'center' },
    empty: { color: c.textFaint, fontSize: 12, textAlign: 'center' },
    axis: {
      position: 'absolute',
      right: 0,
      fontSize: 9,
      color: c.textFaint,
      backgroundColor: c.card,
      paddingHorizontal: 2,
    },
    axisTop: { top: 0 },
    axisBottom: { bottom: 0 },
    tip: {
      position: 'absolute',
      top: -2,
      alignItems: 'center',
      backgroundColor: c.text,
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 6,
    },
    tipValue: { color: c.bg, fontSize: 12, fontWeight: '800' },
    tipDate: { color: c.bg, fontSize: 10, fontWeight: '600', opacity: 0.8 },
  });
