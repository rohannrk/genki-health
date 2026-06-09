import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { clearToken, clearApiKey } from '../../../src/lib/storage';
import { useProfile } from '../../../src/context/ProfileContext';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
};

export default function SettingsTab() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { profiles, activeProfile, setActiveProfile, deleteProfile } = useProfile();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openKeyEditor = (profileId: string) =>
    router.push(`/(app)/byok?profileId=${profileId}` as Href);

  const handleDeleteProfile = (id: string, name: string) => {
    if (profiles.length <= 1) {
      Alert.alert(
        'Can’t delete',
        'You need at least one family member. Add another profile before deleting this one.'
      );
      return;
    }
    Alert.alert(
      `Delete ${name}?`,
      'This permanently removes this family member and all of their documents. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(id);
            try {
              await deleteProfile(id);
            } catch (err: any) {
              Alert.alert('Delete failed', err?.message ?? 'Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

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
    <View className="flex-1 bg-slate-50">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <Text className="text-base font-semibold text-slate-800 mb-1">Medical Copilot v1.0.0</Text>
          <Text className="text-sm text-slate-500">Secure HIPAA-compliant clinical environment</Text>
        </View>

        {/* Family Members — switch active, manage each member's AI key, delete */}
        <View className="flex-row justify-between items-center mb-2 px-1">
          <Text className="text-sm font-semibold text-slate-700">Family Members</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/create-profile' as Href)}>
            <Text className="text-emerald-600 font-semibold text-sm">+ Add</Text>
          </TouchableOpacity>
        </View>

        {profiles.length === 0 ? (
          <View className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <Text className="text-xs text-slate-400">No family members yet.</Text>
          </View>
        ) : (
          profiles.map((p) => {
            const isActive = activeProfile?.id === p.id;
            const providerLabel = p.aiProvider ? PROVIDER_LABELS[p.aiProvider] : null;
            return (
              <View
                key={p.id}
                className={`bg-white rounded-xl border p-4 mb-3 ${
                  isActive ? 'border-emerald-400' : 'border-slate-200'
                }`}
              >
                {/* Row: name + switch */}
                <TouchableOpacity
                  onPress={() => setActiveProfile(p)}
                  activeOpacity={0.7}
                  className="flex-row items-center justify-between"
                >
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center">
                      <Text className="text-base font-semibold text-slate-800">{p.name}</Text>
                      {isActive && (
                        <View className="ml-2 px-2 py-0.5 rounded-full bg-emerald-100">
                          <Text className="text-[10px] font-bold text-emerald-700">ACTIVE</Text>
                        </View>
                      )}
                    </View>
                    {p.relation ? (
                      <Text className="text-xs text-slate-400 capitalize mt-0.5">{p.relation}</Text>
                    ) : null}
                  </View>
                  {!isActive && (
                    <Text className="text-emerald-600 text-xs font-semibold">Switch</Text>
                  )}
                </TouchableOpacity>

                {/* Key status */}
                <View className="flex-row items-center mt-3">
                  <View
                    className={`w-2 h-2 rounded-full mr-2 ${
                      p.hasApiKey ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                  <Text
                    className={`text-xs font-medium ${
                      p.hasApiKey ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {p.hasApiKey
                      ? `AI key added${providerLabel ? ` · ${providerLabel}` : ''}`
                      : 'No AI key'}
                  </Text>
                </View>

                {/* Actions */}
                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    onPress={() => openKeyEditor(p.id)}
                    className="flex-1 py-2 rounded-lg border border-slate-200 items-center"
                  >
                    <Text className="text-slate-700 text-xs font-semibold">
                      {p.hasApiKey ? 'Update AI key' : 'Add AI key'}
                    </Text>
                  </TouchableOpacity>
                  {deletingId === p.id ? (
                    <View className="px-4 justify-center">
                      <ActivityIndicator size="small" color="#dc2626" />
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleDeleteProfile(p.id, p.name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${p.name}`}
                      className="px-4 py-2 rounded-lg bg-red-50 border border-red-100 items-center"
                    >
                      <Text className="text-red-600 text-xs font-semibold">Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}

        <View className="flex-row justify-between items-center mb-2 mt-4 px-1">
          <Text className="text-sm font-semibold text-slate-700">Privacy &amp; Sharing</Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(app)/consent' as Href)}
          className="bg-white rounded-xl border border-slate-200 p-4 flex-row justify-between items-center mb-4"
        >
          <View className="flex-1 pr-3">
            <Text className="text-sm font-semibold text-slate-700">Consent &amp; Privacy</Text>
            <Text className="text-xs text-slate-400 font-medium mt-1">
              AI opt-in, data deletion, activity log
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(app)/share' as Href)}
          className="bg-white rounded-xl border border-slate-200 p-4 flex-row justify-between items-center mb-4"
        >
          <View className="flex-1 pr-3">
            <Text className="text-sm font-semibold text-slate-700">Share Records</Text>
            <Text className="text-xs text-slate-400 font-medium mt-1">
              Time-limited, view-only links &amp; PDF export
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLogout}
          disabled={isSigningOut}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          className="w-full bg-red-50 border border-red-200 py-3.5 rounded-xl justify-center items-center mt-2"
        >
          {isSigningOut ? (
            <ActivityIndicator color="#dc2626" />
          ) : (
            <Text className="text-red-600 font-bold text-base">Log Out</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
