export type LessonType = 'EA' | 'GY' | 'LA' | null;

/** Identifies the Neptun lesson code embedded in an imported event title. */
export function lessonType(title: string): LessonType {
  const code = title.match(/\b[A-Z0-9]+_(EA|GY|LA)(?:_\d+)?\b/i)?.[1]?.toUpperCase();
  return code === 'EA' || code === 'GY' || code === 'LA' ? code : null;
}
