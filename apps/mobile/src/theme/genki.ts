import { Platform, ViewStyle } from 'react-native';

/**
 * Genki design tokens — single source of truth for values that must be applied
 * via inline `style` (RN shadows can't be expressed as NativeWind classes, and
 * status-/type-driven colors are computed at runtime). The same palette is
 * mirrored in tailwind.config.js as the `genki-*` and `tag-*` color utilities
 * for use in `className` strings.
 */
export const colors = {
  g9: '#0F2A1D',
  g8: '#1A3D2B', // primary brand green — buttons, FAB, nav active, avatars
  g7: '#1F5236',
  g5: '#2E7D52', // positive trends, success text, citations
  g3: '#7BBF9A',
  gt: '#E4F0EA', // chip-selected bg, success ring, extracted-card bg
  gtt: '#F0F7F3', // upload-zone / suggestion-chip bg
  bg: '#F1F5F2', // app background
  white: '#FFFFFF',
  text: '#0D1F14',
  muted: '#5C6D63',
  faint: '#8FA495',
  border: 'rgba(13,31,20,0.07)',
} as const;

/** Status colors used for badges, dots, and trends. */
export const status = {
  okBg: '#E4F0EA',
  okFg: '#1A3D2B',
  warnBg: '#FEF3CD',
  warnFg: '#C47E1A',
  badBg: '#FDECEA',
  badFg: '#C0392B',
  eduBg: '#FEF9EC',
  eduFg: '#7A5010',
  eduIcon: '#C47E1A',
} as const;

/** Document-type tag colors (bg / fg). */
export const tags = {
  lab: { bg: '#EDF5FB', fg: '#185FA5' },
  prescription: { bg: '#FEF3CD', fg: '#7A5010' },
  imaging: { bg: '#E4F0EA', fg: '#1A3D2B' },
  invoice: { bg: '#FAF3E0', fg: '#8B6914' },
  discharge: { bg: '#F3EDFB', fg: '#534AB7' },
  other: { bg: '#E4F0EA', fg: '#1A3D2B' },
} as const;

export function tagColor(docType: string): { bg: string; fg: string } {
  return (tags as Record<string, { bg: string; fg: string }>)[docType] ?? tags.other;
}

/** Document processing status → badge colors (bg / fg). */
export function statusColor(s: string): { bg: string; fg: string } {
  switch (s) {
    case 'ready':
      return { bg: status.okBg, fg: status.okFg };
    case 'processing':
    case 'uploading':
      return { bg: status.warnBg, fg: status.warnFg };
    case 'error':
      return { bg: status.badBg, fg: status.badFg };
    default:
      return { bg: colors.gtt, fg: colors.muted };
  }
}

const shadow = (
  offsetY: number,
  radius: number,
  opacity: number,
  elevation: number,
  shadowColor: string = '#0D1F14'
): ViewStyle => ({
  shadowColor,
  shadowOffset: { width: 0, height: offsetY },
  shadowOpacity: Platform.OS === 'android' ? 0 : opacity,
  shadowRadius: radius,
  elevation,
});

/**
 * Shadow presets. Cards float on these instead of borders (per the handoff).
 * Values approximate the layered CSS shadows from the design tokens.
 */
export const shadows = {
  shS: shadow(2, 8, 0.08, 2),
  shM: shadow(4, 16, 0.1, 5),
  shL: shadow(8, 24, 0.14, 10),
  greenBtn: shadow(4, 14, 0.3, 6, colors.g8),
  fab: shadow(4, 14, 0.4, 8, colors.g8),
} as const;

export const radius = { rs: 10, rm: 14, rl: 18, rxl: 24 } as const;
