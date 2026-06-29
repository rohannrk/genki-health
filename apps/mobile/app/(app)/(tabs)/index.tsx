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
import { Plus, FileText } from 'lucide-react-native';
import { documents as docsApi, biomarkers as biomarkersApi } from '@genki/api-client';
import { MedicalDocument, BiomarkerSummary } from '@genki/types';
import { formatDate } from '@genki/utils';
import { useProfile } from '../../../src/context/ProfileContext';
import { docTypeIcon } from '../../../src/lib/docTypeUtils';
import { statusMeta, formatValue } from '../../../src/features/biomarker/data';
import { SERIF } from '../../../src/features/biomarker/theme';
import { colors, shadows, tagColor } from '../../../src/theme/genki';

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
  ready: '#2E7D52',
  processing: '#C47E1A',
  uploading: '#185FA5',
  error: '#C0392B',
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TimelineTab() {
  const router = useRouter();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { activeProfile } = useProfile();

  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [biomarkers, setBiomarkers] = useState<BiomarkerSummary[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Ref so loadDocuments never needs to change identity.
  const typeFilterRef = useRef(typeFilter);
  typeFilterRef.current = typeFilter;

  const loadDocuments = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      const filter = typeFilterRef.current;
      const res = await docsApi.list(
        token,
        filter !== 'all' ? { type: filter } : {}
      );
      setDocuments(res.documents);

      // Biomarkers span all the user's reports (independent of the type filter).
      const bios = await biomarkersApi.list(token).catch(() => []);
      setBiomarkers(bios);
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Re-fetch when the filter changes.
  useEffect(() => { loadDocuments(); }, [typeFilter]);

  // Refresh on tab focus (e.g. after upload or delete) — stable callback.
  useFocusEffect(useCallback(() => { loadDocuments(false); }, []));

  const onRefresh = () => {
    setRefreshing(true);
    loadDocuments(false);
  };

  if (!activeProfile) {
    return (
      <View className="flex-1 justify-center items-center bg-genki-bg p-8">
        <Text className="text-genki-muted text-center">Setting up your profile…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-genki-bg">
      {/* Type filter */}
      <View className="bg-genki-bg px-4 pt-3 pb-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {TYPE_FILTERS.map(f => {
            const active = typeFilter === f;
            const Icon = f !== 'all' ? docTypeIcon(f) : null;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setTypeFilter(f)}
                className={`mr-2 px-3.5 py-1.5 rounded-full flex-row items-center gap-1 ${
                  active ? 'bg-genki-g8' : 'bg-white'
                }`}
                style={active ? shadows.greenBtn : shadows.shS}
              >
                {Icon && <Icon size={12} color={active ? colors.white : colors.faint} />}
                <Text
                  className={`text-xs font-semibold ${active ? 'text-white' : 'text-genki-muted'}`}
                >
                  {TYPE_LABELS[f]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Document list */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.g8} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4 pt-2"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.g8} />}
        >
          {/* Hero banner */}
          {activeProfile && (
            <View
              className="bg-genki-g8 rounded-rxl p-5 mb-4"
              style={shadows.greenBtn}
            >
              <Text className="text-genki-g3 text-sm font-medium">{greeting()}</Text>
              <Text className="text-white text-2xl font-bold mt-0.5" style={{ letterSpacing: -0.4 }}>
                {activeProfile.name}
              </Text>
              <Text className="text-white/70 text-[13px] mt-1 leading-relaxed">
                {documents.length} document{documents.length === 1 ? '' : 's'} ·{' '}
                {biomarkers.length} vital{biomarkers.length === 1 ? '' : 's'} tracked.
              </Text>
              <View className="flex-row mt-4 rounded-rm overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                {[
                  { n: documents.length, l: 'Documents' },
                  { n: biomarkers.length, l: 'Vitals' },
                ].map((s, i, arr) => (
                  <View
                    key={s.l}
                    className="flex-1 py-3 items-center"
                    style={i < arr.length - 1 ? { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.12)' } : undefined}
                  >
                    <Text className="text-white text-xl font-bold">{s.n}</Text>
                    <Text className="text-white/60 text-[11px] mt-0.5">{s.l}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Biomarkers — latest value per marker; tap to see the trend */}
          {biomarkers.length > 0 && (
            <View className="mb-4">
              <Text className="text-[11px] font-bold text-genki-faint uppercase tracking-wider mb-2">
                Biomarkers
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="-mx-4"
                contentContainerStyle={{ paddingHorizontal: 16 }}
              >
                {biomarkers.map((b) => {
                  const meta = statusMeta(b.status);
                  return (
                    <TouchableOpacity
                      key={b.code}
                      onPress={() => router.push(`/(app)/biomarker/${b.code}` as any)}
                      className="bg-white rounded-rm p-3 mr-3"
                      style={[{ width: 132 }, shadows.shS]}
                      activeOpacity={0.85}
                    >
                      <Text className="text-xs text-genki-muted" numberOfLines={1}>
                        {b.name}
                      </Text>
                      <View className="flex-row items-baseline mt-1">
                        <Text style={{ fontFamily: SERIF, fontSize: 24, color: colors.text }}>
                          {formatValue(b.value)}
                        </Text>
                        {b.unit ? (
                          <Text className="text-[11px] text-genki-faint ml-1" numberOfLines={1}>
                            {b.unit}
                          </Text>
                        ) : null}
                      </View>
                      <View className="flex-row items-center mt-2">
                        <View
                          className="w-1.5 h-1.5 rounded-full mr-1"
                          style={{ backgroundColor: meta.color }}
                        />
                        <Text className="text-[11px]" style={{ color: meta.color }} numberOfLines={1}>
                          {meta.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <Text className="text-[11px] font-bold text-genki-faint uppercase tracking-wider mb-2">
            Recent
          </Text>

          {documents.length === 0 ? (
            <View className="bg-white rounded-rl p-8 items-center my-2" style={shadows.shS}>
              <FileText size={48} color={colors.g3} style={{ marginBottom: 12 }} />
              <Text className="text-genki-muted text-sm font-medium text-center">
                No documents yet. Tap + to upload your first record.
              </Text>
            </View>
          ) : (
            documents.map(doc => {
              const tag = tagColor(doc.type);
              const Icon = docTypeIcon(doc.type);
              return (
                <TouchableOpacity
                  key={doc.id}
                  onPress={() => router.push(`/(app)/document/${doc.id}` as any)}
                  className="bg-white rounded-rm p-4 mb-3 flex-row items-start"
                  style={shadows.shS}
                  activeOpacity={0.85}
                >
                  <View
                    className="w-10 h-10 items-center justify-center mr-3"
                    style={{ backgroundColor: tag.bg, borderRadius: 11 }}
                  >
                    <Icon size={18} color={tag.fg} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-start justify-between">
                      <Text className="text-[13.5px] font-semibold text-genki-text capitalize flex-1 pr-2">
                        {doc.type.replace('_', ' ')}
                      </Text>
                      <View className="items-end">
                        <View
                          className="w-2 h-2 rounded-full mb-1"
                          style={{ backgroundColor: STATUS_DOT[doc.status] ?? colors.faint }}
                        />
                        <Text className="text-[11.5px] text-genki-faint">
                          {doc.date ? formatDate(doc.date) : '—'}
                        </Text>
                      </View>
                    </View>
                    {doc.hospitalName && (
                      <Text className="text-[11.5px] text-genki-muted mt-0.5">{doc.hospitalName}</Text>
                    )}
                    {doc.doctorName && (
                      <Text className="text-[11.5px] text-genki-faint">{doc.doctorName}</Text>
                    )}
                    {doc.extractedText && (
                      <Text className="text-[11.5px] text-genki-muted leading-relaxed mt-1" numberOfLines={2}>
                        {doc.extractedText}
                      </Text>
                    )}
                    {doc.status !== 'ready' && (
                      <View className="flex-row items-center mt-2">
                        <ActivityIndicator size="small" color="#C47E1A" />
                        <Text className="text-[11.5px] text-[#C47E1A] ml-1.5 font-medium">
                          {doc.status === 'processing' ? 'Processing…' : 'Uploading…'}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View className="h-24" />
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/upload' as any)}
        className="absolute bottom-8 right-6 w-14 h-14 bg-genki-g8 rounded-full items-center justify-center"
        style={shadows.fab}
        activeOpacity={0.85}
      >
        <Plus size={26} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}
