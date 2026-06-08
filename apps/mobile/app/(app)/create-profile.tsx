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
import { profiles as profilesApi } from '@medcopilot/api-client';
import type { Relation } from '@medcopilot/types';
import { useProfile } from '../../src/context/ProfileContext';

const RELATIONS: { label: string; value: Relation }[] = [
  { label: 'Myself', value: 'self' },
  { label: 'Spouse', value: 'spouse' },
  { label: 'Parent', value: 'parent' },
  { label: 'Child', value: 'child' },
  { label: 'Other', value: 'other' },
];

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
  const { profiles, addProfile } = useProfile();

  const [name, setName] = useState('');
  const [relation, setRelation] = useState<Relation>('self');
  const [dob, setDob] = useState<Date | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const canSkip = profiles.length > 0;

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
    // On Android the picker is a dialog and closes itself.
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

      // NOTE: avatar upload is not wired yet — there is no profile-avatar
      // presigned-URL endpoint on the backend (the documents upload-url route
      // requires an existing profileId). The picked image is shown locally;
      // avatarKey is omitted until that endpoint exists.
      const created = await profilesApi.create(
        { name: name.trim(), dob: toYMD(dob), relation },
        token
      );

      addProfile(created);
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
      className="flex-1 bg-slate-50"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-3xl font-extrabold text-slate-900 tracking-tight mt-6 mb-8">
          Who are you tracking health for?
        </Text>

        {/* Avatar */}
        <View className="items-center mb-8">
          <TouchableOpacity
            onPress={handlePickAvatar}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Choose avatar"
            className="w-24 h-24 rounded-full bg-teal-100 border border-teal-200 items-center justify-center overflow-hidden"
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} className="w-24 h-24" />
            ) : (
              <Text className="text-2xl font-bold text-teal-700">
                {initialsFromName(name)}
              </Text>
            )}
          </TouchableOpacity>
          <Text className="text-xs text-slate-400 mt-2">Tap to add a photo</Text>
        </View>

        {/* Name */}
        <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Name
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
          returnKeyType="next"
          className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900 mb-4"
        />

        {/* Date of birth */}
        <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Date of birth
        </Text>
        <TouchableOpacity
          onPress={() => setShowPicker(s => !s)}
          accessibilityRole="button"
          accessibilityLabel="Select date of birth"
          className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 mb-2"
        >
          <Text className={dob ? 'text-base text-slate-900' : 'text-base text-slate-400'}>
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
                <Text className="text-teal-600 font-semibold">Done</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Relation chips */}
        <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 mt-2">
          Relation
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-8"
          contentContainerStyle={{ gap: 8 }}
        >
          {RELATIONS.map(r => {
            const selected = r.value === relation;
            return (
              <TouchableOpacity
                key={r.value}
                onPress={() => setRelation(r.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`px-4 py-2 rounded-full border ${
                  selected
                    ? 'bg-teal-600 border-teal-600'
                    : 'bg-white border-slate-200'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    selected ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Error */}
        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <Text className="text-red-600 text-sm font-medium">{error}</Text>
          </View>
        ) : null}

        {/* Create button */}
        <TouchableOpacity
          onPress={handleCreate}
          disabled={isSaving}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Create profile"
          className={`py-3.5 rounded-xl items-center justify-center ${
            isSaving ? 'bg-teal-400' : 'bg-teal-600'
          }`}
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
            <Text className="text-slate-500 text-sm font-medium">I&apos;ll add this later</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
