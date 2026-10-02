import type { DisplayEvent, EventCategory } from './model';

export type NotebookLink = { id: string; profileId: number; notebookKey: string; subject: string; title: string; url: string };
export type LessonTask = { id: string; profileId: number; sourceId: string; eventKey: string; title: string; completed: number; eventTitle: string; due: number };
export const EVENT_CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: 'lesson', label: 'Óra' }, { value: 'event', label: 'Egyéb esemény' },
  { value: 'assignment', label: 'Beadandó' }, { value: 'test', label: 'ZH' }, { value: 'exam', label: 'Vizsga' },
];

/** Folds Hungarian accents and case for local search and subject matching. */
export function searchableText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('hu').replace(/\s+/g, ' ').trim();
}

/** Groups teaching formats by subject name while retaining course numbers such as Fizika 1/2. */
export function subjectName(title: string): string {
  const courseCode = title.match(/\b([A-Z0-9]+)_(?:EA|GY|LA)(?:_\d+)?\b/i)?.[1];
  const name = title.replace(/\b[A-Z0-9]+_(?:EA|GY|LA)(?:_\d+)?\b/gi, '')
    .replace(/\b(?:előadás|elmélet|gyakorlat|labor(?:gyakorlat)?|szeminárium|EA|GY|LA)\b/giu, '')
    .replace(/[()[\]{}]/g, ' ').replace(/\s*[-–—:;,]\s*$/g, '').replace(/\s+/g, ' ').trim();
  return name || courseCode || title.trim();
}

/** General events have separate notebooks; lesson links are shared inside the same profile. */
export function notebookIdentity(event: Pick<DisplayEvent, 'originalTitle' | 'category' | 'sourceId' | 'key'>): string {
  if ((event.category ?? 'lesson') !== 'lesson') return `event:${JSON.stringify([event.sourceId, event.key])}`;
  return `subject:${searchableText(subjectName(event.originalTitle) || event.originalTitle)}`;
}

export function categoryLabel(category: EventCategory = 'lesson'): string {
  return EVENT_CATEGORIES.find(item => item.value === category)?.label ?? 'Óra';
}

/** Recognizes only explicit assessment words, never inventing deadlines from an ordinary lesson. */
export function importedCategory(title: string): EventCategory {
  const text = searchableText(title);
  if (/\bvizsga\b/.test(text)) return 'exam';
  if (/\b(?:zh|zarthelyi)\b/.test(text)) return 'test';
  if (/\bbeadando\b/.test(text)) return 'assignment';
  return 'lesson';
}

/** Accepts web notes, including pasted addresses without a scheme, and rejects executable URLs. */
export function notebookUrl(value: string): string {
  const text = value.trim();
  if (!text || text.length > 4096) throw new Error('Adj meg egy érvényes, legfeljebb 4096 karakteres linket.');
  const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('HTTP vagy HTTPS jegyzetlink szükséges, bejelentkezési adatok nélkül.');
  return url.href;
}
