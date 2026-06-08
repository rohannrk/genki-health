import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { documents as docsApi } from '@medcopilot/api-client';
import { useProfile } from '../../src/context/ProfileContext';

type PickedFile = {
  uri: string;
  name: string;
  mimeType: 'image/jpeg' | 'image/png' | 'application/pdf';
  size: number;
};

const MIME_LABELS: Record<string, string> = {
  'image/jpeg': 'JPG Image',
  'image/png': 'PNG Image',
  'application/pdf': 'PDF Document',
};

export default function UploadScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { activeProfile, profiles } = useProfile();

  const [selectedProfile, setSelectedProfile] = useState(activeProfile ?? profiles[0] ?? null);
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPickedFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: (asset.mimeType as any) ?? 'application/pdf',
      size: asset.size ?? 0,
    });
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to capture documents.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const name = `photo_${Date.now()}.jpg`;
    setPickedFile({ uri: asset.uri, name, mimeType: 'image/jpeg', size: asset.fileSize ?? 0 });
  };

  const handleUpload = async () => {
    if (!pickedFile || !selectedProfile) return;
    setUploading(true);
    setProgress(0);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      // 1. Get presigned upload URL
      const { documentId, uploadUrl } = await docsApi.getUploadUrl(
        selectedProfile.id,
        pickedFile.name,
        pickedFile.mimeType,
        pickedFile.size,
        token
      );

      // 2. Upload directly to R2 with progress
      await docsApi.uploadToStorage(uploadUrl, pickedFile.uri, pickedFile.mimeType, setProgress);

      // 3. Confirm upload → triggers ingestion pipeline
      await docsApi.confirmUpload(documentId, token);

      Alert.alert('Upload complete', 'Your document is being processed. It will appear in the timeline shortly.');
      router.back();
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-14 pb-4 border-b border-slate-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Text className="text-slate-500 text-base">✕</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-slate-900">Upload Document</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Profile selector */}
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Patient</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
          {profiles.map(p => (
            <TouchableOpacity
              key={p.id}
              onPress={() => setSelectedProfile(p)}
              className={`mr-2 px-4 py-2 rounded-full border ${
                selectedProfile?.id === p.id
                  ? 'bg-slate-900 border-slate-900'
                  : 'bg-white border-slate-200'
              }`}
            >
              <Text className={`text-sm font-semibold ${selectedProfile?.id === p.id ? 'text-white' : 'text-slate-700'}`}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Pick file */}
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Document</Text>
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            onPress={pickDocument}
            className="flex-1 border-2 border-dashed border-slate-300 rounded-2xl py-6 items-center"
          >
            <Text className="text-2xl mb-1">📄</Text>
            <Text className="text-sm font-semibold text-slate-600">Pick File</Text>
            <Text className="text-xs text-slate-400">PDF, JPG, PNG</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={pickFromCamera}
            className="flex-1 border-2 border-dashed border-slate-300 rounded-2xl py-6 items-center"
          >
            <Text className="text-2xl mb-1">📷</Text>
            <Text className="text-sm font-semibold text-slate-600">Camera</Text>
            <Text className="text-xs text-slate-400">Take photo</Text>
          </TouchableOpacity>
        </View>

        {/* Preview */}
        {pickedFile && (
          <View className="bg-slate-50 rounded-2xl border border-slate-200 p-4 mb-6">
            <Text className="text-sm font-bold text-slate-800" numberOfLines={1}>{pickedFile.name}</Text>
            <Text className="text-xs text-slate-400 mt-1">
              {MIME_LABELS[pickedFile.mimeType]} · {(pickedFile.size / 1024).toFixed(1)} KB
            </Text>
            {uploading && (
              <View className="mt-3">
                <View className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </View>
                <Text className="text-xs text-slate-400 mt-1">{progress}%</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Upload button */}
      <View className="p-4 border-t border-slate-200">
        <TouchableOpacity
          onPress={handleUpload}
          disabled={!pickedFile || !selectedProfile || uploading}
          className={`py-4 rounded-2xl items-center ${
            pickedFile && selectedProfile && !uploading ? 'bg-emerald-600' : 'bg-slate-200'
          }`}
          activeOpacity={0.85}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className={`text-base font-bold ${pickedFile && selectedProfile ? 'text-white' : 'text-slate-400'}`}>
              Upload
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
