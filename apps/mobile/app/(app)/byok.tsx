import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { useProfile } from '../../src/context/ProfileContext';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://api.medcopilot.in';

type ProviderId = 'openai' | 'anthropic' | 'gemini';

type Provider = {
  id: ProviderId;
  name: string;
  model: string;
  icon: string;
  placeholder: string;
  keyUrl: string;
};

const PROVIDERS: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    model: 'GPT-4o',
    icon: '🤖',
    placeholder: 'sk-proj-...',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    model: 'Claude Sonnet',
    icon: '🧠',
    placeholder: 'sk-ant-...',
    keyUrl: 'https://console.anthropic.com/keys',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    model: 'Gemini 3.5 Flash',
    icon: '✨',
    placeholder: 'AIza...',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
];

export default function ByokScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { profiles, activeProfile, refreshProfiles } = useProfile();
  const params = useLocalSearchParams<{ profileId?: string }>();
  const targetProfile =
    profiles.find(p => p.id === params.profileId) ?? activeProfile ?? null;

  const [selectedId, setSelectedId] = useState<ProviderId>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedLast4, setSavedLast4] = useState<string | null>(null);

  const provider = PROVIDERS.find(p => p.id === selectedId)!;
  const isSaved = savedLast4 !== null;

  const handleSelectProvider = (id: ProviderId) => {
    if (isSaving || isSaved) return;
    setSelectedId(id);
    setError('');
  };

  const handleOpenKeyHelp = async () => {
    try {
      await WebBrowser.openBrowserAsync(provider.keyUrl);
    } catch {
      // Opening the browser is best-effort; ignore failures.
    }
  };

  const handleValidateAndSave = async () => {
    if (isSaving || isSaved) return;

    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setError('Please enter your API key.');
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

      if (!targetProfile) {
        setError('No family member selected. Open this from a profile in Settings.');
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      // 1. Validate the key actually works with the provider.
      const validateRes = await fetch(`${API_BASE}/api/v1/keys/validate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider: selectedId, apiKey: trimmedKey }),
      });
      if (!validateRes.ok) {
        const data = await validateRes.json().catch(() => ({}));
        setError(data.reason || data.error || 'That API key could not be validated.');
        return;
      }

      // 2. Encrypt + store the key server-side for this profile.
      const saveRes = await fetch(`${API_BASE}/api/v1/keys/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ profileId: targetProfile.id, provider: selectedId, apiKey: trimmedKey }),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        setError(data.reason || data.error || 'Could not save your API key. Please try again.');
        return;
      }

      // 3. Reflect the new state, wipe the key from memory, and return.
      setSavedLast4(trimmedKey.slice(-4));
      setApiKey('');
      await refreshProfiles();
      router.back();
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    if (isSaving) return;
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center px-6 py-12">
          {/* Header */}
          <View className="mb-8">
            <Text className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Connect AI
            </Text>
            <Text className="text-sm text-slate-500 mt-2 leading-5">
              {targetProfile
                ? `Set the AI key for ${targetProfile.name}. Their records are processed using this key — we never see your data.`
                : 'Open this from a family member in Settings to set their AI key.'}
            </Text>
          </View>

          {/* Provider cards */}
          <View className="flex-row gap-x-3 mb-6">
            {PROVIDERS.map(p => {
              const selected = p.id === selectedId;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => handleSelectProvider(p.id)}
                  activeOpacity={0.85}
                  disabled={isSaving || isSaved}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name}, ${p.model}`}
                  accessibilityState={{ selected }}
                  className={`flex-1 rounded-2xl border p-3 items-center ${
                    selected
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <Text className="text-2xl mb-1.5">{p.icon}</Text>
                  <Text
                    className={`text-sm font-bold ${
                      selected ? 'text-teal-700' : 'text-slate-900'
                    }`}
                  >
                    {p.name}
                  </Text>
                  <Text
                    className={`text-xs mt-0.5 text-center ${
                      selected ? 'text-teal-600' : 'text-slate-500'
                    }`}
                  >
                    {p.model}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* API key input */}
          <View className="mb-2">
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              {provider.name} API key
            </Text>
            <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-4">
              <TextInput
                value={isSaved ? `••••••••${savedLast4}` : apiKey}
                onChangeText={setApiKey}
                placeholder={provider.placeholder}
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showKey && !isSaved}
                editable={!isSaved && !isSaving}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                returnKeyType="done"
                onSubmitEditing={handleValidateAndSave}
                className="flex-1 py-3.5 text-base text-slate-900"
              />
              {!isSaved && (
                <TouchableOpacity
                  onPress={() => setShowKey(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={showKey ? 'Hide API key' : 'Show API key'}
                >
                  <Text className="text-lg">{showKey ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Key help link */}
          <TouchableOpacity
            onPress={handleOpenKeyHelp}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="link"
            accessibilityLabel="Where do I get my key?"
            className="self-start mb-4"
          >
            <Text className="text-teal-600 text-sm font-medium">Where do I get my key?</Text>
          </TouchableOpacity>

          {/* Error */}
          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <Text className="text-red-600 text-sm font-medium">{error}</Text>
            </View>
          ) : null}

          {/* Validate & Save */}
          <TouchableOpacity
            onPress={handleValidateAndSave}
            disabled={isSaving || isSaved}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Validate and save API key"
            className={`py-3.5 rounded-xl items-center justify-center ${
              isSaving || isSaved ? 'bg-teal-400' : 'bg-teal-600'
            }`}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold text-base">Validate &amp; Save</Text>
            )}
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity
            onPress={handleSkip}
            disabled={isSaving}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            className="items-center mt-4"
          >
            <Text className="text-slate-500 text-sm font-medium">Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
