import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'medcopilot_auth_token';
const API_KEY_KEY = 'medcopilot_api_key';

/**
 * Saves the authentication token in secure storage.
 */
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

/**
 * Retrieves the authentication token from secure storage.
 */
export async function getToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

/**
 * Deletes the authentication token from secure storage.
 */
export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

/**
 * Saves the user's custom API key (e.g. OpenAI / Claude key) securely.
 */
export async function setApiKey(apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(API_KEY_KEY, apiKey);
}

/**
 * Retrieves the user's custom API key securely.
 */
export async function getApiKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(API_KEY_KEY);
}

/**
 * Deletes the user's custom API key from secure storage.
 */
export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(API_KEY_KEY);
}
