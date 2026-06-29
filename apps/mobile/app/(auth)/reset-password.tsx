import React, { useState, useRef } from 'react';
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
import { Lock } from 'lucide-react-native';
import { shadows } from '../../src/theme/genki';

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
              <Lock size={30} color="#1A3D2B" />
            </View>
            <Text className="text-3xl font-extrabold text-genki-text tracking-tight">
              Reset password
            </Text>
            <Text className="text-sm text-genki-muted mt-2 text-center px-4">
              Enter the 6-digit code from your email and set a new password.
            </Text>
          </View>

          <View className="bg-white rounded-rl p-6" style={shadows.shS}>
            <Text className="text-xs font-semibold text-genki-muted uppercase tracking-wider mb-3">
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
                    borderColor: digits[index] ? '#2E7D52' : 'rgba(13,31,20,0.07)',
                    backgroundColor: digits[index] ? '#E4F0EA' : '#F1F5F2',
                    textAlign: 'center',
                    fontSize: 20,
                    fontWeight: '700',
                    color: '#0D1F14',
                  }}
                />
              ))}
            </View>

            <View className="mb-4">
              <Text className="text-xs font-semibold text-genki-muted uppercase tracking-wider mb-1.5">
                New password
              </Text>
              <View className="flex-row items-center bg-genki-bg border border-genki-border rounded-rs px-4">
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#8FA495"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
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

            <View className="mb-6">
              <Text className="text-xs font-semibold text-genki-muted uppercase tracking-wider mb-1.5">
                Confirm new password
              </Text>
              <View className="flex-row items-center bg-genki-bg border border-genki-border rounded-rs px-4">
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat new password"
                  placeholderTextColor="#8FA495"
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                  className="flex-1 py-3.5 text-base text-genki-text"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirm(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  <Text className="text-genki-faint text-sm font-medium">
                    {showConfirm ? 'Hide' : 'Show'}
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
              onPress={handleReset}
              disabled={isSubmitting}
              activeOpacity={0.85}
              className="bg-genki-g8 py-3.5 rounded-rm items-center justify-center"
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
