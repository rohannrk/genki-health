import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.medcopilot.in';

  return {
    ...config,
    name: 'Medical Copilot',
    slug: 'medical-copilot',
    version: '1.0.0',
    orientation: 'portrait',
    // icon: './assets/images/icon.png',
    scheme: 'medcopilot',
    userInterfaceStyle: 'automatic',
    platforms: ['ios', 'android'],
    splash: {
      // image: './assets/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.medcopilot.app',
    },
    android: {
      package: 'com.medcopilot.app',
      adaptiveIcon: {
        // foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
    },
    web: {
      bundler: 'metro',
      // favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-camera',
      'expo-document-picker',
      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow Medical Copilot to access your photos to set a profile avatar.',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      apiUrl,
    },
  };
};
