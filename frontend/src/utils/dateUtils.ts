// src/utils/dateUtils.ts

/**
 * Converteert een ISO timestamp (UTC) naar het formaat dat <input type="datetime-local"> verwacht (YYYY-MM-DDTHH:mm) in LOKALE tijd.
 */
export const isoToLocalDatetime = (isoStr?: string | null): string => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
};

/**
 * Converteert de waarde uit <input type="datetime-local"> (lokale tijd) naar een ISO 8601 UTC-string.
 */
export const localDatetimeToIso = (localStr: string): string | undefined => {
  if (!localStr) return undefined;
  const d = new Date(localStr);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
};

/**
 * Formatteert een ISO timestamp naar een goed leesbare lokale datum- en tijdsweergave voor tabellen/labels.
 */
export const formatDisplayDateTime = (isoStr?: string | null): string => {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};