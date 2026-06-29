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
    badgeStyle += ' bg-[#FDECEA]';
    textStyle += ' text-[#C0392B]';
  } else if (variant === 'med') {
    badgeStyle += ' bg-tag-rx';
    textStyle += ' text-tag-rxText';
  } else if (variant === 'low') {
    badgeStyle += ' bg-genki-gt';
    textStyle += ' text-genki-g8';
  } else {
    badgeStyle += ' bg-genki-gtt';
    textStyle += ' text-genki-muted';
  }

  return (
    <View className={`${badgeStyle} ${className}`}>
      <Text className={textStyle}>{label}</Text>
    </View>
  );
}
