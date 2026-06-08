import React, { useCallback, useEffect, useState } from 'react';
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
import * as WebBrowser from 'expo-web-browser';
import QRCode from 'react-native-qrcode-svg';
import {
  documents as documentsApi,
  shares as sharesApi,
  type DocumentItem,
} from '@medcopilot/api-client';
import type { Share } from '@medcopilot/types';
import { useProfile } from '../../src/context/ProfileContext';

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

  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expiryHours, setExpiryHours] = useState(72);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [share, setShare] = useState<Share | null>(null);

  const profileId = activeProfile?.id;
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  const load = useCallback(async () => {
    if (!profileId) {
      setIsLoading(false);
      return;
    }
    const token = await getToken();
    if (!token) return;
    const data = await documentsApi.list(profileId, token);
    setDocs(data.documents);
  }, [getToken, profileId]);

  useEffect(() => {
    load()
      .catch(() => Alert.alert('Error', 'Could not load documents.'))
      .finally(() => setIsLoading(false));
  }, [load]);

  const toggle = (id: string) => {
    setShare(null); // selection changed — invalidate any prior link
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };

  const handleCreateShare = async () => {
    if (isCreating || !profileId || selectedIds.length === 0) return;
    setIsCreating(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session');
      const created = await sharesApi.create(
        { profileId, documentIds: selectedIds, expiresInHours: expiryHours },
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
    if (isExporting || !profileId || selectedIds.length === 0) return;
    setIsExporting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session');
      const downloadUrl = await documentsApi.exportPdf(
        { profileId, documentIds: selectedIds },
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
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator color="#059669" size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
    >
      <View className="flex-row items-center mb-6">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text className="text-teal-600 text-base font-medium mr-3">‹ Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-slate-800">Share Records</Text>
      </View>

      {!profileId ? (
        <Text className="text-sm text-slate-500">Select a patient profile first.</Text>
      ) : (
        <>
          <Text className="text-sm text-slate-500 mb-3">
            Patient: <Text className="font-semibold text-slate-700">{activeProfile?.name}</Text>
          </Text>

          {/* Document selection */}
          <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Select documents
          </Text>
          <View className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
            {docs.length === 0 ? (
              <Text className="text-sm text-slate-400 p-4">No documents to share yet.</Text>
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
                      i > 0 ? 'border-t border-slate-100' : ''
                    }`}
                  >
                    <View
                      className={`w-5 h-5 rounded-md border mr-3 items-center justify-center ${
                        isOn ? 'bg-teal-600 border-teal-600' : 'border-slate-300'
                      }`}
                    >
                      {isOn ? <Text className="text-white text-xs font-bold">✓</Text> : null}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-slate-700">
                        {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                        {doc.date ? ` · ${doc.date}` : ''}
                      </Text>
                      {doc.hospitalName ? (
                        <Text className="text-xs text-slate-400">{doc.hospitalName}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Expiry selection */}
          <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
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
                  className={`flex-1 rounded-xl border py-2.5 items-center ${
                    on ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${on ? 'text-teal-700' : 'text-slate-600'}`}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Generated link + QR */}
          {share ? (
            <View className="bg-white rounded-xl border border-slate-200 p-4 mb-5 items-center">
              <View className="p-3 bg-white rounded-lg">
                <QRCode value={share.url} size={180} />
              </View>
              <Text className="text-xs text-slate-400 mt-3 text-center" selectable>
                {share.url}
              </Text>
              <Text className="text-xs text-slate-400 mt-1">
                Expires {new Date(share.expiresAt).toLocaleString()}
              </Text>
              <TouchableOpacity
                onPress={handleSendLink}
                className="bg-teal-600 py-3 rounded-xl items-center justify-center w-full mt-4"
                accessibilityRole="button"
                accessibilityLabel="Send link"
              >
                <Text className="text-white font-bold text-base">Send link</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleCreateShare}
              disabled={isCreating || selectedIds.length === 0}
              className={`py-3.5 rounded-xl items-center justify-center mb-3 ${
                isCreating || selectedIds.length === 0 ? 'bg-teal-400' : 'bg-teal-600'
              }`}
              accessibilityRole="button"
              accessibilityLabel="Generate share link"
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
            className={`py-3.5 rounded-xl items-center justify-center border ${
              isExporting || selectedIds.length === 0
                ? 'border-slate-200 bg-slate-100'
                : 'border-teal-600 bg-white'
            }`}
            accessibilityRole="button"
            accessibilityLabel="Export selected as PDF"
          >
            {isExporting ? (
              <ActivityIndicator color="#0d9488" />
            ) : (
              <Text
                className={`font-bold text-base ${
                  selectedIds.length === 0 ? 'text-slate-400' : 'text-teal-700'
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
