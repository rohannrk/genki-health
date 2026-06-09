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
import { useSignIn } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { signIn, isLoaded } = useSignIn();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSendReset = async () => {
    if (!isLoaded || !signIn) return;
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim().toLowerCase(),
      });
      setSent(true);
      router.push('/(auth)/reset-password');
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ??
        err?.errors?.[0]?.message ??
        'Could not send reset link. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
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
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-slate-200 items-center justify-center mb-4">
              <Ionicons name="key-outline" size={30} color="#334155" />
            </View>
            <Text className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Forgot password?
            </Text>
            <Text className="text-sm text-slate-500 mt-2 text-center px-4">
              Enter your email and we'll send you a reset code.
            </Text>
          </View>

          <View className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <View className="mb-6">
              <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Email address
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="doctor@clinic.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSendReset}
                editable={!sent}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900"
              />
            </View>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <Text className="text-red-600 text-sm font-medium">{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleSendReset}
              disabled={isSubmitting || sent}
              activeOpacity={0.85}
              className="bg-emerald-600 py-3.5 rounded-xl items-center justify-center"
              accessibilityLabel="Send reset link"
              accessibilityRole="button"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-base">Send reset link</Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-center mt-6">
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityLabel="Back to sign in"
            >
              <View className="flex-row items-center gap-1">
                <Ionicons name="arrow-back" size={14} color="#059669" />
                <Text className="text-sm font-semibold text-emerald-600">Back to sign in</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
