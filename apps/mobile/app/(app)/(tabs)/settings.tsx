import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { clearToken, clearApiKey } from '../../../src/lib/storage';
import { useProfile } from '../../../src/context/ProfileContext';
import { colors, shadows } from '../../../src/theme/genki';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
};

export default function SettingsTab() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { me } = useProfile();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const openKeyEditor = () => router.push('/(app)/byok' as Href);

  const providerLabel = me?.aiProvider ? PROVIDER_LABELS[me.aiProvider] : null;

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      await clearToken();
      await clearApiKey();
    } catch (error) {
      setIsSigningOut(false);
      Alert.alert('Sign out failed', 'Could not sign you out. Please try again.');
    }
  };

  return (
    <View className="flex-1 bg-genki-bg">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View className="bg-white rounded-rm p-4 mb-4" style={shadows.shS}>
          <Text className="text-base font-semibold text-genki-text mb-1">Genki v1.0.0</Text>
          <Text className="text-sm text-genki-muted">Secure HIPAA-compliant clinical environment</Text>
        </View>

        <View className="flex-row justify-between items-center mb-2 px-1">
          <Text className="text-sm font-semibold text-genki-text">About you</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/create-profile' as Href)}>
            <Text className="text-genki-g8 font-semibold text-sm">Edit</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-rm p-4 mb-3" style={shadows.shS}>
          <Text className="text-base font-semibold text-genki-text">{me?.name ?? 'You'}</Text>
          {me?.dob ? (
            <Text className="text-xs text-genki-muted mt-0.5">Born {me.dob}</Text>
          ) : null}

          <View className="flex-row items-center mt-3">
            <View
              className="w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: me?.hasApiKey ? colors.g5 : colors.faint }}
            />
            <Text
              className={`text-xs font-medium ${
                me?.hasApiKey ? 'text-genki-g5' : 'text-genki-faint'
              }`}
            >
              {me?.hasApiKey
                ? `AI key added${providerLabel ? ` · ${providerLabel}` : ''}`
                : 'No AI key'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={openKeyEditor}
            className="mt-3 py-2 rounded-rs bg-white border border-genki-border items-center"
          >
            <Text className="text-genki-text text-xs font-semibold">
              {me?.hasApiKey ? 'Update AI key' : 'Add AI key'}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-between items-center mb-2 mt-4 px-1">
          <Text className="text-sm font-semibold text-genki-text">Privacy &amp; Sharing</Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(app)/consent' as Href)}
          className="bg-white rounded-rm p-4 flex-row justify-between items-center mb-4"
          style={shadows.shS}
        >
          <View className="flex-1 pr-3">
            <Text className="text-sm font-semibold text-genki-text">Consent &amp; Privacy</Text>
            <Text className="text-xs text-genki-muted font-medium mt-1">
              AI opt-in, data deletion, activity log
            </Text>
          </View>
          <ChevronRight size={16} color={colors.faint} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(app)/share' as Href)}
          className="bg-white rounded-rm p-4 flex-row justify-between items-center mb-4"
          style={shadows.shS}
        >
          <View className="flex-1 pr-3">
            <Text className="text-sm font-semibold text-genki-text">Share Records</Text>
            <Text className="text-xs text-genki-muted font-medium mt-1">
              Time-limited, view-only links &amp; PDF export
            </Text>
          </View>
          <ChevronRight size={16} color={colors.faint} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLogout}
          disabled={isSigningOut}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          className="w-full bg-[#FDECEA] py-3.5 rounded-rm justify-center items-center mt-2"
        >
          {isSigningOut ? (
            <ActivityIndicator color="#C0392B" />
          ) : (
            <Text className="text-[#C0392B] font-bold text-base">Log Out</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
