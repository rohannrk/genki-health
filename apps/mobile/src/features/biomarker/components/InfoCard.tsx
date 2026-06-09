import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export default function InfoCard({ label, icon, right, children, className }: Props) {
  return (
    <View
      className={`bg-white rounded-2xl border border-slate-100 p-4 ${className ?? ''}`}
      style={{
        shadowColor: '#0f172a',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          {icon ? (
            <Ionicons name={icon} size={13} color="#94a3b8" style={{ marginRight: 5 }} />
          ) : null}
          <Text className="text-[11px] font-semibold tracking-[1.5px] text-slate-400">
            {label.toUpperCase()}
          </Text>
        </View>
        {right ? <View>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}
