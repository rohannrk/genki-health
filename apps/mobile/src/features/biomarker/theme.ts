import { Platform } from 'react-native';

/**
 * Platform serif for display typography (titles + numerics).
 * iOS has Georgia/New York; Android falls back to its serif; web uses Georgia.
 * Applied via inline `style` because NativeWind v4's web compiler drops the
 * `font-serif` utility when combined with arbitrary font sizes.
 */
export const SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
}) as string;

export const INK = '#0f172a'; // slate-900
export const MUTED = '#94a3b8'; // slate-400
