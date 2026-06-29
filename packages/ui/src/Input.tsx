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
        placeholderTextColor="#8FA495"
        autoCapitalize="none"
        className={`w-full bg-genki-bg border rounded-rs px-4 py-3 text-genki-text ${
          error ? 'border-[#C0392B]' : 'border-transparent focus:border-genki-g8'
        }`}
      />
      {error && <Text className="text-xs text-[#C0392B] mt-1 ml-1 font-semibold">{error}</Text>}
    </View>
  );
}
