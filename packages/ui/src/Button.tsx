import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Button({
  onPress,
  title,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
}: ButtonProps) {
  let buttonStyle = 'rounded-xl py-3.5 px-6 justify-center items-center flex-row';
  let textStyle = 'text-base font-bold';

  if (variant === 'primary') {
    buttonStyle += ' bg-slate-900 active:bg-slate-800';
    textStyle += ' text-white';
  } else if (variant === 'secondary') {
    buttonStyle += ' bg-emerald-600 active:bg-emerald-500';
    textStyle += ' text-white';
  } else {
    buttonStyle += ' bg-transparent active:bg-slate-100';
    textStyle += ' text-slate-800';
  }

  if (disabled || loading) {
    buttonStyle += ' opacity-50';
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`${buttonStyle} ${className}`}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'ghost' ? '#0f172a' : '#ffffff'} />
      ) : (
        <Text className={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
