import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Platform } from 'react-native';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

// Green glow under the primary/secondary buttons (per Genki tokens).
const GREEN_GLOW =
  Platform.OS === 'android'
    ? { elevation: 4 }
    : {
        shadowColor: '#1A3D2B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 14,
      };

export function Button({
  onPress,
  title,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
}: ButtonProps) {
  let buttonStyle = 'rounded-rm py-3.5 px-6 justify-center items-center flex-row';
  let textStyle = 'text-base font-bold';
  let glow = false;

  if (variant === 'primary') {
    buttonStyle += ' bg-genki-g8 active:bg-genki-g9';
    textStyle += ' text-white';
    glow = true;
  } else if (variant === 'secondary') {
    buttonStyle += ' bg-genki-g5 active:bg-genki-g7';
    textStyle += ' text-white';
    glow = true;
  } else {
    buttonStyle += ' bg-transparent active:bg-genki-gtt';
    textStyle += ' text-genki-g8';
  }

  if (disabled || loading) {
    buttonStyle += ' opacity-50';
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`${buttonStyle} ${className}`}
      style={glow && !(disabled || loading) ? GREEN_GLOW : undefined}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'ghost' ? '#1A3D2B' : '#ffffff'} />
      ) : (
        <Text className={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
