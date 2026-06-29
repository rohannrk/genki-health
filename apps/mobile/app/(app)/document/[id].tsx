import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import {
  ArrowLeft,
  Pencil,
  CheckCircle2,
  Clock,
  Circle,
  RefreshCw,
  Sparkles,
  ChevronUp,
  ChevronDown,
} from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { documents as docsApi, biomarkers as biomarkersApi } from '@genki/api-client';
import { MedicalDocument, BiomarkerReading, UpdateBiomarkerReadingInput } from '@genki/types';
import { formatDate } from '@genki/utils';
import BiomarkersReviewCard from '../../../src/features/biomarker/components/BiomarkersReviewCard';
import { colors, shadows } from '../../../src/theme/genki';

const STATUS_COLORS: Record<string, string> = {
  ready: 'bg-genki-gt text-genki-g8',
  processing: 'bg-[#FEF3CD] text-[#C47E1A]',
  uploading: 'bg-[#FEF3CD] text-[#C47E1A]',
  error: 'bg-[#FDECEA] text-[#C0392B]',
};

const TYPE_LABELS: Record<string, string> = {
  prescription: 'Prescription',
  lab: 'Lab Report',
  imaging: 'Imaging',
  invoice: 'Invoice',
  other: 'Document',
};

// Ordered ingestion stages with friendly labels (mirrors backend INGESTION_STAGES).
const STAGES: { key: string; label: string }[] = [
  { key: 'fetching', label: 'Loading file' },
  { key: 'analyzing', label: 'Reading & extracting' },
  { key: 'embedding', label: 'Indexing for search' },
];
const STAGE_ORDER = ['queued', ...STAGES.map((s) => s.key), 'done'];
const EST_TOTAL_SECONDS = 20;

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [doc, setDoc] = useState<(MedicalDocument & { downloadUrl?: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Biomarker review state
  const [readings, setReadings] = useState<BiomarkerReading[]>([]);
  const [showRawText, setShowRawText] = useState(false);

  // ── Fetch biomarkers for a ready document ──────────────────────────────────
  const fetchReadings = useCallback(
    async (documentId: string) => {
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const data = await biomarkersApi.listByDocument(documentId, token);
        setReadings(data);
      } catch {
        // Non-fatal — document is still usable without biomarkers
      }
    },
    []
  );

  // ── Poll document until ready ──────────────────────────────────────────────
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const fetchDoc = async () => {
      try {
        const token = await getTokenRef.current();
        if (!token || !id) return;
        const data = await docsApi.get(id, token);
        setDoc(data);

        if (data.status === 'processing' || data.status === 'uploading') {
          timer = setTimeout(fetchDoc, 3000);
        } else if (data.status === 'ready') {
          fetchReadings(id);
        }
      } catch (err) {
        console.error('Failed to load document:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
    return () => clearTimeout(timer);
  }, [id, fetchReadings]);

  // ── Elapsed timer while processing ────────────────────────────────────────
  const isProcessing = doc?.status === 'processing' || doc?.status === 'uploading';
  useEffect(() => {
    if (!isProcessing) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const interval = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000
    );
    return () => clearInterval(interval);
  }, [isProcessing]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRetry = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      await docsApi.retry(id, token);
      setDoc((prev) => (prev ? { ...prev, status: 'processing' as const } : prev));
      setReadings([]); // clear stale readings — will refresh when done

      const poll = async () => {
        const t = await getTokenRef.current();
        if (!t) return;
        const data = await docsApi.get(id, t);
        setDoc(data);
        if (data.status === 'processing' || data.status === 'uploading') {
          setTimeout(poll, 3000);
        } else if (data.status === 'ready') {
          fetchReadings(id);
        }
      };
      setTimeout(poll, 3000);
    } catch (err: any) {
      Alert.alert('Retry failed', err?.message ?? 'Please try again.');
    } finally {
      setRetrying(false);
    }
  };

  const handleSummarise = () => {
    if (!id || doc?.status !== 'ready') return;
    router.push({
      pathname: '/(app)/(tabs)/chat',
      params: { summariseDocId: id, summariseNonce: String(Date.now()) },
    });
  };

  const startRename = () => {
    setTitleDraft(doc?.title ?? '');
    setRenaming(true);
  };

  const handleSaveTitle = async () => {
    if (!id || savingTitle) return;
    setSavingTitle(true);
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      const next = titleDraft.trim();
      const updated = await docsApi.rename(id, next || null, token);
      setDoc((prev) => (prev ? { ...prev, title: updated.title } : prev));
      setRenaming(false);
    } catch (err: any) {
      Alert.alert('Rename failed', err?.message ?? 'Please try again.');
    } finally {
      setSavingTitle(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete document?',
      'This permanently removes the file and all extracted data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            try {
              const token = await getTokenRef.current();
              if (!token) return;
              await docsApi.delete(id, token);
              router.back();
            } catch (err: any) {
              Alert.alert('Delete failed', err?.message ?? 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleViewOriginal = () => {
    const url = doc?.downloadUrl;
    if (url) Linking.openURL(url);
  };

  // Save corrected readings: PATCH each changed row, then refresh local state.
  const handleSaveReadings = useCallback(
    async (
      updates: Array<{ id: string; value: number; refLow: number | null; refHigh: number | null }>
    ) => {
      const token = await getTokenRef.current();
      if (!token) throw new Error('Not authenticated');

      const saved = await Promise.all(
        updates.map((u) =>
          biomarkersApi.update(u.id, u as UpdateBiomarkerReadingInput, token)
        )
      );

      // Merge updated rows back into local state.
      setReadings((prev) => {
        const map = new Map(saved.map((r) => [r.id, r]));
        return prev.map((r) => map.get(r.id) ?? r);
      });
    },
    []
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-genki-bg">
        <ActivityIndicator size="large" color={colors.g8} />
      </View>
    );
  }

  if (!doc) {
    return (
      <View className="flex-1 justify-center items-center bg-genki-bg p-8">
        <Text className="text-genki-muted text-center">Document not found.</Text>
      </View>
    );
  }

  const statusClass = STATUS_COLORS[doc.status] ?? 'bg-genki-gtt text-genki-muted';
  const metadata = doc.metadata as Record<string, string>;

  return (
    <View className="flex-1 bg-genki-bg">
      {/* ── Header ── */}
      <View className="bg-white px-4 pt-14 pb-4" style={shadows.shS}>
        <TouchableOpacity onPress={() => router.back()} className="mb-3 flex-row items-center">
          <ArrowLeft size={18} color={colors.g8} />
          <Text style={{ color: colors.g8 }} className="font-semibold ml-1">
            Back
          </Text>
        </TouchableOpacity>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            {renaming ? (
              <View>
                <TextInput
                  value={titleDraft}
                  onChangeText={setTitleDraft}
                  autoFocus
                  maxLength={255}
                  placeholder={TYPE_LABELS[doc.type] ?? 'Document name'}
                  placeholderTextColor={colors.faint}
                  returnKeyType="done"
                  onSubmitEditing={handleSaveTitle}
                  className="text-xl font-bold text-genki-text border-b border-genki-g8 pb-1"
                />
                <View className="flex-row items-center mt-2">
                  <TouchableOpacity
                    onPress={handleSaveTitle}
                    disabled={savingTitle}
                    className="mr-4"
                  >
                    {savingTitle ? (
                      <ActivityIndicator size="small" color={colors.g8} />
                    ) : (
                      <Text style={{ color: colors.g8 }} className="font-semibold text-sm">
                        Save
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setRenaming(false)} disabled={savingTitle}>
                    <Text className="text-genki-faint font-semibold text-sm">Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center">
                <Text
                  className="text-xl font-bold text-genki-text flex-shrink"
                  numberOfLines={2}
                >
                  {doc.title?.trim() || TYPE_LABELS[doc.type] || 'Document'}
                </Text>
                <TouchableOpacity
                  onPress={startRename}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  className="ml-2"
                >
                  <Pencil size={16} color={colors.faint} />
                </TouchableOpacity>
              </View>
            )}
            {doc.title?.trim() && !renaming && (
              <Text className="text-xs text-genki-faint mt-0.5">
                {TYPE_LABELS[doc.type] ?? doc.type}
              </Text>
            )}
            {doc.hospitalName && (
              <Text className="text-sm text-genki-muted mt-0.5">{doc.hospitalName}</Text>
            )}
            {doc.doctorName && (
              <Text className="text-xs text-genki-faint mt-0.5">{doc.doctorName}</Text>
            )}
          </View>
          <View className={`px-3 py-1 rounded-full ${statusClass.split(' ')[0]}`}>
            <Text className={`text-xs font-semibold capitalize ${statusClass.split(' ')[1]}`}>
              {doc.status}
            </Text>
          </View>
        </View>
        {doc.date && (
          <Text className="text-sm text-genki-muted mt-2">{formatDate(doc.date)}</Text>
        )}
      </View>

      {/* ── Body ── */}
      <ScrollView className="flex-1 p-4">

        {/* ── Biomarkers review card (lab results) ── */}
        {readings.length > 0 && (
          <BiomarkersReviewCard readings={readings} onSave={handleSaveReadings} />
        )}

        {/* ── Extracted metadata (diagnosis / treatment) ── */}
        {(metadata.diagnosis || metadata.treatment) && (
          <View className="bg-white rounded-rl p-4 mb-4" style={shadows.shS}>
            <Text className="text-[11px] font-bold text-genki-faint uppercase tracking-wider mb-3">
              Extracted Info
            </Text>
            {metadata.diagnosis && (
              <View className="mb-2">
                <Text className="text-xs text-genki-faint font-medium">Diagnosis</Text>
                <Text className="text-sm text-genki-text mt-0.5">{metadata.diagnosis}</Text>
              </View>
            )}
            {metadata.treatment && (
              <View>
                <Text className="text-xs text-genki-faint font-medium">Treatment</Text>
                <Text className="text-sm text-genki-text mt-0.5">{metadata.treatment}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Processing progress ── */}
        {(doc.status === 'processing' || doc.status === 'uploading') &&
          (() => {
            const stage = (metadata.processingStage as string) || 'queued';
            const currentIdx = Math.max(0, STAGE_ORDER.indexOf(stage));
            const remaining = Math.max(0, EST_TOTAL_SECONDS - elapsed);
            return (
              <View className="rounded-rl p-4 mb-4" style={{ backgroundColor: '#FEF9EC' }}>
                <View className="flex-row items-center mb-3">
                  <ActivityIndicator size="small" color="#C47E1A" />
                  <Text className="text-[#7A5010] text-sm font-bold ml-3 flex-1">
                    Processing document…
                  </Text>
                  <Text className="text-[#C47E1A] text-xs font-medium">{elapsed}s</Text>
                </View>
                {STAGES.map((s, i) => {
                  const stageIdx = STAGE_ORDER.indexOf(s.key);
                  const done = stageIdx < currentIdx;
                  const active = stageIdx === currentIdx;
                  return (
                    <View key={s.key} className="flex-row items-center py-1">
                      {done ? (
                        <CheckCircle2 size={18} color={colors.g5} style={{ marginRight: 8 }} />
                      ) : active ? (
                        <Clock size={18} color="#C47E1A" style={{ marginRight: 8 }} />
                      ) : (
                        <Circle size={18} color="#E0CFA0" style={{ marginRight: 8 }} />
                      )}
                      <Text
                        className={`text-sm ${
                          active
                            ? 'text-[#7A5010] font-semibold'
                            : done
                              ? 'text-[#C47E1A]'
                              : 'text-[#C9B98E]'
                        }`}
                      >
                        {s.label}
                      </Text>
                    </View>
                  );
                })}
                <Text className="text-[#C47E1A] text-xs mt-3">
                  {remaining > 0
                    ? `Usually ready in about ${remaining}s. This runs with your AI key.`
                    : 'Taking longer than usual — almost there…'}
                </Text>
              </View>
            );
          })()}

        {/* ── Error state ── */}
        {doc.status === 'error' && (
          <View className="rounded-rl p-4 mb-4" style={{ backgroundColor: '#FDECEA' }}>
            <Text className="text-[#C0392B] text-sm font-bold mb-1">Processing failed</Text>
            <Text className="text-[#C0392B] text-sm mb-3">
              {(metadata.processingError as string) ||
                'Something went wrong while analysing this document.'}
            </Text>
            <TouchableOpacity
              onPress={handleRetry}
              disabled={retrying}
              className="bg-[#C0392B] py-3 rounded-rm items-center"
            >
              {retrying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View className="flex-row items-center gap-1.5">
                  <RefreshCw size={16} color="#ffffff" />
                  <Text className="text-white font-bold text-sm">Retry processing</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Processing note (e.g. no AI key) ── */}
        {doc.status === 'ready' && metadata.processingNote ? (
          <View className="rounded-rl p-4 mb-4" style={{ backgroundColor: '#EDF5FB' }}>
            <Text className="text-[#185FA5] text-sm">{metadata.processingNote as string}</Text>
          </View>
        ) : null}

        {/* ── Raw extracted text (collapsed by default when biomarkers exist) ── */}
        {doc.extractedText ? (
          <View className="bg-white rounded-rl mb-4 overflow-hidden" style={shadows.shS}>
            <TouchableOpacity
              onPress={() => setShowRawText((v) => !v)}
              className="flex-row items-center justify-between px-4 py-3"
              activeOpacity={0.7}
            >
              <Text className="text-[11px] font-bold text-genki-faint uppercase tracking-wider">
                Raw Extracted Text
              </Text>
              {showRawText ? (
                <ChevronUp size={16} color={colors.faint} />
              ) : (
                <ChevronDown size={16} color={colors.faint} />
              )}
            </TouchableOpacity>
            {showRawText && (
              <View className="px-4 pb-4 border-t border-genki-border">
                <Text className="text-sm text-genki-text font-mono leading-relaxed mt-3">
                  {doc.extractedText}
                </Text>
              </View>
            )}
          </View>
        ) : doc.status === 'ready' && readings.length === 0 ? (
          <View className="bg-white rounded-rl p-4 mb-4 items-center py-8" style={shadows.shS}>
            <Text className="text-genki-faint text-sm">
              No text could be extracted from this document.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Bottom action bar ── */}
      <View className="p-4 bg-white gap-3" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
        <TouchableOpacity
          onPress={handleSummarise}
          disabled={doc.status !== 'ready'}
          className={`py-3.5 rounded-rm items-center ${
            doc.status === 'ready' ? 'bg-genki-g8' : 'bg-genki-gt'
          }`}
        >
          <View className="flex-row items-center gap-2">
            <Sparkles
              size={18}
              color={doc.status === 'ready' ? '#ffffff' : colors.faint}
            />
            <Text
              className={`font-bold text-base ${
                doc.status === 'ready' ? 'text-white' : 'text-genki-faint'
              }`}
            >
              Summarise in Chat
            </Text>
          </View>
        </TouchableOpacity>

        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={handleViewOriginal}
            className="flex-1 py-3.5 rounded-rm items-center border border-genki-border bg-white"
          >
            <Text className="text-genki-text font-semibold text-base">View Original</Text>
          </TouchableOpacity>

          {doc.status === 'ready' && (
            <TouchableOpacity
              onPress={handleRetry}
              disabled={retrying}
              className="flex-1 py-3.5 rounded-rm items-center border border-genki-border bg-white"
            >
              {retrying ? (
                <ActivityIndicator color={colors.muted} />
              ) : (
                <View className="flex-row items-center gap-1.5">
                  <RefreshCw size={16} color={colors.g8} />
                  <Text className="text-genki-text font-semibold text-base">Re-extract</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={handleDelete} className="py-2 items-center">
          <Text className="text-[#C0392B] font-semibold text-sm">Delete document</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
