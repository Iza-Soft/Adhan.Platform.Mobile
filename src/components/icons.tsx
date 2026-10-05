import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { AlertMode } from '@/store/alertPrefs';

interface IconProps {
  size?: number;
  color: string;
  strokeWidth?: number;
}

const stroke = (color: string, strokeWidth = 1.8) => ({
  fill: 'none',
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/** Камбанка за трите режима: зачеркната / камбанка / високоговорител. */
export function AlertIcon({ mode, size = 19, color }: IconProps & { mode: AlertMode }) {
  const s = stroke(color);
  if (mode === 'adhan') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M4 10v4h4l5 4V6L8 10z" {...s} />
        <Path d="M16.5 8.5a5 5 0 0 1 0 7" {...s} />
        <Path d="M19 6a8.5 8.5 0 0 1 0 12" {...s} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" {...s} />
      <Path d="M10 20.5a2 2 0 0 0 4 0" {...s} />
      {mode === 'off' && <Path d="M4 4l16 16" {...s} />}
    </Svg>
  );
}

export function PinIcon({ size = 15, color }: IconProps) {
  const s = stroke(color, 2);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" {...s} />
      <Circle cx="12" cy="9.5" r="2.5" {...s} />
    </Svg>
  );
}

export function ChevronDownIcon({ size = 12, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 9l6 6 6-6" {...stroke(color, 2.4)} />
    </Svg>
  );
}

export function ChevronIcon({ size = 20, color, direction }: IconProps & { direction: 'left' | 'right' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={direction === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} {...stroke(color, 2.2)} />
    </Svg>
  );
}

/* ---- иконите на долната навигация ---- */

export function TodayIcon({ size = 22, color }: IconProps) {
  const s = stroke(color, 1.7);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="8.5" {...s} />
      <Path d="M12 7.5V12l3 2" {...s} />
    </Svg>
  );
}

export function QiblaIcon({ size = 22, color }: IconProps) {
  const s = stroke(color, 1.7);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="8.5" {...s} />
      <Path d="M14.8 9.2l-1.6 4-4 1.6 1.6-4z" {...s} />
    </Svg>
  );
}

export function MonthIcon({ size = 22, color }: IconProps) {
  const s = stroke(color, 1.7);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="4" y="5.5" width="16" height="14" rx="2.5" {...s} />
      <Path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" {...s} />
    </Svg>
  );
}

export function SettingsIcon({ size = 22, color }: IconProps) {
  const s = stroke(color, 1.7);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...s} />
      <Circle cx="15" cy="7" r="2" {...s} />
      <Circle cx="9" cy="17" r="2" {...s} />
    </Svg>
  );
}

/** Джамия: купол, минаре, основа (етап 12 – раздел „Джамии“ и точките на картата). */
export function MosqueIcon({ size = 22, color, strokeWidth = 1.7 }: IconProps) {
  const s = stroke(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 20v-6a7 7 0 0 1 14 0v6M3 20h18M12 4v3M19 9v11" {...s} />
    </Svg>
  );
}

/* ---- джамии наблизо (етап 12) ---- */

export function LocateIcon({ size = 18, color }: IconProps) {
  const s = stroke(color, 2);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="4" {...s} />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" {...s} />
    </Svg>
  );
}

export function NavigateIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 11l18-8-8 18-2-8z" {...stroke(color, 2)} />
    </Svg>
  );
}

export function ShareIcon({ size = 18, color }: IconProps) {
  const s = stroke(color, 2);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3v12M7 8l5-5 5 5" {...s} />
      <Path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" {...s} />
    </Svg>
  );
}

export function CopyIcon({ size = 18, color }: IconProps) {
  const s = stroke(color, 2);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="8" y="8" width="12" height="12" rx="2.5" {...s} />
      <Path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" {...s} />
    </Svg>
  );
}

/** Стрелка нагоре – завърта се към джамията (градуси от север). */
export function ArrowUpIcon({ size = 16, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 19V5M6 11l6-6 6 6" {...stroke(color, 2.4)} />
    </Svg>
  );
}
