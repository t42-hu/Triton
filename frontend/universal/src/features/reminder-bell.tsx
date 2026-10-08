import { Bell, BellOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import type { DisplayEvent } from '../domain/model';
import { eventReminders, globalReminders } from '../data/reminders';
import { effectiveReminders } from '../domain/reminders';
import { reminderPermissionGranted } from '../data/reminder-runtime';
import { useApp } from './app-state';
import { Icon } from '@/components/ui/icon';

export function ReminderBell({ enabled, size }: { enabled: boolean; size: number }) {
  return <Icon as={enabled ? Bell : BellOff} size={size} className={enabled ? 'text-primary' : 'text-destructive'} />;
}

/** Re-read saved occurrence preferences after the reminder dialog refreshes the app. */
export function useEventRemindersEnabled(event: DisplayEvent) {
  const app = useApp();
  const { sourceId, key } = event;
  const own = app.profileList.some(profile => profile.id === event.profileId && profile.isOwn);
  const [enabled, setEnabled] = useState(app.remindersEnabled && own);
  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const [local, global, permission] = await Promise.all([eventReminders({ sourceId, key }), globalReminders(), reminderPermissionGranted()]);
        if (!disposed) setEnabled(permission && effectiveReminders({ isOwn: Number(own), reminders: local }, global).length > 0);
      } catch { if (!disposed) setEnabled(false); }
    }
    void load();
    return () => { disposed = true; };
  }, [sourceId, key, own, app.remindersEnabled, app.version]);
  return enabled;
}
