import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { ai as aiApi, ChatMessage, ChatSource, HistoryMessage } from '@medcopilot/api-client';
import { useProfile } from '../../../src/context/ProfileContext';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
};

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "Hello! I'm your Medical Copilot. Ask me anything about the patient's records — diagnoses, medications, test results, or follow-ups.",
};

function cacheFile(profileId: string) {
  return `${FileSystem.documentDirectory}chat_history_${profileId}.json`;
}

async function readCache(profileId: string): Promise<Message[] | null> {
  try {
    const path = cacheFile(profileId);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeCache(profileId: string, messages: Message[]): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(cacheFile(profileId), JSON.stringify(messages));
  } catch {
    // best-effort
  }
}

const SourceCard = memo(function SourceCard({ source, onPress }: { source: ChatSource; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-slate-100 rounded-xl px-3 py-2 mt-1 flex-row items-center"
      activeOpacity={0.7}
    >
      <Ionicons name="attach-outline" size={14} color="#94a3b8" style={{ marginRight: 8 }} />
      <View className="flex-1">
        <Text
          className={`text-xs font-semibold text-slate-700 ${source.title?.trim() ? '' : 'capitalize'}`}
          numberOfLines={1}
        >
          {source.title?.trim() || source.type}
        </Text>
        {source.date && <Text className="text-xs text-slate-400">{source.date}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
    </TouchableOpacity>
  );
});

const MessageItem = memo(function MessageItem({
  item,
  onSourcePress,
}: {
  item: Message;
  onSourcePress: (documentId: string) => void;
}) {
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
              onPress={() => onSourcePress(s.documentId)}
            />
          ))}
        </View>
      )}
    </View>
  );
});

const LIST_CONTENT_STYLE = { padding: 16, paddingBottom: 8 };
const keyExtractor = (item: Message) => item.id;

function serverToMessages(rows: HistoryMessage[]): Message[] {
  return rows.map(r => ({
    id: r.id,
    role: r.role,
    content: r.content,
    sources: r.sources,
  }));
}

export default function ChatTab() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { activeProfile } = useProfile();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const scrollToEnd = useCallback(
    () => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100),
    []
  );

  const scrollToBottomOnResize = useCallback(
    () => flatListRef.current?.scrollToEnd({ animated: false }),
    []
  );

  // Load history: AsyncStorage first (instant), then server (authoritative)
  useEffect(() => {
    if (!activeProfile) return;
    const profileId = activeProfile.id;

    async function load() {
      setHistoryLoading(true);
      try {
        // 1. Show local cache immediately
        const cached = await readCache(profileId);
        if (cached && cached.length > 0) setMessages([WELCOME, ...cached]);

        // 2. Fetch from server and replace
        const token = await getToken();
        if (!token) return;
        const rows = await aiApi.getHistory(profileId, token);
        const serverMsgs = serverToMessages(rows);
        if (serverMsgs.length > 0) {
          setMessages([WELCOME, ...serverMsgs]);
          await writeCache(profileId, serverMsgs);
        }
      } catch {
        // silently fall back to whatever we have
      } finally {
        setHistoryLoading(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
      }
    }

    void load();
  }, [activeProfile?.id]);

  const persistMessages = useCallback(
    async (profileId: string, newMessages: Message[], token: string) => {
      // Write to local cache immediately
      const all = newMessages.filter(m => m.id !== 'welcome');
      await writeCache(profileId, all);

      // Persist new exchange to server (fire-and-forget)
      const toSave = newMessages.slice(-2).filter(m => m.id !== 'welcome');
      if (toSave.length > 0) {
        aiApi
          .saveHistory(
            profileId,
            toSave.map(m => ({ role: m.role, content: m.content, sources: m.sources })),
            token
          )
          .catch(() => {});
      }
    },
    []
  );

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

      setMessages(prev => {
        const next = [...prev, assistantMsg];
        void persistMessages(activeProfile.id, next, token);
        return next;
      });
    } catch {
      setMessages(prev => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
      scrollToEnd();
    }
  }, [input, loading, messages, activeProfile, getToken, scrollToEnd, persistMessages]);

  const { summariseDocId, summariseNonce } = useLocalSearchParams<{
    summariseDocId?: string;
    summariseNonce?: string;
  }>();
  const handledSummaryRef = useRef<string | null>(null);

  const summariseDoc = useCallback(
    async (documentId: string) => {
      const token = await getToken();
      if (!token) return;

      const userMsg: Message = { id: `u-sum-${Date.now()}`, role: 'user', content: 'Summarise this document for me.' };
      setMessages(prev => [...prev, userMsg]);
      setLoading(true);
      try {
        const result = await aiApi.summarise(documentId, token);
        const src = result.sourceDocument;
        const assistantMsg: Message = {
          id: `a-sum-${Date.now()}`,
          role: 'assistant',
          content: result.summary,
          sources: [{ documentId: src.id, type: src.type, title: src.title ?? null, date: src.date, excerpt: '' }],
        };
        setMessages(prev => {
          const next = [...prev, assistantMsg];
          if (activeProfile) void persistMessages(activeProfile.id, next, token);
          return next;
        });
      } catch {
        setMessages(prev => [
          ...prev,
          { id: `err-${Date.now()}`, role: 'assistant', content: 'Could not summarise that document. Please try again.' },
        ]);
      } finally {
        setLoading(false);
        scrollToEnd();
      }
    },
    [getToken, scrollToEnd, activeProfile, persistMessages]
  );

  useEffect(() => {
    if (summariseDocId && summariseNonce && summariseNonce !== handledSummaryRef.current) {
      handledSummaryRef.current = summariseNonce;
      void summariseDoc(summariseDocId);
    }
  }, [summariseDocId, summariseNonce, summariseDoc]);

  const onSourcePress = useCallback(
    (documentId: string) => router.push(`/(app)/document/${documentId}` as any),
    [router]
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => <MessageItem item={item} onSourcePress={onSourcePress} />,
    [onSourcePress]
  );

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
        keyExtractor={keyExtractor}
        contentContainerStyle={LIST_CONTENT_STYLE}
        onContentSizeChange={scrollToBottomOnResize}
      />

      {/* Loading indicators */}
      {(loading || historyLoading) && (
        <View className="px-4 pb-2 flex-row items-center">
          <View className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex-row items-center">
            <ActivityIndicator size="small" color="#059669" />
            <Text className="text-slate-400 text-sm ml-2">
              {historyLoading ? 'Loading history…' : 'Thinking…'}
            </Text>
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
          <Ionicons
            name="arrow-up"
            size={18}
            color={input.trim() && !loading && activeProfile ? '#ffffff' : '#94a3b8'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
