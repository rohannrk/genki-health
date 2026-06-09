import { Ionicons } from '@expo/vector-icons';

export const DOC_TYPE_ICON_NAMES: Record<string, keyof typeof Ionicons.glyphMap> = {
  prescription: 'medkit-outline',
  lab: 'flask-outline',
  imaging: 'scan-outline',
  invoice: 'receipt-outline',
  other: 'document-text-outline',
};
