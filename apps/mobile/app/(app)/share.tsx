import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Share as RNShare,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { ArrowLeft, Check } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { documents as documentsApi, shares as sharesApi } from '@genki/api-client';
import type { MedicalDocument, Share } from '@genki/types';
import { useProfile } from '../../src/context/ProfileContext';
import { colors, shadows } from '../../src/theme/genki';

const EXPIRY_OPTIONS = [
  { label: '24 hours', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 24 * 7 },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  prescription: 'Prescription',
  lab: 'Lab report',
  invoice: 'Invoice',
  imaging: 'Imaging',
  report: 'Report',
  other: 'Document',
};

export default function ShareScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { activeProfile } = useProfile();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [docs, setDocs] = useState<MedicalDocument[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expiryHours, setExpiryHours] = useState(72);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [share, setShare] = useState<Share | null>(null);

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  const load = useCallback(async () => {
    const token = await getTokenRef.current();
    if (!token) return;
    const data = await documentsApi.list(token);
    setDocs(data.documents);
  }, []);

  useEffect(() => {
    load()
      .catch(() => Alert.alert('Error', 'Could not load documents.'))
      .finally(() => setIsLoading(false));
  }, [load]);

  const toggle = (id: string) => {
    setShare(null);
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };

  const handleCreateShare = async () => {
    if (isCreating || selectedIds.length === 0) return;
    setIsCreating(true);
    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error('No session');
      const created = await sharesApi.create(
        { documentIds: selectedIds, expiresInHours: expiryHours },
        token
      );
      setShare(created);
    } catch {
      Alert.alert('Error', 'Could not create the share link.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendLink = async () => {
    if (!share) return;
    try {
      await RNShare.share({
        message: `View shared medical records (expires ${new Date(
          share.expiresAt
        ).toLocaleString()}):\n${share.url}`,
        url: share.url,
      });
    } catch {
      // user dismissed the share sheet
    }
  };

  const handleExportPdf = async () => {
    if (isExporting || selectedIds.length === 0) return;
    setIsExporting(true);
    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error('No session');
      const downloadUrl = await documentsApi.exportPdf(
        { documentIds: selectedIds },
        token
      );
      await WebBrowser.openBrowserAsync(downloadUrl);
    } catch {
      Alert.alert('Error', 'Could not export the PDF.');
    } finally {
      setIsExporting(false);
    }
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
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
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
        <Text className="text-2xl font-bold text-genki-text">Share Records</Text>
      </View>

      {!activeProfile ? (
        <Text className="text-sm text-genki-muted">Loading your records…</Text>
      ) : (
        <>
          <Text className="text-sm text-genki-muted mb-3">
            Sharing records for <Text className="font-semibold text-genki-text">{activeProfile.name}</Text>
          </Text>

          {/* Document selection */}
          <Text className="text-xs font-semibold text-genki-muted uppercase tracking-wider mb-2">
            Select documents
          </Text>
          <View className="bg-white rounded-rm overflow-hidden mb-4" style={shadows.shS}>
            {docs.length === 0 ? (
              <Text className="text-sm text-genki-faint p-4">No documents to share yet.</Text>
            ) : (
              docs.map((doc, i) => {
                const isOn = !!selected[doc.id];
                return (
                  <TouchableOpacity
                    key={doc.id}
                    onPress={() => toggle(doc.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isOn }}
                    className={`flex-row items-center px-4 py-3 ${
                      i > 0 ? 'border-t border-genki-border' : ''
                    }`}
                  >
                    <View
                      className={`w-5 h-5 rounded-md mr-3 items-center justify-center ${
                        isOn ? 'bg-genki-g8' : 'border border-genki-border'
                      }`}
                    >
                      {isOn ? <Check size={12} color="#ffffff" /> : null}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-genki-text">
                        {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                        {doc.date ? ` · ${doc.date}` : ''}
                      </Text>
                      {doc.hospitalName ? (
                        <Text className="text-xs text-genki-faint">{doc.hospitalName}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Expiry selection */}
          <Text className="text-xs font-semibold text-genki-muted uppercase tracking-wider mb-2">
            Link expires after
          </Text>
          <View className="flex-row gap-x-3 mb-5">
            {EXPIRY_OPTIONS.map((opt) => {
              const on = expiryHours === opt.hours;
              return (
                <TouchableOpacity
                  key={opt.hours}
                  onPress={() => {
                    setShare(null);
                    setExpiryHours(opt.hours);
                  }}
                  className={`flex-1 rounded-rm border py-2.5 items-center ${
                    on ? 'border-genki-g8 bg-genki-gt' : 'border-genki-border bg-white'
                  }`}
                  style={on ? undefined : shadows.shS}
                >
                  <Text className={`text-sm font-semibold ${on ? 'text-genki-g8' : 'text-genki-muted'}`}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Generated link */}
          {share ? (
            <View className="bg-white rounded-rm p-4 mb-5" style={shadows.shS}>
              <Text className="text-xs font-semibold text-genki-muted uppercase tracking-wider mb-2">
                Share link
              </Text>
              <Text className="text-xs text-genki-muted mb-1" selectable numberOfLines={2}>
                {share.url}
              </Text>
              <Text className="text-xs text-genki-faint mb-4">
                Expires {new Date(share.expiresAt).toLocaleString()}
              </Text>
              <TouchableOpacity
                onPress={handleSendLink}
                className="bg-genki-g8 py-3 rounded-rm items-center justify-center w-full"
                accessibilityRole="button"
                accessibilityLabel="Send link"
                style={shadows.greenBtn}
              >
                <Text className="text-white font-bold text-base">Send link</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleCreateShare}
              disabled={isCreating || selectedIds.length === 0}
              className={`py-3.5 rounded-rm items-center justify-center mb-3 ${
                isCreating || selectedIds.length === 0 ? 'bg-genki-g5' : 'bg-genki-g8'
              }`}
              accessibilityRole="button"
              accessibilityLabel="Generate share link"
              style={isCreating || selectedIds.length === 0 ? undefined : shadows.greenBtn}
            >
              {isCreating ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-base">
                  Generate link ({selectedIds.length})
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* PDF export */}
          <TouchableOpacity
            onPress={handleExportPdf}
            disabled={isExporting || selectedIds.length === 0}
            className={`py-3.5 rounded-rm items-center justify-center border ${
              isExporting || selectedIds.length === 0
                ? 'border-genki-border bg-genki-bg'
                : 'border-genki-g8 bg-white'
            }`}
            accessibilityRole="button"
            accessibilityLabel="Export selected as PDF"
          >
            {isExporting ? (
              <ActivityIndicator color={colors.g8} />
            ) : (
              <Text
                className={`font-bold text-base ${
                  selectedIds.length === 0 ? 'text-genki-faint' : 'text-genki-g8'
                }`}
              >
                Export PDF ({selectedIds.length})
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}
