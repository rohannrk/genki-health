import React from 'react';
import { View, Text } from 'react-native';
import { ChevronUp, ChevronDown } from 'lucide-react-native';
import { SERIF } from '../theme';
import { BiomarkerStatus } from '../data';

type Point = { value: number; measuredAt: string; status?: BiomarkerStatus };

type Props = {
  data: Point[];
  unit: string;
  delta: number | null;
  refLow?: number | null;
  refHigh?: number | null;
};

const PLOT_HEIGHT = 168;
const PRIMARY = '#2E7D52';
const AMBER = '#C47E1A';
const NEUTRAL = '#8FA495';
const TICKS = 5;

/** Dot color by the point's own status: green in-range, amber out, grey unknown. */
function statusColor(s?: BiomarkerStatus): string {
  if (s === 'low' || s === 'high') return AMBER;
  if (s === 'in') return PRIMARY;
  return NEUTRAL;
}

function fmtMonth(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function TrendChart({ data, unit, delta, refLow, refHigh }: Props) {
  const n = data.length;
  const values = data.map((d) => d.value);

  // Dynamic Y domain from the data + reference bounds, with padding.
  let dmin = Math.min(...values);
  let dmax = Math.max(...values);
  if (refLow != null) dmin = Math.min(dmin, refLow);
  if (refHigh != null) dmax = Math.max(dmax, refHigh);
  if (dmin === dmax) {
    dmin -= 1;
    dmax += 1;
  }
  const pad = (dmax - dmin) * 0.15;
  const yMin = dmin - pad;
  const yMax = dmax + pad;
  const span = yMax - yMin || 1;
  const smallRange = dmax - dmin < 10;

  const ticks = Array.from({ length: TICKS }, (_, i) => yMax - (i / (TICKS - 1)) * span);
  const fmtTick = (t: number) => (smallRange ? t.toFixed(1) : String(Math.round(t)));

  // Map a value to a vertical position (% from top) within the plot.
  const yFor = (v: number) => (1 - (v - yMin) / span) * 100;

  const points = data.map((d, i) => ({
    x: n <= 1 ? 50 : (i / (n - 1)) * 100,
    y: yFor(d.value),
    isLast: i === n - 1,
    color: statusColor(d.status),
  }));

  // Shaded normal-range band (uses the latest report's reference range).
  const showBand = refLow != null && refHigh != null;
  const bandTop = showBand ? yFor(refHigh as number) : 0;
  const bandHeight = showBand ? yFor(refLow as number) - bandTop : 0;

  const positive = (delta ?? 0) >= 0;

  return (
    <View>
      {/* Delta (omitted when there's only one reading) */}
      {delta != null && (
        <View className="flex-row items-center mb-3">
          {positive ? (
            <ChevronUp size={16} color={PRIMARY} />
          ) : (
            <ChevronDown size={16} color={AMBER} />
          )}
          <Text
            style={{
              fontFamily: SERIF,
              fontSize: 20,
              marginLeft: 4,
              color: positive ? PRIMARY : AMBER,
            }}
          >
            {Math.abs(delta)} {unit}
          </Text>
        </View>
      )}

      {/* Plot */}
      <View className="flex-row">
        <View style={{ height: PLOT_HEIGHT, justifyContent: 'space-between', width: 30 }}>
          {ticks.map((t, i) => (
            <Text key={i} className="text-[10px] text-genki-faint text-right">
              {fmtTick(t)}
            </Text>
          ))}
        </View>

        <View style={{ flex: 1, height: PLOT_HEIGHT, position: 'relative', marginLeft: 6 }}>
          {/* Normal-range band */}
          {showBand && (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${bandTop}%`,
                height: `${bandHeight}%`,
                backgroundColor: 'rgba(21,128,61,0.07)',
              }}
            />
          )}

          {/* Horizontal gridlines */}
          {ticks.map((_, idx) => (
            <View
              key={idx}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${(idx / (TICKS - 1)) * 100}%`,
                borderTopWidth: 1,
                borderColor: '#eef2f6',
              }}
            />
          ))}

          {/* Data points */}
          {points.map((p, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.isLast ? 11 : 7,
                height: p.isLast ? 11 : 7,
                borderRadius: 6,
                marginLeft: p.isLast ? -5.5 : -3.5,
                marginTop: p.isLast ? -5.5 : -3.5,
                backgroundColor: p.isLast ? p.color : `${p.color}66`,
                borderWidth: p.isLast ? 2 : 0,
                borderColor: '#ffffff',
              }}
            />
          ))}
        </View>
      </View>

      {/* X axis labels */}
      {n > 1 && (
        <View className="flex-row justify-between mt-2" style={{ marginLeft: 36 }}>
          <Text className="text-[10px] text-genki-faint">{fmtMonth(data[0]?.measuredAt)}</Text>
          <Text className="text-[10px] text-genki-faint">{fmtMonth(data[n - 1]?.measuredAt)}</Text>
        </View>
      )}
    </View>
  );
}
