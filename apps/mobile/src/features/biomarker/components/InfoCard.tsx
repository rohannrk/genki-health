import React from 'react';
import { View, Text } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { colors, shadows } from '../../../theme/genki';

type Props = {
  label: string;
  icon?: LucideIcon;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export default function InfoCard({ label, icon: Icon, right, children, className }: Props) {
  return (
    <View
      className={`bg-white rounded-rl p-4 ${className ?? ''}`}
      style={shadows.shS}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          {Icon ? (
            <Icon size={13} color={colors.faint} style={{ marginRight: 5 }} />
          ) : null}
          <Text className="text-[11px] font-semibold tracking-[1.5px] text-genki-faint">
            {label.toUpperCase()}
          </Text>
        </View>
        {right ? <View>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}
