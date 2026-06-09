import React from 'react';
import { View, Text } from 'react-native';

type Props = {
  value: number;
  refLow: number;
  refHigh: number;
};

const DOTS = 35;
const PRIMARY = '#15803d';
const NEUTRAL = '#e2e8f0'; // slate-200

/** Linear interpolate a hex toward white-ish neutral for the in-range gradient. */
function withAlpha(hex: string, a: number) {
  const n = Math.round(a * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${n}`;
}

export default function RangeDots({ value, refLow, refHigh }: Props) {
  const span = refHigh - refLow;
  const pad = span * 0.35;
  const domainMin = refLow - pad;
  const domainMax = refHigh + pad;
  const domain = domainMax - domainMin;

  // Index of the dot nearest the current value (the marker).
  const markerIdx = Math.round(((value - domainMin) / domain) * (DOTS - 1));

  const dots = Array.from({ length: DOTS }, (_, i) => {
    const p = domainMin + (i / (DOTS - 1)) * domain;
    const inRange = p >= refLow && p <= refHigh;
    let color = NEUTRAL;
    if (inRange) {
      // Fade green in slightly toward the band edges for a gradient feel.
      const t = 1 - Math.abs((p - (refLow + refHigh) / 2) / (span / 2)); // 0..1, peak center
      color = withAlpha(PRIMARY, 0.45 + t * 0.55);
    }
    return { i, color, isMarker: i === markerIdx };
  });

  return (
    <View className="px-1">
      <View className="flex-row items-center justify-between" style={{ height: 16 }}>
        {dots.map((d) =>
          d.isMarker ? (
            <View
              key={d.i}
              className="rounded-full"
              style={{
                width: 12,
                height: 12,
                backgroundColor: PRIMARY,
                borderWidth: 2,
                borderColor: '#ffffff',
                shadowColor: PRIMARY,
                shadowOpacity: 0.35,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 1 },
              }}
            />
          ) : (
            <View
              key={d.i}
              style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: d.color }}
            />
          )
        )}
      </View>

      {/* Reference-range bound labels, aligned under the colored band. */}
      <View className="flex-row justify-between mt-2" style={{ paddingHorizontal: '12%' }}>
        <Text className="text-[12px] text-slate-400">{refLow}</Text>
        <Text className="text-[12px] text-slate-400">{refHigh}</Text>
      </View>
    </View>
  );
}
