import React from 'react';
import { View, Text } from 'react-native';

interface MedicalCardProps {
  title: string;
  date: string;
  diagnosis: string;
  treatment: string;
  provider: string;
  notes?: string;
}

export function MedicalCard({
  title,
  date,
  diagnosis,
  treatment,
  provider,
  notes,
}: MedicalCardProps) {
  return (
    <View className="p-4 mb-4 bg-white rounded-xl border border-slate-200 shadow-sm">
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 pr-2">
          <Text className="text-lg font-bold text-slate-900">{title}</Text>
          <Text className="text-sm text-slate-500">{provider}</Text>
        </View>
        <Text className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
          {date}
        </Text>
      </View>
      <View className="mb-2">
        <Text className="text-sm text-slate-700 mb-1">
          <Text className="font-semibold text-slate-800">Diagnosis: </Text>
          {diagnosis}
        </Text>
        <Text className="text-sm text-slate-700">
          <Text className="font-semibold text-slate-800">Treatment: </Text>
          {treatment}
        </Text>
      </View>
      {notes && (
        <View className="mt-2 pt-2 border-t border-slate-100">
          <Text className="text-xs italic text-slate-500">{notes}</Text>
        </View>
      )}
    </View>
  );
}
