import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import type { DisplayEvent } from '../domain/model';
import { notebookIdentity, supportsStudyLinks } from '../domain/student';
import { notebookLinks } from '../data/student-repository';
import { useApp } from './app-state';

/** Resolve before the tap so web links open within the browser's user gesture. */
export function useNotebookQuickLink(event: DisplayEvent | undefined, learning: boolean, fallback: () => void) {
  const { version } = useApp();
  const enabled = Boolean(event && supportsStudyLinks(event));
  const identity = event && enabled ? `${event.profileId}:${learning}:${notebookIdentity(event)}` : '';
  const [resolved, setResolved] = useState<{ identity: string; version: number; url?: string }>();
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!event || !enabled) return;
      try {
        const links = await notebookLinks(event, learning);
        if (!cancelled) setResolved({ identity, version, url: links[0]?.url });
      } catch { if (!cancelled) setResolved({ identity, version }); }
    }
    void load();
    return () => { cancelled = true; };
  // Link identity, rather than the display-event object, controls the lookup.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, version, enabled]);
  const loading = enabled && (resolved?.identity !== identity || resolved?.version !== version);
  function open() {
    if (!enabled || loading) return;
    if (resolved?.url) void Linking.openURL(resolved.url).catch(fallback);
    else fallback();
  }
  return { open, loading };
}
