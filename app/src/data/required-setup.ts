import { readSetting, saveSetting } from './database';
import { sources } from './repository';

/** Resumes unfinished setup and recovers an import committed before the app closed. */
export async function requiredImportProfile(profileIds: number[]): Promise<number | null> {
  const pending = await readSetting<number | null>('setupProfileId', null);
  if (pending === null) return null;
  const exists = profileIds.includes(pending);
  const imports = exists ? await sources(pending) : [];
  if (exists && !imports.some(source => !source.isManual)) return pending;
  await saveSetting('setupProfileId', null);
  return null;
}
