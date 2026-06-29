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
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Cpu, Lightbulb, Zap, Eye, EyeOff, LucideIcon } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { useProfile } from '../../src/context/ProfileContext';
import { colors, shadows } from '../../src/theme/genki';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://api.genki.in';

type ProviderId = 'openai' | 'anthropic' | 'gemini';

type Provider = {
  id: ProviderId;
  name: string;
  model: string;
  icon: LucideIcon;
  placeholder: string;
  keyUrl: string;
};

const PROVIDERS: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    model: 'GPT-4o',
    icon: Cpu,
    placeholder: 'sk-proj-...',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    model: 'Claude Sonnet',
    icon: Lightbulb,
    placeholder: 'sk-ant-...',
    keyUrl: 'https://console.anthropic.com/keys',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    model: 'Gemini 3.5 Flash',
    icon: Zap,
    placeholder: 'AIza...',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
];

export default function ByokScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { refreshMe } = useProfile();

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

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

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

      const saveRes = await fetch(`${API_BASE}/api/v1/keys/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider: selectedId, apiKey: trimmedKey }),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        setError(data.reason || data.error || 'Could not save your API key. Please try again.');
        return;
      }

      setSavedLast4(trimmedKey.slice(-4));
      setApiKey('');
      await refreshMe();
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
      className="flex-1 bg-genki-bg"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center px-6 py-12">
          <View className="mb-8">
            <Text className="text-3xl font-extrabold text-genki-text tracking-tight">
              Connect AI
            </Text>
            <Text className="text-sm text-genki-muted mt-2 leading-5">
              Add your own AI key. Your records are processed using this key — we never see your data.
            </Text>
          </View>

          <View className="flex-row gap-x-3 mb-6">
            {PROVIDERS.map(p => {
              const selected = p.id === selectedId;
              const ProviderIcon = p.icon;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => handleSelectProvider(p.id)}
                  activeOpacity={0.85}
                  disabled={isSaving || isSaved}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name}, ${p.model}`}
                  accessibilityState={{ selected }}
                  className={`flex-1 rounded-rl border p-3 items-center ${
                    selected
                      ? 'border-genki-g8 bg-genki-gt'
                      : 'border-genki-border bg-white'
                  }`}
                  style={selected ? undefined : shadows.shS}
                >
                  <ProviderIcon
                    size={26}
                    color={selected ? colors.g8 : colors.muted}
                    style={{ marginBottom: 6 }}
                  />
                  <Text
                    className={`text-sm font-bold ${
                      selected ? 'text-genki-g8' : 'text-genki-text'
                    }`}
                  >
                    {p.name}
                  </Text>
                  <Text
                    className={`text-xs mt-0.5 text-center ${
                      selected ? 'text-genki-g5' : 'text-genki-muted'
                    }`}
                  >
                    {p.model}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View className="mb-2">
            <Text className="text-xs font-semibold text-genki-muted uppercase tracking-wider mb-1.5">
              {provider.name} API key
            </Text>
            <View className="flex-row items-center bg-white border border-genki-border rounded-rs px-4" style={shadows.shS}>
              <TextInput
                value={isSaved ? `••••••••${savedLast4}` : apiKey}
                onChangeText={setApiKey}
                placeholder={provider.placeholder}
                placeholderTextColor="#8FA495"
                secureTextEntry={!showKey && !isSaved}
                editable={!isSaved && !isSaving}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                returnKeyType="done"
                onSubmitEditing={handleValidateAndSave}
                className="flex-1 py-3.5 text-base text-genki-text"
              />
              {!isSaved && (
                <TouchableOpacity
                  onPress={() => setShowKey(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={showKey ? 'Hide API key' : 'Show API key'}
                >
                  {showKey
                    ? <EyeOff size={20} color={colors.faint} />
                    : <Eye size={20} color={colors.faint} />
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            onPress={handleOpenKeyHelp}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="link"
            accessibilityLabel="Where do I get my key?"
            className="self-start mb-4"
          >
            <Text className="text-genki-g5 text-sm font-medium">Where do I get my key?</Text>
          </TouchableOpacity>

          {error ? (
            <View className="bg-[#FDECEA] rounded-rm px-4 py-3 mb-4">
              <Text className="text-[#C0392B] text-sm font-medium">{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleValidateAndSave}
            disabled={isSaving || isSaved}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Validate and save API key"
            className={`py-3.5 rounded-rm items-center justify-center ${
              isSaving || isSaved ? 'bg-genki-g5' : 'bg-genki-g8'
            }`}
            style={isSaving || isSaved ? undefined : shadows.greenBtn}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold text-base">Validate &amp; Save</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSkip}
            disabled={isSaving}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            className="items-center mt-4"
          >
            <Text className="text-genki-muted text-sm font-medium">Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
