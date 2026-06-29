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
import { X, FileUp, Camera } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { documents as docsApi } from '@genki/api-client';
import { colors } from '../../src/theme/genki';

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
      mimeType: (asset.mimeType as PickedFile['mimeType']) ?? 'application/pdf',
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
    if (!pickedFile) return;
    setUploading(true);
    setProgress(0);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const { documentId, uploadUrl } = await docsApi.getUploadUrl(
        pickedFile.name,
        pickedFile.mimeType,
        pickedFile.size,
        token
      );

      await docsApi.uploadToStorage(uploadUrl, pickedFile.uri, pickedFile.mimeType, setProgress);

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
    <View className="flex-1 bg-genki-bg">
      <View className="flex-row items-center px-4 pt-14 pb-4 bg-white" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <X size={22} color={colors.muted} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-genki-text">Upload Document</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        <Text className="text-[11px] font-bold text-genki-faint uppercase tracking-wider mb-2">Document</Text>
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            onPress={pickDocument}
            className="flex-1 bg-genki-gtt rounded-rl py-6 items-center"
            style={{ borderWidth: 2, borderColor: 'rgba(26,61,43,0.2)', borderStyle: 'dashed' }}
          >
            <FileUp size={30} color={colors.g8} style={{ marginBottom: 6 }} />
            <Text className="text-sm font-semibold text-genki-text">Pick File</Text>
            <Text className="text-xs text-genki-faint">PDF, JPG, PNG</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={pickFromCamera}
            className="flex-1 bg-genki-gtt rounded-rl py-6 items-center"
            style={{ borderWidth: 2, borderColor: 'rgba(26,61,43,0.2)', borderStyle: 'dashed' }}
          >
            <Camera size={30} color={colors.g8} style={{ marginBottom: 6 }} />
            <Text className="text-sm font-semibold text-genki-text">Camera</Text>
            <Text className="text-xs text-genki-faint">Take photo</Text>
          </TouchableOpacity>
        </View>

        {pickedFile && (
          <View className="bg-genki-gt rounded-rl p-4 mb-6">
            <Text className="text-sm font-bold text-genki-text" numberOfLines={1}>{pickedFile.name}</Text>
            <Text className="text-xs text-genki-muted mt-1">
              {MIME_LABELS[pickedFile.mimeType]} · {(pickedFile.size / 1024).toFixed(1)} KB
            </Text>
            {uploading && (
              <View className="mt-3">
                <View className="h-1.5 bg-white rounded-full overflow-hidden">
                  <View
                    className="h-full bg-genki-g8 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </View>
                <Text className="text-xs text-genki-muted mt-1">{progress}%</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View className="p-4 bg-white" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
        <TouchableOpacity
          onPress={handleUpload}
          disabled={!pickedFile || uploading}
          className={`py-4 rounded-rm items-center ${
            pickedFile && !uploading ? 'bg-genki-g8' : 'bg-genki-gt'
          }`}
          activeOpacity={0.85}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className={`text-base font-bold ${pickedFile ? 'text-white' : 'text-genki-faint'}`}>
              Upload
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
