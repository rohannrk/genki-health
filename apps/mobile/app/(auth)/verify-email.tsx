import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSignUp } from '@clerk/clerk-expo';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { useAuthContext } from '../../src/context/AuthContext';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECS = 30;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp, setActive, isLoaded } = useSignUp();
  const { syncUser } = useAuthContext();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/signup');
    }
  };

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const email = signUp?.emailAddress ?? '';

  // Auto-submit when all digits filled
  useEffect(() => {
    if (digits.every(d => d.length === 1)) {
      handleVerify(digits.join(''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

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
    if (key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleVerify = useCallback(
    async (code: string) => {
      if (!isLoaded || !signUp || isSubmitting) return;
      setError('');
      setIsSubmitting(true);
      try {
        const result = await signUp.attemptEmailAddressVerification({ code });
        await setActive({ session: result.createdSessionId });
        await syncUser();
        router.replace('/(app)/create-profile' as Href);
      } catch (err: any) {
        const msg =
          err?.errors?.[0]?.longMessage ??
          err?.errors?.[0]?.message ??
          'Invalid code. Please try again.';
        setError(msg);
        setDigits(Array(CODE_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      } finally {
        setIsSubmitting(false);
      }
    },
    [isLoaded, signUp, setActive, syncUser, router, isSubmitting]
  );

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECS);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (!isLoaded || !signUp || cooldown > 0) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      startCooldown();
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message ?? 'Could not resend code.';
      setError(msg);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-genki-bg"
    >
      <TouchableOpacity
        onPress={handleBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityLabel="Go back"
        accessibilityRole="button"
        style={{ position: 'absolute', top: insets.top + 8, left: 16, zIndex: 10 }}
        className="w-10 h-10 rounded-full bg-white border border-genki-border items-center justify-center"
      >
        <ArrowLeft size={20} color="#1A3D2B" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center px-6 py-12">
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-genki-g8 items-center justify-center mb-4">
              <Mail size={30} color="#ffffff" />
            </View>
            <Text className="text-3xl font-extrabold text-genki-text tracking-tight">
              Check your email
            </Text>
            <Text className="text-sm text-genki-muted mt-2 text-center px-4">
              We sent a 6-digit code to{'\n'}
              <Text className="font-semibold text-genki-text">{email}</Text>
            </Text>
          </View>

          <View className="flex-row justify-center gap-x-3 mb-8">
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
                accessibilityLabel={`Digit ${index + 1} of ${CODE_LENGTH}`}
                style={{
                  width: 46,
                  height: 56,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: digits[index] ? '#2E7D52' : 'rgba(13,31,20,0.07)',
                  backgroundColor: digits[index] ? '#E4F0EA' : '#F1F5F2',
                  textAlign: 'center',
                  fontSize: 22,
                  fontWeight: '700',
                  color: '#0D1F14',
                }}
              />
            ))}
          </View>

          {error ? (
            <View className="bg-[#FDECEA] rounded-rm px-4 py-3 mb-4 mx-0">
              <Text className="text-[#C0392B] text-sm font-medium text-center">{error}</Text>
            </View>
          ) : null}

          {isSubmitting && (
            <View className="items-center mb-4">
              <ActivityIndicator color="#2E7D52" />
              <Text className="text-genki-muted text-sm mt-2">Verifying…</Text>
            </View>
          )}

          <View className="items-center mt-2">
            {cooldown > 0 ? (
              <Text className="text-genki-faint text-sm">
                Resend code in{' '}
                <Text className="font-semibold text-genki-muted">{cooldown}s</Text>
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResend}
                accessibilityLabel="Resend verification code"
              >
                <Text className="text-genki-g5 font-semibold text-sm">Resend code</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
