import React, { useState, useRef, useEffect } from 'react';
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

const CODE_LENGTH = 6;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const code = digits.join('');

  const handleDigitChange = (value: string, index: number) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    if (sanitized.length > 1) {
      const pasted = sanitized.slice(0, CODE_LENGTH).split('');
      const newDigits = [...digits];
      pasted.forEach((char, i) => {
        if (index + i < CODE_LENGTH) newDigits[index + i] = char;
      });
      setDigits(newDigits);
      const nextIndex = Math.min(index + pasted.length, CODE_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }
    const newDigits = [...digits];
    newDigits[index] = sanitized;
    setDigits(newDigits);
    if (sanitized && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleReset = async () => {
    if (!isLoaded || !signIn) return;

    if (code.length < CODE_LENGTH) {
      setError('Please enter the full 6-digit code.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password: newPassword,
      });
      await setActive({ session: result.createdSessionId });
      router.replace('/(app)/(tabs)');
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ??
        err?.errors?.[0]?.message ??
        'Reset failed. Please try again.';
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
              <Ionicons name="lock-closed-outline" size={30} color="#334155" />
            </View>
            <Text className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Reset password
            </Text>
            <Text className="text-sm text-slate-500 mt-2 text-center px-4">
              Enter the 6-digit code from your email and set a new password.
            </Text>
          </View>

          <View className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Reset code
            </Text>
            <View className="flex-row justify-between mb-6">
              {Array.from({ length: CODE_LENGTH }).map((_, index) => (
                <TextInput
                  key={index}
                  ref={ref => {
                    inputRefs.current[index] = ref;
                  }}
                  value={digits[index]}
                  onChangeText={value => handleDigitChange(value, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={CODE_LENGTH}
                  selectTextOnFocus
                  editable={!isSubmitting}
                  accessibilityLabel={`Code digit ${index + 1}`}
                  style={{
                    width: 44,
                    height: 52,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: digits[index] ? '#10b981' : '#e2e8f0',
                    backgroundColor: digits[index] ? '#f0fdf4' : '#f8fafc',
                    textAlign: 'center',
                    fontSize: 20,
                    fontWeight: '700',
                    color: '#0f172a',
                  }}
                />
              ))}
            </View>

            <View className="mb-4">
              <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                New password
              </Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4">
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  className="flex-1 py-3.5 text-base text-slate-900"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text className="text-slate-400 text-sm font-medium">
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="mb-6">
              <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Confirm new password
              </Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4">
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat new password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                  className="flex-1 py-3.5 text-base text-slate-900"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirm(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  <Text className="text-slate-400 text-sm font-medium">
                    {showConfirm ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <Text className="text-red-600 text-sm font-medium">{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleReset}
              disabled={isSubmitting}
              activeOpacity={0.85}
              className="bg-emerald-600 py-3.5 rounded-xl items-center justify-center"
              accessibilityLabel="Set new password"
              accessibilityRole="button"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-base">Set new password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
