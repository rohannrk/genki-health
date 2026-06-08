import React from 'react';
import { View, TouchableOpacity } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
}

export function Card({ children, onPress, className = '' }: CardProps) {
  const containerStyle = `bg-white rounded-2xl border border-slate-200 p-4 shadow-sm ${className}`;

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} className={containerStyle} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View className={containerStyle}>{children}</View>;
}
