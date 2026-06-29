import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { me as meApi } from '@genki/api-client';
import { useProfile } from '../../src/context/ProfileContext';
import { colors, shadows } from '../../src/theme/genki';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDisplayDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function CreateProfileScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { setMe, hasProfile } = useProfile();

  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const canSkip = hasProfile;

  const handlePickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo library access to choose an avatar.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleDateChange = (_event: unknown, selected?: Date) => {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (selected) setDob(selected);
  };

  const handleCreate = async () => {
    if (isSaving) return;
    if (!name.trim()) {
      setError('Please enter a name.');
      return;
    }
    if (!dob) {
      setError('Please select a date of birth.');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      // NOTE: avatar upload is not wired yet — there is no avatar presigned-URL
      // endpoint on the backend. The picked image is shown locally only.
      const updated = await meApi.update(
        { name: name.trim(), dob: toYMD(dob) },
        token
      );

      setMe(updated);
      router.replace('/(app)/(tabs)');
    } catch {
      setError('Could not create the profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-genki-bg"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-3xl font-extrabold text-genki-text tracking-tight mt-6 mb-2">
          About you
        </Text>
        <Text className="text-sm text-genki-muted mb-8">
          Tell us a little about yourself so we can organize your health records.
        </Text>

        {/* Avatar */}
        <View className="items-center mb-8">
          <TouchableOpacity
            onPress={handlePickAvatar}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Choose avatar"
            className="w-24 h-24 rounded-full bg-genki-gt border-2 border-genki-g8 items-center justify-center overflow-hidden"
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} className="w-24 h-24" />
            ) : (
              <Text className="text-2xl font-bold text-genki-g8">
                {initialsFromName(name)}
              </Text>
            )}
          </TouchableOpacity>
          <Text className="text-xs text-genki-faint mt-2">Tap to add a photo</Text>
        </View>

        {/* Name */}
        <Text className="text-xs font-semibold text-genki-muted uppercase tracking-wider mb-1.5">
          Name
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor="#8FA495"
          autoCapitalize="words"
          returnKeyType="next"
          className="bg-white border border-genki-border rounded-rs px-4 py-3.5 text-base text-genki-text mb-4"
          style={shadows.shS}
        />

        {/* Date of birth */}
        <Text className="text-xs font-semibold text-genki-muted uppercase tracking-wider mb-1.5">
          Date of birth
        </Text>
        <TouchableOpacity
          onPress={() => setShowPicker(s => !s)}
          accessibilityRole="button"
          accessibilityLabel="Select date of birth"
          className="bg-white border border-genki-border rounded-rs px-4 py-3.5 mb-2"
          style={shadows.shS}
        >
          <Text className={dob ? 'text-base text-genki-text' : 'text-base text-genki-faint'}>
            {dob ? formatDisplayDate(dob) : 'Select date'}
          </Text>
        </TouchableOpacity>
        {showPicker && (
          <View className="mb-2">
            <DateTimePicker
              value={dob ?? new Date(2000, 0, 1)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={handleDateChange}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                onPress={() => setShowPicker(false)}
                className="self-end px-3 py-1"
              >
                <Text className="text-genki-g5 font-semibold">Done</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View className="mb-8" />

        {/* Error */}
        {error ? (
          <View className="bg-[#FDECEA] rounded-rm px-4 py-3 mb-4">
            <Text className="text-[#C0392B] text-sm font-medium">{error}</Text>
          </View>
        ) : null}

        {/* Create button */}
        <TouchableOpacity
          onPress={handleCreate}
          disabled={isSaving}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Create profile"
          className={`py-3.5 rounded-rm items-center justify-center ${
            isSaving ? 'bg-genki-g5' : 'bg-genki-g8'
          }`}
          style={isSaving ? undefined : shadows.greenBtn}
        >
          {isSaving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white font-bold text-base">Create Profile</Text>
          )}
        </TouchableOpacity>

        {/* Skip — only when the user already has profiles */}
        {canSkip && (
          <TouchableOpacity
            onPress={() => router.replace('/(app)/(tabs)')}
            disabled={isSaving}
            className="items-center mt-4"
            accessibilityRole="button"
            accessibilityLabel="I'll add this later"
          >
            <Text className="text-genki-muted text-sm font-medium">I&apos;ll add this later</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
