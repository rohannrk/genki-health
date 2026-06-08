import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ListRenderItem,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { ai as aiApi, ChatMessage, ChatSource } from '@medcopilot/api-client';
import { useProfile } from '../../../src/context/ProfileContext';

type Message = ChatMessage & {
  id: string;
  sources?: ChatSource[];
};

function SourceCard({ source, onPress }: { source: ChatSource; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-slate-100 rounded-xl px-3 py-2 mt-1 flex-row items-center"
      activeOpacity={0.7}
    >
      <Text className="text-slate-400 text-xs mr-2">📎</Text>
      <View className="flex-1">
        <Text className="text-xs font-semibold text-slate-700 capitalize">{source.type}</Text>
        {source.date && <Text className="text-xs text-slate-400">{source.date}</Text>}
      </View>
      <Text className="text-slate-400 text-xs">→</Text>
    </TouchableOpacity>
  );
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hello! I\'m your Medical Copilot. Ask me anything about the patient\'s records — diagnoses, medications, test results, or follow-ups.',
};

export default function ChatTab() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { activeProfile } = useProfile();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !activeProfile) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    const history = [...messages.filter(m => m.id !== 'welcome'), userMsg];

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = await getToken();
      if (!token) return;

      const payload: ChatMessage[] = history.map(m => ({ role: m.role, content: m.content }));
      const result = await aiApi.chat(activeProfile.id, payload, token);

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        sources: result.sources,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, loading, messages, activeProfile, getToken]);

  const renderMessage: ListRenderItem<Message> = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View className={`mb-3 ${isUser ? 'items-end' : 'items-start'}`}>
        <View
          className={`max-w-[82%] px-4 py-3 rounded-2xl ${
            isUser ? 'bg-slate-900 rounded-tr-sm' : 'bg-white border border-slate-200 rounded-tl-sm'
          }`}
        >
          <Text className={`text-sm leading-relaxed ${isUser ? 'text-white' : 'text-slate-800'}`}>
            {item.content}
          </Text>
        </View>
        {!isUser && item.sources && item.sources.length > 0 && (
          <View className="mt-1 max-w-[82%] w-full">
            {item.sources.map(s => (
              <SourceCard
                key={s.documentId}
                source={s}
                onPress={() => router.push(`/(app)/document/${s.documentId}` as any)}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      {/* Header */}
      <View className="bg-white border-b border-slate-200 px-4 pt-14 pb-4">
        <Text className="text-xl font-bold text-slate-900">Copilot Assistant</Text>
        <Text className="text-xs text-slate-400 mt-0.5">
          {activeProfile ? `Answering for ${activeProfile.name}` : 'Select a patient profile'}
        </Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Loading indicator */}
      {loading && (
        <View className="px-4 pb-2 flex-row items-center">
          <View className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex-row items-center">
            <ActivityIndicator size="small" color="#059669" />
            <Text className="text-slate-400 text-sm ml-2">Thinking…</Text>
          </View>
        </View>
      )}

      {/* Input bar */}
      <View className="bg-white border-t border-slate-200 px-4 py-3 flex-row items-end">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask a clinical question…"
          placeholderTextColor="#94a3b8"
          multiline
          maxLength={1000}
          className="flex-1 bg-slate-100 rounded-2xl px-4 py-2.5 text-slate-800 text-sm mr-2"
          style={{ maxHeight: 100 }}
        />
        <TouchableOpacity
          onPress={sendMessage}
          disabled={!input.trim() || loading || !activeProfile}
          className={`w-10 h-10 rounded-full items-center justify-center ${
            input.trim() && !loading && activeProfile ? 'bg-slate-900' : 'bg-slate-200'
          }`}
        >
          <Text className={`text-sm font-bold ${input.trim() && !loading ? 'text-white' : 'text-slate-400'}`}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
