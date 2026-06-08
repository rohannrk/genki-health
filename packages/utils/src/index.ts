import { MedicalDocument } from '@medcopilot/types';

/**
 * Formats an ISO date string into a readable format: '12 Jan 2025'.
 * Uses UTC components to ensure formatting is consistent across different system timezones.
 * 
 * @param iso - The ISO date string to format (e.g. '2025-01-12T10:00:00Z' or '2025-01-12')
 * @returns The formatted date string, or the original input if it is invalid
 */
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

/**
 * Formats a file size in bytes to a human-readable string: '2.4 MB'.
 * 
 * @param bytes - The number of bytes to format
 * @returns The formatted file size string (e.g. '100 Bytes', '4.5 KB', '2.4 MB')
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i]}`;
}

/**
 * Masks a sensitive API key, showing only the prefix and the last four characters: 'sk-...ab3f'.
 * 
 * @param key - The secret API key string to mask
 * @returns The masked key, or '...' if the key is too short to mask safely
 */
export function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return '...';
  }
  const prefix = key.slice(0, 3);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Groups medical documents by their record month and year (e.g. 'January 2026').
 * 
 * @param docs - The array of medical documents to group
 * @returns A dictionary where keys are 'Month Year' and values are arrays of documents in that month
 */
export function groupByMonth(docs: MedicalDocument[]): Record<string, MedicalDocument[]> {
  const fullMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const groups: Record<string, MedicalDocument[]> = {};
  
  // Sort documents by date descending before grouping
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
