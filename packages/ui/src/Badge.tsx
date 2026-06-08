import React from 'react';
import { View, Text } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'high' | 'med' | 'low' | 'default';
  className?: string;
}

export function Badge({ label, variant = 'default', className = '' }: BadgeProps) {
  let badgeStyle = 'px-2.5 py-1 rounded-full self-start flex-row justify-center items-center';
  let textStyle = 'text-xs font-semibold';

  if (variant === 'high') {
    badgeStyle += ' bg-rose-50 border border-rose-100';
    textStyle += ' text-rose-700';
  } else if (variant === 'med') {
    badgeStyle += ' bg-amber-50 border border-amber-100';
    textStyle += ' text-amber-700';
  } else if (variant === 'low') {
    badgeStyle += ' bg-emerald-50 border border-emerald-100';
    textStyle += ' text-emerald-700';
  } else {
    badgeStyle += ' bg-slate-50 border border-slate-200';
    textStyle += ' text-slate-600';
  }

  return (
    <View className={`${badgeStyle} ${className}`}>
      <Text className={textStyle}>{label}</Text>
    </View>
  );
}
