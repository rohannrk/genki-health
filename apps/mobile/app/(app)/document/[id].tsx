import React, { useEffect, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { documents as docsApi } from '@medcopilot/api-client';
import { MedicalDocument } from '@medcopilot/types';
import { formatDate } from '@medcopilot/utils';

const STATUS_COLORS: Record<string, string> = {
  ready: 'bg-emerald-100 text-emerald-700',
  processing: 'bg-amber-100 text-amber-700',
  uploading: 'bg-blue-100 text-blue-700',
  error: 'bg-red-100 text-red-700',
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
const STAGE_ORDER = ['queued', ...STAGES.map(s => s.key), 'done'];
// Rough per-stage seconds, used to estimate remaining time.
const EST_TOTAL_SECONDS = 20;

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [doc, setDoc] = useState<MedicalDocument & { downloadUrl?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const fetchDoc = async () => {
      try {
        const token = await getTokenRef.current();
        if (!token || !id) return;
        const data = await docsApi.get(id, token);
        setDoc(data as any);

        // Poll while processing
        if ((data as any).status === 'processing' || (data as any).status === 'uploading') {
          timer = setTimeout(fetchDoc, 3000);
        }
      } catch (err) {
        console.error('Failed to load document:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
    return () => clearTimeout(timer);
  }, [id]);

  // Elapsed timer while the document is being processed.
  const isProcessing = doc?.status === 'processing' || doc?.status === 'uploading';
  useEffect(() => {
    if (!isProcessing) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  const handleRetry = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      await docsApi.retry(id, token);
      setDoc(prev => (prev ? ({ ...prev, status: 'processing' } as any) : prev));
      // Resume polling
      const poll = async () => {
        const t = await getTokenRef.current();
        if (!t) return;
        const data = await docsApi.get(id, t);
        setDoc(data as any);
        if ((data as any).status === 'processing' || (data as any).status === 'uploading') {
          setTimeout(poll, 3000);
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
    // Hand off to the Chat tab, which fetches the summary and shows it inline as
    // an assistant message. The nonce makes every tap a fresh request.
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
      const updated = await docsApi.rename(id, next.length ? next : null, token);
      setDoc(prev => (prev ? ({ ...prev, title: updated.title } as any) : prev));
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
    const url = (doc as any)?.downloadUrl;
    if (url) Linking.openURL(url);
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50">
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (!doc) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50 p-8">
        <Text className="text-slate-500 text-center">Document not found.</Text>
      </View>
    );
  }

  const statusClass = STATUS_COLORS[doc.status] ?? 'bg-slate-100 text-slate-600';
  const metadata = doc.metadata as Record<string, string>;

  return (
    <View className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="bg-white border-b border-slate-200 px-4 pt-14 pb-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-3 flex-row items-center">
          <Ionicons name="arrow-back" size={18} color="#059669" />
          <Text className="text-emerald-600 font-semibold ml-1">Back</Text>
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
                  placeholderTextColor="#94a3b8"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveTitle}
                  className="text-xl font-bold text-slate-900 border-b border-emerald-400 pb-1"
                />
                <View className="flex-row items-center mt-2">
                  <TouchableOpacity onPress={handleSaveTitle} disabled={savingTitle} className="mr-4">
                    {savingTitle ? (
                      <ActivityIndicator size="small" color="#059669" />
                    ) : (
                      <Text className="text-emerald-600 font-semibold text-sm">Save</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setRenaming(false)} disabled={savingTitle}>
                    <Text className="text-slate-400 font-semibold text-sm">Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center">
                <Text className="text-xl font-bold text-slate-900 flex-shrink" numberOfLines={2}>
                  {doc.title?.trim() || TYPE_LABELS[doc.type] || 'Document'}
                </Text>
                <TouchableOpacity onPress={startRename} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} className="ml-2">
                  <Ionicons name="pencil" size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            )}
            {doc.title?.trim() && !renaming && (
              <Text className="text-xs text-slate-400 mt-0.5">{TYPE_LABELS[doc.type] ?? doc.type}</Text>
            )}
            {doc.hospitalName && (
              <Text className="text-sm text-slate-500 mt-0.5">{doc.hospitalName}</Text>
            )}
            {doc.doctorName && (
              <Text className="text-xs text-slate-400 mt-0.5">{doc.doctorName}</Text>
            )}
          </View>
          <View className={`px-3 py-1 rounded-full ${statusClass.split(' ')[0]}`}>
            <Text className={`text-xs font-semibold capitalize ${statusClass.split(' ')[1]}`}>
              {doc.status}
            </Text>
          </View>
        </View>
        {doc.date && (
          <Text className="text-sm text-slate-500 mt-2">{formatDate(doc.date)}</Text>
        )}
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Metadata */}
        {(metadata.diagnosis || metadata.treatment) && (
          <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
            <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Extracted Info
            </Text>
            {metadata.diagnosis && (
              <View className="mb-2">
                <Text className="text-xs text-slate-400 font-medium">Diagnosis</Text>
                <Text className="text-sm text-slate-800 mt-0.5">{metadata.diagnosis}</Text>
              </View>
            )}
            {metadata.treatment && (
              <View>
                <Text className="text-xs text-slate-400 font-medium">Treatment</Text>
                <Text className="text-sm text-slate-800 mt-0.5">{metadata.treatment}</Text>
              </View>
            )}
          </View>
        )}

        {/* Processing state — stepper + ETA */}
        {(doc.status === 'processing' || doc.status === 'uploading') && (() => {
          const stage = (metadata.processingStage as string) || 'queued';
          const currentIdx = Math.max(0, STAGE_ORDER.indexOf(stage));
          const remaining = Math.max(0, EST_TOTAL_SECONDS - elapsed);
          return (
            <View className="bg-amber-50 rounded-2xl border border-amber-200 p-4 mb-4">
              <View className="flex-row items-center mb-3">
                <ActivityIndicator size="small" color="#d97706" />
                <Text className="text-amber-800 text-sm font-bold ml-3 flex-1">
                  Processing document…
                </Text>
                <Text className="text-amber-600 text-xs font-medium">{elapsed}s</Text>
              </View>

              {STAGES.map((s, i) => {
                const stageIdx = STAGE_ORDER.indexOf(s.key);
                const done = stageIdx < currentIdx;
                const active = stageIdx === currentIdx;
                return (
                  <View key={s.key} className="flex-row items-center py-1">
                    {done
                      ? <Ionicons name="checkmark-circle" size={18} color="#059669" style={{ marginRight: 8 }} />
                      : active
                      ? <Ionicons name="time-outline" size={18} color="#d97706" style={{ marginRight: 8 }} />
                      : <Ionicons name="ellipse-outline" size={18} color="#cbd5e1" style={{ marginRight: 8 }} />
                    }
                    <Text
                      className={`text-sm ${
                        active ? 'text-amber-800 font-semibold' : done ? 'text-amber-600' : 'text-amber-400'
                      }`}
                    >
                      {s.label}
                    </Text>
                  </View>
                );
              })}

              <Text className="text-amber-600 text-xs mt-3">
                {remaining > 0
                  ? `Usually ready in about ${remaining}s. This runs with your AI key.`
                  : 'Taking longer than usual — almost there…'}
              </Text>
            </View>
          );
        })()}

        {/* Error state — retry */}
        {doc.status === 'error' && (
          <View className="bg-red-50 rounded-2xl border border-red-200 p-4 mb-4">
            <Text className="text-red-700 text-sm font-bold mb-1">Processing failed</Text>
            <Text className="text-red-600 text-sm mb-3">
              {(metadata.processingError as string) || 'Something went wrong while analysing this document.'}
            </Text>
            <TouchableOpacity
              onPress={handleRetry}
              disabled={retrying}
              className="bg-red-600 py-3 rounded-xl items-center"
            >
              {retrying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="refresh" size={16} color="#ffffff" />
                  <Text className="text-white font-bold text-sm">Retry processing</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Note (e.g. no AI key) */}
        {doc.status === 'ready' && metadata.processingNote ? (
          <View className="bg-blue-50 rounded-2xl border border-blue-200 p-4 mb-4">
            <Text className="text-blue-700 text-sm">{metadata.processingNote as string}</Text>
          </View>
        ) : null}

        {/* Extracted text */}
        {doc.extractedText ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
            <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Extracted Text
            </Text>
            <Text className="text-sm text-slate-700 font-mono leading-relaxed">
              {doc.extractedText}
            </Text>
          </View>
        ) : doc.status === 'ready' ? (
          <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 items-center py-8">
            <Text className="text-slate-400 text-sm">No text could be extracted from this document.</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Action buttons */}
      <View className="p-4 border-t border-slate-200 gap-3">
        <TouchableOpacity
          onPress={handleSummarise}
          disabled={doc.status !== 'ready'}
          className={`py-3.5 rounded-2xl items-center ${
            doc.status === 'ready' ? 'bg-slate-900' : 'bg-slate-200'
          }`}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="sparkles" size={18} color={doc.status === 'ready' ? '#ffffff' : '#94a3b8'} />
            <Text className={`font-bold text-base ${doc.status === 'ready' ? 'text-white' : 'text-slate-400'}`}>
              Summarise in Chat
            </Text>
          </View>
        </TouchableOpacity>

        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={handleViewOriginal}
            className="flex-1 py-3.5 rounded-2xl items-center border border-slate-200 bg-white"
          >
            <Text className="text-slate-700 font-semibold text-base">View Original</Text>
          </TouchableOpacity>

          {doc.status === 'ready' && (
            <TouchableOpacity
              onPress={handleRetry}
              disabled={retrying}
              className="flex-1 py-3.5 rounded-2xl items-center border border-slate-200 bg-white"
            >
              {retrying ? (
                <ActivityIndicator color="#475569" />
              ) : (
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="refresh" size={16} color="#334155" />
                  <Text className="text-slate-700 font-semibold text-base">Re-extract</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={handleDelete} className="py-2 items-center">
          <Text className="text-red-600 font-semibold text-sm">Delete document</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
