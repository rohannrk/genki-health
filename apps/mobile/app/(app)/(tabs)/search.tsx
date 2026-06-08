import React from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';

export default function SearchTab() {
  return (
    <View className="flex-1 bg-slate-50 p-4">
      <Text className="text-2xl font-bold text-slate-800 mb-4">Search Records</Text>
      <TextInput
        placeholder="Search diagnoses, treatments, providers..."
        autoCapitalize="none"
        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 mb-4"
      />
      <ScrollView className="flex-1">
        <View className="bg-white rounded-xl border border-slate-200 p-8 justify-center items-center my-4">
          <Text className="text-slate-400 text-sm font-medium text-center">
            Enter a search query above to look up records.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
