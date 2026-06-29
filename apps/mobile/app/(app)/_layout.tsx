import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useProfile } from '../../src/context/ProfileContext';
import { hasSeenOnboarding } from '../../src/lib/storage';

export default function AppLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { hasProfile, isLoading } = useProfile();
  const segments = useSegments();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [seenOnboarding, setSeenOnboarding] = useState(false);

  useEffect(() => {
    hasSeenOnboarding().then((seen) => {
      setSeenOnboarding(seen);
      setOnboardingChecked(true);
    });
  }, []);

  if (!isLoaded || !onboardingChecked) {
    return <LoadingScreen />;
  }

  if (!isSignedIn) {
    return <Redirect href={seenOnboarding ? '/(auth)/login' : '/(auth)/onboarding'} />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  const onCreateProfile = segments[segments.length - 1] === 'create-profile';
  if (!hasProfile && !onCreateProfile) {
    return <Redirect href="/(app)/create-profile" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="byok" />
      <Stack.Screen name="create-profile" />
      <Stack.Screen name="upload" options={{ presentation: 'modal' }} />
      <Stack.Screen name="document/[id]" />
      <Stack.Screen name="biomarker/[id]" />
      <Stack.Screen name="consent" />
      <Stack.Screen name="share" />
    </Stack>
  );
}

function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-genki-bg">
      <ActivityIndicator color="#1A3D2B" size="large" />
    </View>
  );
}
