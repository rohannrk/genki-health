import React from 'react';
import { View, Text, TextInput } from 'react-native';

interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
  className?: string;
}

export function Input({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  className = '',
}: InputProps) {
  return (
    <View className={`w-full mb-4 ${className}`}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        className={`w-full bg-white border rounded-xl px-4 py-3 text-slate-800 ${
          error ? 'border-rose-500' : 'border-slate-200 focus:border-slate-400'
        }`}
      />
      {error && <Text className="text-xs text-rose-500 mt-1 ml-1 font-semibold">{error}</Text>}
    </View>
  );
}
