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
import { Search, FlaskConical } from 'lucide-react-native';
import { ai as aiApi, SearchResult } from '@genki/api-client';
import { formatDate } from '@genki/utils';
import { docTypeIcon } from '../../../src/lib/docTypeUtils';
import { colors, shadows, tagColor } from '../../../src/theme/genki';

export default function SearchTab() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await aiApi.search(q.trim(), token);
      setResults(data);
      setSearched(true);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const onChangeQuery = (text: string) => {
    setQuery(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), 300);
  };

  return (
    <View className="flex-1 bg-genki-bg">
      <View className="bg-white px-4 pt-14 pb-4" style={shadows.shS}>
        <Text className="text-xl font-bold text-genki-text mb-3">Search Records</Text>
        <View className="flex-row items-center bg-genki-bg rounded-rm px-4 py-2.5">
          <Search size={16} color={colors.faint} style={{ marginRight: 8 }} />
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Search diagnoses, medications, hospitals…"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 text-genki-text text-sm"
          />
          {loading && <ActivityIndicator size="small" color={colors.g8} />}
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {!searched && !loading && (
          <View className="items-center py-12">
            <FlaskConical size={48} color={colors.g3} style={{ marginBottom: 12 }} />
            <Text className="text-genki-muted text-sm text-center font-medium">
              Search across all patient records using natural language.
            </Text>
            <Text className="text-genki-faint text-xs text-center mt-1">
              Try: "blood sugar levels", "amoxicillin", "Dr. Sharma"
            </Text>
          </View>
        )}

        {searched && results.length === 0 && !loading && (
          <View className="items-center py-12">
            <Search size={48} color={colors.g3} style={{ marginBottom: 12 }} />
            <Text className="text-genki-muted text-sm text-center">No matching records found.</Text>
          </View>
        )}

        {results.map(r => {
          const tag = tagColor(r.type);
          const Icon = docTypeIcon(r.type);
          return (
            <TouchableOpacity
              key={r.documentId}
              onPress={() => router.push(`/(app)/document/${r.documentId}` as any)}
              className="bg-white rounded-rm p-4 mb-3"
              style={shadows.shS}
              activeOpacity={0.85}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <View
                    className="w-7 h-7 items-center justify-center mr-2"
                    style={{ backgroundColor: tag.bg, borderRadius: 9 }}
                  >
                    <Icon size={14} color={tag.fg} />
                  </View>
                  <Text className="text-sm font-semibold text-genki-text capitalize">{r.type}</Text>
                </View>
                <View className="flex-row items-center">
                  {r.date && (
                    <Text className="text-xs text-genki-faint mr-2">{formatDate(r.date)}</Text>
                  )}
                  <View className="bg-genki-gt px-2 py-0.5 rounded-full">
                    <Text className="text-xs font-bold text-genki-g8">
                      {Math.round((r.score ?? 0) * 100)}%
                    </Text>
                  </View>
                </View>
              </View>
              {r.hospitalName && (
                <Text className="text-xs text-genki-muted mb-1">{r.hospitalName}</Text>
              )}
              {r.excerpt && (
                <Text className="text-xs text-genki-muted leading-relaxed" numberOfLines={3}>
                  {r.excerpt}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
