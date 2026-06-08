import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { clearToken, clearApiKey } from '../../../src/lib/storage';
import { useAuthContext } from '../../../src/context/AuthContext';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
};

export default function SettingsTab() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { dbUser, syncUser } = useAuthContext();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Make sure the key status reflects the server even on a fresh app launch.
  useEffect(() => {
    if (!dbUser) syncUser();
  }, [dbUser, syncUser]);

  const hasApiKey = !!dbUser?.hasApiKey;
  const providerLabel = dbUser?.aiProvider ? PROVIDER_LABELS[dbUser.aiProvider] : null;

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      // End the Clerk session — the (app) layout guard redirects to /(auth)/login
      // automatically once isSignedIn flips to false.
      await signOut();
      // Best-effort cleanup of any locally cached secrets.
      await clearToken();
      await clearApiKey();
    } catch (error) {
      setIsSigningOut(false);
      Alert.alert('Sign out failed', 'Could not sign you out. Please try again.');
    }
  };

  return (
    <View className="flex-1 bg-slate-50 p-4 justify-between">
      <View>
        <Text className="text-2xl font-bold text-slate-800 mb-6">Settings</Text>
        
        <View className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <Text className="text-base font-semibold text-slate-800 mb-1">Medical Copilot v1.0.0</Text>
          <Text className="text-sm text-slate-500">Secure HIPAA-compliant clinical environment</Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(app)/byok' as Href)}
          className="bg-white rounded-xl border border-slate-200 p-4 flex-row justify-between items-center mb-4"
        >
          <View className="flex-1 pr-3">
            <Text className="text-sm font-semibold text-slate-700">API Credentials (BYOK)</Text>
            {hasApiKey ? (
              <View className="flex-row items-center mt-1">
                <View className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                <Text className="text-xs text-emerald-600 font-medium">
                  Key added{providerLabel ? ` · ${providerLabel}` : ''}
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center mt-1">
                <View className="w-2 h-2 rounded-full bg-slate-300 mr-2" />
                <Text className="text-xs text-slate-400 font-medium">No key added</Text>
              </View>
            )}
          </View>
          <Text className="text-slate-400">➔</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleLogout}
        disabled={isSigningOut}
        accessibilityRole="button"
        accessibilityLabel="Log out"
        className="w-full bg-red-50 border border-red-200 py-3.5 rounded-xl justify-center items-center mb-6"
      >
        {isSigningOut ? (
          <ActivityIndicator color="#dc2626" />
        ) : (
          <Text className="text-red-600 font-bold text-base">Log Out</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
