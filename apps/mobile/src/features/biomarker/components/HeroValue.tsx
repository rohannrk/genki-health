import React from 'react';
import { View, Text } from 'react-native';
import { BiomarkerStatus, statusMeta, formatValue } from '../data';
import { SERIF, INK, MUTED } from '../theme';

type Props = {
  value: number;
  unit: string;
  status: BiomarkerStatus;
};

export default function HeroValue({ value, unit, status }: Props) {
  const meta = statusMeta(status);
  const display = formatValue(value);

  return (
    <View className="items-center pt-2 pb-1">
      <View className="flex-row items-end">
        <Text style={{ fontFamily: SERIF, fontSize: 56, lineHeight: 58, color: INK }}>
          {display}
        </Text>
        <Text
          style={{
            fontFamily: SERIF,
            fontSize: 24,
            lineHeight: 30,
            color: MUTED,
            marginLeft: 8,
          }}
        >
          {unit}
        </Text>
      </View>

      <View
        className="mt-3 flex-row items-center rounded-full px-3 py-1"
        style={{ backgroundColor: meta.tint }}
      >
        <View
          className="w-1.5 h-1.5 rounded-full mr-1.5"
          style={{ backgroundColor: meta.color }}
        />
        <Text className="text-[13px] font-semibold" style={{ color: meta.color }}>
          {meta.label}
        </Text>
      </View>
    </View>
  );
}
