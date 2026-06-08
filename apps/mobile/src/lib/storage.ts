import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'medcopilot_auth_token';
const API_KEY_KEY = 'medcopilot_api_key';
const ONBOARDING_SEEN_KEY = 'medcopilot_onboarding_seen';

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(API_KEY_KEY);
}

export async function hasSeenOnboarding(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(ONBOARDING_SEEN_KEY);
  return value === 'true';
}

export async function markOnboardingSeen(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_SEEN_KEY, 'true');
}
