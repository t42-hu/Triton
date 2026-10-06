import type { DisplayEvent } from '../domain/model';
import { notebookIdentity, notebookUrl, searchableText, subjectName, type LessonTask, type NotebookLink } from '../domain/student';
import { getDatabase, transaction, write } from './database';
import { uniqueId } from './importer';

const taskSelection = `SELECT t.*,COALESCE(e.title,t.eventTitle) eventTitle,COALESCE(e.start,t.due) due
  FROM lesson_tasks t JOIN sources s ON s.id=t.sourceId
  LEFT JOIN events e ON e.sourceId=s.id AND e.revision=s.revision AND e.key=t.eventKey`;
export type SearchResults = { events: DisplayEvent[]; links: NotebookLink[]; tasks: LessonTask[] };

export async function upcomingAssessments(profileId: number, now: number): Promise<DisplayEvent[]> {
  return (await getDatabase()).getAllAsync<DisplayEvent>(`SELECT e.*,s.profileId,o.patch FROM events e JOIN sources s ON s.id=e.sourceId AND s.revision=e.revision
    LEFT JOIN overrides o ON o.sourceId=e.sourceId AND o.key=e.key WHERE s.profileId=? AND e.hidden=0 AND e.category IN ('assignment','test','exam')
    AND ((e.category='assignment' AND e.end>?) OR e.end>=?) ORDER BY e.start LIMIT 100`, profileId, now - 30 * 86400000, now);
}

export async function lessonRooms(profileId: number): Promise<string[]> {
  const rows = await (await getDatabase()).getAllAsync<{ location: string }>(`SELECT DISTINCT e.location FROM events e JOIN sources s ON s.id=e.sourceId AND s.revision=e.revision WHERE s.profileId=? AND e.hidden=0 AND e.category='lesson' AND trim(e.location)<>''`, profileId);
  return rows.map(row => row.location);
}

export async function notebookLinks(event: DisplayEvent): Promise<NotebookLink[]> {
  return (await getDatabase()).getAllAsync<NotebookLink>('SELECT * FROM notebook_links WHERE profileId=? AND notebookKey=? ORDER BY rowid', event.profileId, notebookIdentity(event));
}

/** Stores a subject link once so every lecture and practice can reuse it. */
export async function addNotebookLink(event: DisplayEvent, title: string, address: string): Promise<void> {
  const url = notebookUrl(address);
  const name = title.trim() || new URL(url).hostname;
  if (name.length > 200) throw new Error('A link neve legfeljebb 200 karakter lehet.');
  const subject = (event.category ?? 'lesson') === 'lesson' ? subjectName(event.originalTitle) || event.title : event.title;
  await write(async db => { await db.runAsync('INSERT INTO notebook_links VALUES (?,?,?,?,?,?,?)', uniqueId(), event.profileId, notebookIdentity(event), subject, name, url, searchableText(`${subject} ${name} ${url}`)); });
}

export async function removeNotebookLink(id: string): Promise<void> {
  await write(async db => { await db.runAsync('DELETE FROM notebook_links WHERE id=?', id); });
}

/** Reads occurrence tasks with current imported/edited event dates. */
export async function lessonTasks(profileId: number, event?: DisplayEvent): Promise<LessonTask[]> {
  const suffix = event ? ' AND t.sourceId=? AND t.eventKey=?' : '';
  const params = event ? [profileId, event.sourceId, event.key] : [profileId];
  return (await getDatabase()).getAllAsync<LessonTask>(`${taskSelection} WHERE t.profileId=?${suffix} ORDER BY t.completed,due,t.rowid`, ...params);
}

export async function addLessonTask(event: DisplayEvent, title: string): Promise<void> {
  if (!title.trim() || title.length > 500) throw new Error('Adj meg egy legfeljebb 500 karakteres feladatot.');
  await transaction(async db => {
    const exists = await db.getFirstAsync('SELECT e.key FROM events e JOIN sources s ON s.id=e.sourceId AND s.revision=e.revision WHERE e.sourceId=? AND e.key=? AND s.profileId=?', event.sourceId, event.key, event.profileId);
    if (!exists) throw new Error('Ez az esemény már nem érhető el.');
    await db.runAsync('INSERT INTO lesson_tasks VALUES (?,?,?,?,?,?,?,?,?)', uniqueId(), event.profileId, event.sourceId, event.key, title.trim(), 0, event.title, event.start, searchableText(`${title} ${event.title}`));
  });
}

export async function setTaskCompleted(id: string, completed: boolean): Promise<void> {
  await write(async db => { await db.runAsync('UPDATE lesson_tasks SET completed=? WHERE id=?', Number(completed), id); });
}

export async function removeLessonTask(id: string): Promise<void> {
  await write(async db => { await db.runAsync('DELETE FROM lesson_tasks WHERE id=?', id); });
}

/** Resolves a task to its current occurrence, without opening an obsolete import revision. */
export async function taskEvent(task: LessonTask): Promise<DisplayEvent | null> {
  return (await getDatabase()).getFirstAsync<DisplayEvent>(`SELECT e.*,s.profileId,o.patch FROM events e
    JOIN sources s ON s.id=e.sourceId AND s.revision=e.revision LEFT JOIN overrides o ON o.sourceId=e.sourceId AND o.key=e.key
    WHERE e.sourceId=? AND e.key=?`, task.sourceId, task.eventKey);
}

/** Searches normalized local text across all active dates; each section returns at most 60 rows. */
export async function searchStudentData(query: string, profileId?: number): Promise<SearchResults> {
  const text = searchableText(query);
  if (!text) return { events: [], links: [], tasks: [] };
  const db = await getDatabase(); const profile = profileId ?? null;
  const events = await db.getAllAsync<DisplayEvent>(`SELECT e.*,s.profileId,o.patch FROM events e JOIN sources s ON s.id=e.sourceId AND s.revision=e.revision
    LEFT JOIN overrides o ON o.sourceId=e.sourceId AND o.key=e.key WHERE e.hidden=0 AND (? IS NULL OR s.profileId=?) AND instr(e.searchText,?)>0 ORDER BY e.start LIMIT 60`, profile, profile, text);
  const links = await db.getAllAsync<NotebookLink>('SELECT * FROM notebook_links WHERE (? IS NULL OR profileId=?) AND instr(searchText,?)>0 ORDER BY rowid DESC LIMIT 60', profile, profile, text);
  const tasks = await db.getAllAsync<LessonTask>(`${taskSelection} WHERE (? IS NULL OR t.profileId=?) AND (instr(t.searchText,?)>0 OR instr(e.searchText,?)>0) ORDER BY t.completed,due LIMIT 60`, profile, profile, text, text);
  return { events, links, tasks };
}
