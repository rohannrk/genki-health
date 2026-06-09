import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { consent as consentApi, audit as auditApi } from '@medcopilot/api-client';
import type { AuditLog, ConsentSettings } from '@medcopilot/types';

// Human-readable labels for the audit action codes the backend emits.
const ACTION_LABELS: Record<string, string> = {
  AI_CHAT_INVOKED: 'AI chat',
  AI_SUMMARISE_INVOKED: 'AI summary',
  AI_SEARCH_INVOKED: 'AI search',
  AI_KEY_SAVED: 'API key saved',
  AI_KEY_DELETED: 'API key removed',
  upload_start: 'Document uploaded',
  delete_document: 'Document deleted',
  share_created: 'Share link created',
  share_accessed: 'Share link opened',
  share_revoked: 'Share link revoked',
  pdf_export: 'PDF exported',
  fhir_export: 'FHIR exported',
  consent_updated: 'Consent updated',
  account_deleted: 'Account deleted',
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ConsentScreen() {
  const router = useRouter();
  const { getToken, signOut } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [settings, setSettings] = useState<ConsentSettings | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    const token = await getTokenRef.current();
    if (!token) return;
    const [consentData, auditData] = await Promise.all([
      consentApi.get(token),
      auditApi.list({ limit: 25 }, token),
    ]);
    setSettings(consentData);
    setLogs(auditData.logs);
  }, []);

  useEffect(() => {
    load()
      .catch(() => Alert.alert('Error', 'Could not load privacy settings.'))
      .finally(() => setIsLoading(false));
  }, [load]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await load();
    } catch {
      // best-effort refresh
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleConsent = async (value: boolean) => {
    if (isSavingConsent) return;
    setIsSavingConsent(true);
    // Optimistic update; revert on failure.
    const previous = settings;
    setSettings((s) => (s ? { ...s, aiOptIn: value } : s));
    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error('No session');
      const updated = await consentApi.update({ aiOptIn: value }, token);
      setSettings(updated);
    } catch {
      setSettings(previous);
      Alert.alert('Error', 'Could not update your consent setting.');
    } finally {
      setIsSavingConsent(false);
    }
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Delete all my data',
      'This permanently deletes your account, all patient profiles, documents, and uploaded files. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const token = await getTokenRef.current();
              if (!token) throw new Error('No session');
              await consentApi.deleteAccount(token);
              // Sign out of Clerk too — otherwise the next authed request would
              // recreate an empty user via the getOrCreateUser middleware. The
              // (app) layout guard redirects to login once the session clears.
              await signOut();
            } catch {
              setIsDeleting(false);
              Alert.alert('Error', 'Could not delete your data. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator color="#059669" size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      <View className="flex-row items-center mb-6">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color="#0d9488" style={{ marginRight: 12 }} />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-slate-800">Consent &amp; Privacy</Text>
      </View>

      {/* AI opt-in */}
      <View className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <View className="flex-row justify-between items-center">
          <View className="flex-1 pr-4">
            <Text className="text-base font-semibold text-slate-800">AI processing</Text>
            <Text className="text-sm text-slate-500 mt-1">
              Allow your records to be processed by AI features (chat, search, summaries).
            </Text>
          </View>
          <Switch
            value={settings?.aiOptIn ?? false}
            onValueChange={handleToggleConsent}
            disabled={isSavingConsent}
            trackColor={{ true: '#0d9488', false: '#cbd5e1' }}
          />
        </View>
        {settings?.consentUpdatedAt ? (
          <Text className="text-xs text-slate-400 mt-2">
            Updated {formatTimestamp(settings.consentUpdatedAt)}
          </Text>
        ) : null}
      </View>

      {/* Data deletion */}
      <View className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <Text className="text-base font-semibold text-slate-800 mb-1">Delete all my data</Text>
        <Text className="text-sm text-slate-500 mb-3">
          Permanently erase your account and every record we store for you.
        </Text>
        <TouchableOpacity
          onPress={handleDeleteData}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel="Delete all my data"
          className="bg-red-50 border border-red-200 py-3 rounded-xl items-center justify-center"
        >
          {isDeleting ? (
            <ActivityIndicator color="#dc2626" />
          ) : (
            <Text className="text-red-600 font-bold text-base">Delete everything</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Audit log viewer */}
      <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2">
        Activity log
      </Text>
      <View className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {logs.length === 0 ? (
          <Text className="text-sm text-slate-400 p-4">No activity recorded yet.</Text>
        ) : (
          logs.map((log, i) => (
            <View
              key={log.id}
              className={`px-4 py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}
            >
              <View className="flex-row justify-between items-center">
                <Text className="text-sm font-medium text-slate-700">
                  {ACTION_LABELS[log.action] ?? log.action}
                </Text>
                <Text className="text-xs text-slate-400">{formatTimestamp(log.createdAt)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
