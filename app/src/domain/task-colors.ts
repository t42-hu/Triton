import type { DisplayEvent } from './model';
import type { LessonTask } from './student';

/** Gives a task its own occurrence override while sharing its course's task palette. */
export function taskColorEvent(task: LessonTask): DisplayEvent {
  return { sourceId: task.sourceId, key: `task:${task.id}`, profileId: task.profileId, title: task.title, originalTitle: task.eventTitle, start: task.due, end: task.due, kind: 'timed', category: 'assignment', location: '', hidden: 0, base: '{}', patch: null };
}
