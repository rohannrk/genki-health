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
import { Activity } from 'lucide-react-native';
import { useAuthContext } from '../../src/context/AuthContext';
import { shadows } from '../../src/theme/genki';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { syncUser } = useAuthContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    if (!isLoaded || !signIn) return;
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await signIn.create({
        identifier: email.trim().toLowerCase(),
        password,
      });

      await setActive({ session: result.createdSessionId });
      await syncUser();
      router.replace('/(app)/(tabs)');
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ??
        err?.errors?.[0]?.message ??
        'Sign in failed. Please try again.';
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
            <View className="w-16 h-16 rounded-2xl bg-genki-g8 items-center justify-center mb-4">
              <Activity size={30} color="#ffffff" />
            </View>
            <Text className="text-3xl font-extrabold text-genki-text tracking-tight">
              Genki
            </Text>
            <Text className="text-sm text-genki-muted mt-1">Secure Clinical Records & Assistant</Text>
          </View>

          <View className="bg-white rounded-rl p-6" style={shadows.shS}>
            <Text className="text-xl font-bold text-genki-text mb-6">Welcome back</Text>

            <View className="mb-4">
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
                returnKeyType="next"
                className="bg-genki-bg border border-genki-border rounded-rs px-4 py-3.5 text-base text-genki-text"
              />
            </View>

            <View className="mb-6">
              <Text className="text-xs font-semibold text-genki-muted uppercase tracking-wider mb-1.5">
                Password
              </Text>
              <View className="flex-row items-center bg-genki-bg border border-genki-border rounded-rs px-4">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#8FA495"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                  className="flex-1 py-3.5 text-base text-genki-text"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text className="text-genki-faint text-sm font-medium">
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View className="bg-[#FDECEA] rounded-rm px-4 py-3 mb-4">
                <Text className="text-[#C0392B] text-sm font-medium">{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleSignIn}
              disabled={isSubmitting}
              activeOpacity={0.85}
              className="bg-genki-g8 py-3.5 rounded-rm items-center justify-center"
              accessibilityLabel="Sign in"
              accessibilityRole="button"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-base">Sign in</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              className="items-center mt-4"
              accessibilityLabel="Forgot password"
            >
              <Text className="text-sm text-genki-g5 font-semibold">Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-center mt-6">
            <Text className="text-genki-muted text-sm">Don't have an account? </Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/signup')}
              accessibilityLabel="Sign up"
            >
              <Text className="text-sm font-bold text-genki-text">Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
