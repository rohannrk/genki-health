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
import { FileText, ChevronRight, ArrowUp } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { ai as aiApi, ChatMessage, ChatSource, HistoryMessage } from '@genki/api-client';
import { useProfile } from '../../../src/context/ProfileContext';
import { colors, shadows } from '../../../src/theme/genki';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
};

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "Hello! I'm your Genki. Ask me anything about the patient's records — diagnoses, medications, test results, or follow-ups.",
};

function cacheFile(userId: string) {
  return `${FileSystem.documentDirectory}chat_history_${userId}.json`;
}

async function readCache(userId: string): Promise<Message[] | null> {
  try {
    const path = cacheFile(userId);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeCache(userId: string, messages: Message[]): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(cacheFile(userId), JSON.stringify(messages));
  } catch {
    // best-effort
  }
}

const SourceCard = memo(function SourceCard({ source, onPress }: { source: ChatSource; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-genki-gtt rounded-rs px-3 py-2 mt-1 flex-row items-center"
      activeOpacity={0.7}
    >
      <FileText size={14} color={colors.g5} style={{ marginRight: 8 }} />
      <View className="flex-1">
        <Text
          className={`text-xs font-semibold text-genki-g5 ${source.title?.trim() ? '' : 'capitalize'}`}
          numberOfLines={1}
        >
          {source.title?.trim() || source.type}
        </Text>
        {source.date && <Text className="text-xs text-genki-faint">{source.date}</Text>}
      </View>
      <ChevronRight size={14} color={colors.faint} />
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
      <View className={`flex-row max-w-[88%] ${isUser ? 'justify-end' : ''}`}>
        {!isUser && (
          <View
            className="w-7 h-7 rounded-lg bg-genki-g8 items-center justify-center mr-2 mt-0.5"
          >
            <Text className="text-white text-xs font-bold">G</Text>
          </View>
        )}
        <View
          className={`px-4 py-3 rounded-2xl ${
            isUser ? 'bg-genki-g8 rounded-tr-sm' : 'bg-white rounded-tl-sm flex-shrink'
          }`}
          style={isUser ? undefined : shadows.shS}
        >
          {isUser ? (
            <Text className="text-sm leading-relaxed text-white">{item.content}</Text>
          ) : (
            <Markdown style={MARKDOWN_STYLES}>{item.content}</Markdown>
          )}
        </View>
        {isUser && (
          <View className="w-7 h-7 rounded-lg bg-genki-g5 items-center justify-center ml-2 mt-0.5">
            <Text className="text-white text-xs font-bold">P</Text>
          </View>
        )}
      </View>
      {!isUser && item.sources && item.sources.length > 0 && (
        <View className="mt-1 max-w-[82%] w-full pl-9">
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

const MARKDOWN_STYLES = {
  body: { color: '#0D1F14', fontSize: 14, lineHeight: 22 },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  bullet_list_icon: { color: '#5C6D63', marginTop: 6 },
  strong: { fontWeight: '700' as const, color: '#0F2A1D' },
  em: { fontStyle: 'italic' as const },
  code_inline: { backgroundColor: '#F0F7F3', color: '#0F2A1D', borderRadius: 4, paddingHorizontal: 4, fontSize: 13 },
  fence: { backgroundColor: '#F0F7F3', borderRadius: 8, padding: 12, marginVertical: 6 },
  paragraph: { marginVertical: 2 },
  heading1: { fontSize: 16, fontWeight: '700' as const, color: '#0F2A1D', marginVertical: 4 },
  heading2: { fontSize: 15, fontWeight: '700' as const, color: '#0F2A1D', marginVertical: 4 },
  heading3: { fontSize: 14, fontWeight: '700' as const, color: '#0F2A1D', marginVertical: 2 },
};

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
    const userId = activeProfile.id;

    async function load() {
      setHistoryLoading(true);
      try {
        // 1. Show local cache immediately
        const cached = await readCache(userId);
        if (cached && cached.length > 0) setMessages([WELCOME, ...cached]);

        // 2. Fetch from server and replace
        const token = await getToken();
        if (!token) return;
        const rows = await aiApi.getHistory(token);
        const serverMsgs = serverToMessages(rows);
        if (serverMsgs.length > 0) {
          setMessages([WELCOME, ...serverMsgs]);
          await writeCache(userId, serverMsgs);
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
    async (userId: string, newMessages: Message[], token: string) => {
      // Write to local cache immediately
      const all = newMessages.filter(m => m.id !== 'welcome');
      await writeCache(userId, all);

      // Persist new exchange to server (fire-and-forget)
      const toSave = newMessages.slice(-2).filter(m => m.id !== 'welcome');
      if (toSave.length > 0) {
        aiApi
          .saveHistory(
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
      const result = await aiApi.chat(payload, token);

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
      className="flex-1 bg-genki-bg"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      {/* Header */}
      <View className="bg-white px-4 pt-14 pb-4 flex-row items-center" style={shadows.shS}>
        <View className="w-10 h-10 rounded-xl bg-genki-g8 items-center justify-center mr-3">
          <Text className="text-white text-base font-bold">G</Text>
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold text-genki-text">Ask Genki</Text>
          <Text className="text-xs text-genki-faint mt-0.5">
            {activeProfile ? `Answering for ${activeProfile.name}` : 'Select a patient profile'}
          </Text>
        </View>
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
          <View className="bg-white rounded-2xl px-4 py-3 flex-row items-center" style={shadows.shS}>
            <ActivityIndicator size="small" color={colors.g8} />
            <Text className="text-genki-faint text-sm ml-2">
              {historyLoading ? 'Loading history…' : 'Thinking…'}
            </Text>
          </View>
        </View>
      )}

      {/* Input bar */}
      <View className="bg-white px-4 py-3 flex-row items-end" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask a clinical question…"
          placeholderTextColor={colors.faint}
          multiline
          maxLength={1000}
          className="flex-1 bg-genki-bg rounded-rm px-4 py-2.5 text-genki-text text-sm mr-2"
          style={{ maxHeight: 100 }}
        />
        <TouchableOpacity
          onPress={sendMessage}
          disabled={!input.trim() || loading || !activeProfile}
          className={`w-10 h-10 rounded-full items-center justify-center ${
            input.trim() && !loading && activeProfile ? 'bg-genki-g8' : 'bg-genki-gt'
          }`}
        >
          <ArrowUp
            size={18}
            color={input.trim() && !loading && activeProfile ? '#ffffff' : colors.faint}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
