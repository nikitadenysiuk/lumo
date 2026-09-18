// src/components/EmptyArt.js — простые линейные SVG-иллюстрации для пустых состояний.

import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { useTheme } from '../settings/SettingsContext';

export default function EmptyArt({ name = 'plate', size = 92 }) {
  const c = useTheme();
  const base = {
    fill: 'none',
    stroke: c.textFaint,
    strokeWidth: 3.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  const accent = { ...base, stroke: c.primary };

  const box = (kids) => (
    <Svg width={size} height={size} viewBox="0 0 96 96">
      {kids}
    </Svg>
  );

  switch (name) {
    case 'search':
      return box(
        <>
          <Circle cx="41" cy="41" r="23" {...base} />
          <Line x1="58" y1="58" x2="78" y2="78" {...accent} />
        </>
      );
    case 'star':
      return box(
        <Path
          d="M48 15 l9.9 21.2 23.1 3 -17 16.4 4.4 23.4 -20.4 -11.6 -20.4 11.6 4.4 -23.4 -17 -16.4 23.1 -3 z"
          {...accent}
        />
      );
    case 'chef':
      return box(
        <>
          <Path d="M30 45 c-9 0 -14 -8 -11 -16 3 -8 13 -10 19 -5 3 -8 15 -8 18 0 6 -5 16 -3 19 5 3 8 -2 16 -11 16 z" {...base} />
          <Rect x="30" y="45" width="36" height="26" rx="5" {...base} />
          <Line x1="38" y1="58" x2="58" y2="58" {...accent} />
        </>
      );
    case 'flame':
      return box(
        <Path
          d="M48 16 c10 12 18 20 18 33 a18 18 0 1 1 -36 0 c0 -8 4 -13 8 -18 1 6 4 9 7 10 -2 -9 1 -18 5 -25 z"
          {...accent}
        />
      );
    case 'plate':
    default:
      return box(
        <>
          <Circle cx="48" cy="48" r="25" {...base} />
          <Circle cx="48" cy="48" r="13" {...accent} />
          <Line x1="18" y1="30" x2="18" y2="46" {...base} />
          <Line x1="78" y1="30" x2="78" y2="46" {...base} />
        </>
      );
  }
}
