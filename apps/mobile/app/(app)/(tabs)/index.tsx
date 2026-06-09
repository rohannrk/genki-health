import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { documents as docsApi } from '@medcopilot/api-client';
import { MedicalDocument } from '@medcopilot/types';
import { formatDate } from '@medcopilot/utils';
import { useProfile } from '../../../src/context/ProfileContext';
import { DOC_TYPE_ICON_NAMES } from '../../../src/lib/docTypeUtils';

const TYPE_FILTERS = ['all', 'prescription', 'lab', 'imaging', 'invoice', 'other'] as const;
type TypeFilter = typeof TYPE_FILTERS[number];

const TYPE_LABELS: Record<string, string> = {
  all: 'All',
  prescription: 'Rx',
  lab: 'Lab',
  imaging: 'Imaging',
  invoice: 'Invoice',
  other: 'Other',
};

const STATUS_DOT: Record<string, string> = {
  ready: 'bg-emerald-500',
  processing: 'bg-amber-400',
  uploading: 'bg-blue-400',
  error: 'bg-red-500',
};

export default function TimelineTab() {
  const router = useRouter();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { profiles, activeProfile } = useProfile();

  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Refs so loadDocuments never needs to change identity.
  const activeProfileRef = useRef(activeProfile);
  activeProfileRef.current = activeProfile;
  const typeFilterRef = useRef(typeFilter);
  typeFilterRef.current = typeFilter;

  const loadDocuments = useCallback(async (showLoader = true) => {
    const profile = activeProfileRef.current;
    if (!profile) return;
    if (showLoader) setLoading(true);
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      const filter = typeFilterRef.current;
      const res = await docsApi.list(
        profile.id,
        token,
        filter !== 'all' ? { type: filter } : {}
      );
      setDocuments(res.documents);
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Re-fetch when profile or filter changes.
  useEffect(() => { loadDocuments(); }, [activeProfile?.id, typeFilter]);

  // Refresh on tab focus (e.g. after upload or delete) — stable callback.
  useFocusEffect(useCallback(() => { loadDocuments(false); }, []));

  const onRefresh = () => {
    setRefreshing(true);
    loadDocuments(false);
  };

  if (!activeProfile && profiles.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50 p-8">
        <Text className="text-slate-500 text-center">No patient profiles yet.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      {/* Active patient label (switch profiles from Settings) */}
      {activeProfile && (
        <View className="bg-white border-b border-slate-200 px-4 pt-3 pb-2">
          <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Patient</Text>
          <Text className="text-base font-bold text-slate-800 mt-0.5">{activeProfile.name}</Text>
        </View>
      )}

      {/* Type filter */}
      <View className="bg-white border-b border-slate-100 px-4 py-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {TYPE_FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setTypeFilter(f)}
              className={`mr-2 px-3 py-1.5 rounded-full flex-row items-center gap-1 ${
                typeFilter === f ? 'bg-emerald-600' : 'bg-slate-100'
              }`}
            >
              {f !== 'all' && (
                <Ionicons
                  name={DOC_TYPE_ICON_NAMES[f]}
                  size={11}
                  color={typeFilter === f ? '#ffffff' : '#475569'}
                />
              )}
              <Text className={`text-xs font-semibold ${typeFilter === f ? 'text-white' : 'text-slate-600'}`}>
                {TYPE_LABELS[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Document list */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4 pt-3"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
        >
          {documents.length === 0 ? (
            <View className="bg-white rounded-2xl border border-slate-200 p-8 items-center my-4">
              <Ionicons name="documents-outline" size={48} color="#cbd5e1" style={{ marginBottom: 12 }} />
              <Text className="text-slate-500 text-sm font-medium text-center">
                No documents yet. Tap + to upload your first record.
              </Text>
            </View>
          ) : (
            documents.map(doc => (
              <TouchableOpacity
                key={doc.id}
                onPress={() => router.push(`/(app)/document/${doc.id}` as any)}
                className="bg-white rounded-2xl border border-slate-200 p-4 mb-3"
                activeOpacity={0.75}
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 pr-3">
                    <Text className="text-sm font-bold text-slate-800 capitalize">
                      {doc.type.replace('_', ' ')}
                    </Text>
                    {doc.hospitalName && (
                      <Text className="text-xs text-slate-500 mt-0.5">{doc.hospitalName}</Text>
                    )}
                    {doc.doctorName && (
                      <Text className="text-xs text-slate-400">{doc.doctorName}</Text>
                    )}
                  </View>
                  <View className="items-end">
                    <View className={`w-2 h-2 rounded-full mb-1 ${STATUS_DOT[doc.status] ?? 'bg-slate-300'}`} />
                    <Text className="text-xs text-slate-400">
                      {doc.date ? formatDate(doc.date) : '—'}
                    </Text>
                  </View>
                </View>
                {doc.extractedText && (
                  <Text className="text-xs text-slate-500 leading-relaxed" numberOfLines={2}>
                    {doc.extractedText}
                  </Text>
                )}
                {doc.status !== 'ready' && (
                  <View className="flex-row items-center mt-2">
                    <ActivityIndicator size="small" color="#d97706" />
                    <Text className="text-xs text-amber-600 ml-1.5 font-medium">
                      {doc.status === 'processing' ? 'Processing…' : 'Uploading…'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
          <View className="h-24" />
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/upload' as any)}
        className="absolute bottom-8 right-6 w-14 h-14 bg-emerald-600 rounded-full items-center justify-center"
        style={{ elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 }}
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </TouchableOpacity>
    </View>
  );
}
