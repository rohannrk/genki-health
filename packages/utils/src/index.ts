import { MedicalDocument } from '@genki/types';

/** Uses UTC to avoid timezone drift. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    return iso;
  }
  const day = date.getUTCDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i]}`;
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return '...';
  }
  const prefix = key.slice(0, 3);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

export function groupByMonth(docs: MedicalDocument[]): Record<string, MedicalDocument[]> {
  const fullMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const groups: Record<string, MedicalDocument[]> = {};
  
  const sortedDocs = [...docs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  for (const doc of sortedDocs) {
    const date = new Date(doc.date);
    if (isNaN(date.getTime())) {
      const defaultGroup = 'Unknown Date';
      groups[defaultGroup] = groups[defaultGroup] || [];
      groups[defaultGroup].push(doc);
      continue;
    }
    const monthName = fullMonths[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const key = `${monthName} ${year}`;
    groups[key] = groups[key] || [];
    groups[key].push(doc);
  }
  
  return groups;
}
