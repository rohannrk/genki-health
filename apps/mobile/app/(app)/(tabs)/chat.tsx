import React from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';

export default function ChatTab() {
  return (
    <View className="flex-1 bg-slate-50">
      <View className="p-4 bg-white border-b border-slate-200">
        <Text className="text-xl font-bold text-slate-800">Copilot Assistant</Text>
        <Text className="text-xs text-slate-400">Secure clinical chat intelligence</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        <View className="bg-slate-100 p-3 rounded-lg max-w-[80%] self-start mb-4">
          <Text className="text-sm text-slate-800">
            Hello! I am your Medical Copilot. Ask me any questions about patient records, diagnoses, or treatment plans.
          </Text>
        </View>
      </ScrollView>

      <View className="p-4 bg-white border-t border-slate-200 flex-row items-center">
        <TextInput
          placeholder="Ask a clinical question..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 mr-2"
        />
        <TouchableOpacity className="bg-slate-900 px-4 py-2.5 rounded-xl">
          <Text className="text-white font-bold">Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
