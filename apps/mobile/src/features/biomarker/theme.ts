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

export const INK = '#0D1F14'; // genki text
export const MUTED = '#8FA495'; // genki faint
