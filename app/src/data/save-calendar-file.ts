import { File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

/** Hands the calendar to the platform's file sharing and save destinations. */
export async function saveCalendarFile(filename: string, content: string): Promise<void> {
  if (!await isAvailableAsync()) throw new Error('A fájlmegosztás ezen az eszközön nem érhető el.');
  const file = new File(Paths.cache, filename);
  file.write(content);
  await shareAsync(file.uri, { mimeType: 'text/calendar', UTI: 'public.calendar-event', dialogTitle: 'Órarend exportálása' });
}
