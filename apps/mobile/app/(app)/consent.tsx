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
import { ArrowLeft } from 'lucide-react-native';
import { consent as consentApi, audit as auditApi } from '@genki/api-client';
import type { AuditLog, ConsentSettings } from '@genki/types';
import { colors, shadows } from '../../src/theme/genki';

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
      <View className="flex-1 items-center justify-center bg-genki-bg">
        <ActivityIndicator color={colors.g8} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-genki-bg"
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
          <ArrowLeft size={20} color={colors.g8} style={{ marginRight: 12 }} />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-genki-text">Consent &amp; Privacy</Text>
      </View>

      {/* AI opt-in */}
      <View className="bg-white rounded-rm p-4 mb-4" style={shadows.shS}>
        <View className="flex-row justify-between items-center">
          <View className="flex-1 pr-4">
            <Text className="text-base font-semibold text-genki-text">AI processing</Text>
            <Text className="text-sm text-genki-muted mt-1">
              Allow your records to be processed by AI features (chat, search, summaries).
            </Text>
          </View>
          <Switch
            value={settings?.aiOptIn ?? false}
            onValueChange={handleToggleConsent}
            disabled={isSavingConsent}
            trackColor={{ true: colors.g8, false: colors.border }}
          />
        </View>
        {settings?.consentUpdatedAt ? (
          <Text className="text-xs text-genki-faint mt-2">
            Updated {formatTimestamp(settings.consentUpdatedAt)}
          </Text>
        ) : null}
      </View>

      {/* Data deletion */}
      <View className="bg-white rounded-rm p-4 mb-4" style={shadows.shS}>
        <Text className="text-base font-semibold text-genki-text mb-1">Delete all my data</Text>
        <Text className="text-sm text-genki-muted mb-3">
          Permanently erase your account and every record we store for you.
        </Text>
        <TouchableOpacity
          onPress={handleDeleteData}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel="Delete all my data"
          className="bg-[#FDECEA] py-3 rounded-rm items-center justify-center"
        >
          {isDeleting ? (
            <ActivityIndicator color="#C0392B" />
          ) : (
            <Text className="text-[#C0392B] font-bold text-base">Delete everything</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Audit log viewer */}
      <Text className="text-xs font-semibold text-genki-muted uppercase tracking-wider mb-2 mt-2">
        Activity log
      </Text>
      <View className="bg-white rounded-rm overflow-hidden" style={shadows.shS}>
        {logs.length === 0 ? (
          <Text className="text-sm text-genki-faint p-4">No activity recorded yet.</Text>
        ) : (
          logs.map((log, i) => (
            <View
              key={log.id}
              className={`px-4 py-3 ${i > 0 ? 'border-t border-genki-border' : ''}`}
            >
              <View className="flex-row justify-between items-center">
                <Text className="text-sm font-medium text-genki-text">
                  {ACTION_LABELS[log.action] ?? log.action}
                </Text>
                <Text className="text-xs text-genki-faint">{formatTimestamp(log.createdAt)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
