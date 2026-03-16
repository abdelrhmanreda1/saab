import { Timestamp } from 'firebase/firestore';
import { defaultSettings } from '@/lib/firestore/settings';

type DateInput =
  | Date
  | Timestamp
  | { seconds: number; nanoseconds?: number }
  | string
  | number
  | null
  | undefined;

interface FormatOptions {
  dateFormat?: string; // 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD'
  timeFormat?: string; // '12 Hour' | '24 Hour'
  timezone?: string; // IANA timezone, e.g. 'Asia/Karachi'
  includeTime?: boolean;
  fallback?: string;
}

const toDate = (input: DateInput): Date | null => {
  if (!input) return null;
  if (input instanceof Date) return input;
  // Firestore Timestamp
  if (input instanceof Timestamp) return input.toDate();
  // Plain timestamp-like object
  if (typeof input === 'object' && 'seconds' in input) {
    const seconds = Number(input.seconds) || 0;
    const nanos = Number((input as { nanoseconds?: number }).nanoseconds) || 0;
    return new Date(seconds * 1000 + nanos / 1_000_000);
  }
  // String or number
  const d = new Date(input as string | number);
  return isNaN(d.getTime()) ? null : d;
};

const getZonedDate = (date: Date, timezone: string): Date => {
  try {
    // Convert to the given timezone by formatting and re-parsing
    const locale = 'en-US';
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .reduce<Record<string, string>>((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
      }, {});

    const year = Number(parts.year);
    const month = Number(parts.month) - 1;
    const day = Number(parts.day);
    const hour = Number(parts.hour || 0);
    const minute = Number(parts.minute || 0);
    const second = Number(parts.second || 0);

    return new Date(year, month, day, hour, minute, second);
  } catch {
    return date;
  }
};

const formatDatePart = (date: Date, format: string): string => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());

  switch (format) {
    case 'MM-DD-YYYY':
      return `${mm}-${dd}-${yyyy}`;
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`;
    case 'DD-MM-YYYY':
    default:
      return `${dd}-${mm}-${yyyy}`;
  }
};

const formatTimePart = (date: Date, timeFormat: string): string => {
  if (timeFormat === '24 Hour') {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // 12-hour format
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
};

export const formatDateTime = (
  input: DateInput,
  options: FormatOptions = {}
): string => {
  const date = toDate(input);
  if (!date) return options.fallback ?? '';

  const site = defaultSettings.site;
  const dateFormat = options.dateFormat || site.dateFormat || 'DD-MM-YYYY';
  const timeFormat = options.timeFormat || site.timeFormat || '12 Hour';
  const timezone = options.timezone || site.timezone || 'UTC';

  const zoned = getZonedDate(date, timezone);
  const dateStr = formatDatePart(zoned, dateFormat);

  if (!options.includeTime) {
    return dateStr;
  }

  const timeStr = formatTimePart(zoned, timeFormat);
  return `${dateStr} ${timeStr}`;
};

export const formatDateOnly = (input: DateInput, options?: Omit<FormatOptions, 'includeTime'>) =>
  formatDateTime(input, { ...(options || {}), includeTime: false });

export const formatTimeOnly = (input: DateInput, options?: Omit<FormatOptions, 'includeTime'>) =>
  formatDateTime(input, { ...(options || {}), includeTime: true, dateFormat: 'YYYY-MM-DD' });


