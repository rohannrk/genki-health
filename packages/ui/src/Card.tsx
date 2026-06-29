import React from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
}

// Soft floating shadow — cards float on shadow, not borders (Genki tokens).
const CARD_SHADOW =
  Platform.OS === 'android'
    ? { elevation: 2 }
    : {
        shadowColor: '#0D1F14',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      };

export function Card({ children, onPress, className = '' }: CardProps) {
  const containerStyle = `bg-white rounded-rl p-4 ${className}`;

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        className={containerStyle}
        style={CARD_SHADOW}
        activeOpacity={0.85}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View className={containerStyle} style={CARD_SHADOW}>
      {children}
    </View>
  );
}
