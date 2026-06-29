import { FlaskConical, Pill, ScanLine, Receipt, FileText, LucideIcon } from 'lucide-react-native';

/** Document type → Lucide icon component. */
export const DOC_TYPE_ICONS: Record<string, LucideIcon> = {
  prescription: Pill,
  lab: FlaskConical,
  imaging: ScanLine,
  invoice: Receipt,
  other: FileText,
};

export function docTypeIcon(type: string): LucideIcon {
  return DOC_TYPE_ICONS[type] ?? FileText;
}
