import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { ai as aiApi, SearchResult } from '@medcopilot/api-client';
import { useProfile } from '../../../src/context/ProfileContext';
import { formatDate } from '@medcopilot/utils';

const TYPE_ICONS: Record<string, string> = {
  prescription: '💊', lab: '🔬', imaging: '🩻', invoice: '🧾', other: '📄',
};

export default function SearchTab() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { activeProfile } = useProfile();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const runSearch = useCallback(async (q: string) => {
    if (!activeProfile || q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await aiApi.search(activeProfile.id, q.trim(), token);
      setResults(data);
      setSearched(true);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [activeProfile, getToken]);

  const onChangeQuery = (text: string) => {
    setQuery(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), 300);
  };

  return (
    <View className="flex-1 bg-slate-50">
      <View className="bg-white border-b border-slate-200 px-4 pt-14 pb-4">
        <Text className="text-xl font-bold text-slate-900 mb-3">Search Records</Text>
        <View className="flex-row items-center bg-slate-100 rounded-2xl px-4 py-2.5">
          <Text className="text-slate-400 mr-2">🔍</Text>
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Search diagnoses, medications, hospitals…"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 text-slate-800 text-sm"
          />
          {loading && <ActivityIndicator size="small" color="#059669" />}
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {!searched && !loading && (
          <View className="items-center py-12">
            <Text className="text-4xl mb-3">🔬</Text>
            <Text className="text-slate-500 text-sm text-center font-medium">
              Search across all patient records using natural language.
            </Text>
            <Text className="text-slate-400 text-xs text-center mt-1">
              Try: "blood sugar levels", "amoxicillin", "Dr. Sharma"
            </Text>
          </View>
        )}

        {searched && results.length === 0 && !loading && (
          <View className="items-center py-12">
            <Text className="text-4xl mb-3">🔎</Text>
            <Text className="text-slate-500 text-sm text-center">No matching records found.</Text>
          </View>
        )}

        {results.map(r => (
          <TouchableOpacity
            key={r.documentId}
            onPress={() => router.push(`/(app)/document/${r.documentId}` as any)}
            className="bg-white rounded-2xl border border-slate-200 p-4 mb-3"
            activeOpacity={0.75}
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Text className="text-base mr-2">{TYPE_ICONS[r.type] ?? '📄'}</Text>
                <Text className="text-sm font-bold text-slate-800 capitalize">{r.type}</Text>
              </View>
              <View className="flex-row items-center">
                {r.date && (
                  <Text className="text-xs text-slate-400 mr-2">{formatDate(r.date)}</Text>
                )}
                <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
                  <Text className="text-xs font-bold text-emerald-700">
                    {Math.round((r.score ?? 0) * 100)}%
                  </Text>
                </View>
              </View>
            </View>
            {r.hospitalName && (
              <Text className="text-xs text-slate-500 mb-1">{r.hospitalName}</Text>
            )}
            {r.excerpt && (
              <Text className="text-xs text-slate-600 leading-relaxed" numberOfLines={3}>
                {r.excerpt}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
