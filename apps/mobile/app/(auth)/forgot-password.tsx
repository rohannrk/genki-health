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
import { KeyRound, ArrowLeft } from 'lucide-react-native';
import { shadows } from '../../src/theme/genki';

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
      className="flex-1 bg-genki-bg"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center px-6 py-12">
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-genki-gt items-center justify-center mb-4">
              <KeyRound size={30} color="#1A3D2B" />
            </View>
            <Text className="text-3xl font-extrabold text-genki-text tracking-tight">
              Forgot password?
            </Text>
            <Text className="text-sm text-genki-muted mt-2 text-center px-4">
              Enter your email and we'll send you a reset code.
            </Text>
          </View>

          <View className="bg-white rounded-rl p-6" style={shadows.shS}>
            <View className="mb-6">
              <Text className="text-xs font-semibold text-genki-muted uppercase tracking-wider mb-1.5">
                Email address
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="doctor@clinic.com"
                placeholderTextColor="#8FA495"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSendReset}
                editable={!sent}
                className="bg-genki-bg border border-genki-border rounded-rs px-4 py-3.5 text-base text-genki-text"
              />
            </View>

            {error ? (
              <View className="bg-[#FDECEA] rounded-rm px-4 py-3 mb-4">
                <Text className="text-[#C0392B] text-sm font-medium">{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleSendReset}
              disabled={isSubmitting || sent}
              activeOpacity={0.85}
              className="bg-genki-g8 py-3.5 rounded-rm items-center justify-center"
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
                <ArrowLeft size={14} color="#1A3D2B" />
                <Text className="text-sm font-semibold text-genki-g5">Back to sign in</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
