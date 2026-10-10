import { BookOpen, CalendarClock, ClipboardCheck, FilePenLine, GraduationCap, BriefcaseBusiness } from 'lucide-react-native';
import type { EventCategory } from '../domain/model';
import { categoryLabel } from '../domain/student';

/** Keeps labels and icons consistent between creation, editing and task shortcuts. */
export function eventCategoryName(category: EventCategory): string {
  return category === 'event' ? 'Esemény' : categoryLabel(category);
}

export function eventCategoryIcon(category: EventCategory) {
  if (category === 'work') return BriefcaseBusiness;
  if (category === 'lesson') return BookOpen;
  if (category === 'assignment') return ClipboardCheck;
  if (category === 'test') return FilePenLine;
  if (category === 'exam') return GraduationCap;
  return CalendarClock;
}
