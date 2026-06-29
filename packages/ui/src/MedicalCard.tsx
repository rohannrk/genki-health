import React from 'react';
import { View, Text, Platform } from 'react-native';

interface MedicalCardProps {
  title: string;
  date: string;
  diagnosis: string;
  treatment: string;
  provider: string;
  notes?: string;
}

const CARD_SHADOW =
  Platform.OS === 'android'
    ? { elevation: 2 }
    : {
        shadowColor: '#0D1F14',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      };

export function MedicalCard({
  title,
  date,
  diagnosis,
  treatment,
  provider,
  notes,
}: MedicalCardProps) {
  return (
    <View className="p-4 mb-4 bg-white rounded-rl" style={CARD_SHADOW}>
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 pr-2">
          <Text className="text-lg font-bold text-genki-text">{title}</Text>
          <Text className="text-sm text-genki-muted">{provider}</Text>
        </View>
        <Text className="text-xs font-semibold text-genki-g8 bg-genki-gt px-2 py-1 rounded-full">
          {date}
        </Text>
      </View>
      <View className="mb-2">
        <Text className="text-sm text-genki-text mb-1">
          <Text className="font-semibold text-genki-text">Diagnosis: </Text>
          {diagnosis}
        </Text>
        <Text className="text-sm text-genki-text">
          <Text className="font-semibold text-genki-text">Treatment: </Text>
          {treatment}
        </Text>
      </View>
      {notes && (
        <View className="mt-2 pt-2 border-t border-genki-border">
          <Text className="text-xs italic text-genki-muted">{notes}</Text>
        </View>
      )}
    </View>
  );
}
