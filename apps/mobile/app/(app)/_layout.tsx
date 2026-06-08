import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useProfile } from '../../src/context/ProfileContext';

export default function AppLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { profiles, isLoading } = useProfile();
  const segments = useSegments();

  // Wait for Clerk to hydrate before deciding anything.
  if (!isLoaded) {
    return <LoadingScreen />;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  // Wait for the profile list before routing.
  if (isLoading) {
    return <LoadingScreen />;
  }

  // No profiles yet → force the user through profile creation, but don't loop
  // when we're already on that screen.
  const onCreateProfile = segments[segments.length - 1] === 'create-profile';
  if (profiles.length === 0 && !onCreateProfile) {
    return <Redirect href="/(app)/create-profile" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="byok" />
      <Stack.Screen name="create-profile" />
      <Stack.Screen name="consent" />
      <Stack.Screen name="share" />
    </Stack>
  );
}

function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <ActivityIndicator color="#059669" size="large" />
    </View>
  );
}
