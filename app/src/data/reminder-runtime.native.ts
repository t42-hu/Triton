import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { planReminders, reminderDifference, REMINDER_PREFIX, REMINDER_PROFILES, type PlannedReminder, type ReminderProfile } from '../domain/reminders';
import { globalReminders, reminderEvents } from './reminders';
import { readSetting, saveSetting } from './database';

let pending: Promise<void> = Promise.resolve();
/** Serializes OS writes so foreground/background refreshes cannot leave stale reminders behind. */
export function reconcileReminders(): Promise<void> {
  const next = pending.then(reconcile);
  pending = next.catch(() => undefined);
  return next;
}
async function reconcile(): Promise<void> {
  try {
    const now = Date.now();
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    const rearm = await readSetting('reminderRearm', false);
    const permission = await Notifications.getPermissionsAsync();
    const otherCount = requests.filter(item => !item.identifier.startsWith(REMINDER_PREFIX)).length;
    const planned = permission.granted ? planReminders(await reminderEvents(now), await globalReminders(), now, Math.max(0, 60 - otherCount)) : [];
    const difference = reminderDifference(planned, requests.map(item => ({ id: item.identifier, fingerprint: rearm ? undefined : item.content.data?.fingerprint })));
    for (const id of difference.cancel) await Notifications.cancelScheduledNotificationAsync(id);
    if (planned.length) await createReminderChannels();
    for (const item of difference.schedule) await schedule(item);
    await saveSetting('reminderRearm', false);
    await saveSetting('reminderStatus', { count: planned.length, through: planned.at(-1)?.at ?? 0, error: permission.granted ? '' : 'Az értesítési engedély nincs megadva. A mentett szabályok megmaradnak.' });
  } catch (error) {
    await saveSetting('reminderStatus', { count: 0, through: 0, error: 'Az ütemezést nem sikerült befejezni. Nyisd meg újra az appot az újrapróbáláshoz.' });
    throw error;
  }
}
async function schedule(item: PlannedReminder): Promise<void> {
  if (item.at <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({ identifier: item.id,
    content: { title: item.title, body: item.body, sound: 'default', data: { kind: 'class-reminder', fingerprint: item.fingerprint } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.at), channelId: item.channelId } });
}
/** Existing channels belong to the user; never overwrite their sound/vibration preferences. */
export async function createReminderChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  for (const profile of REMINDER_PROFILES) {
    if (await Notifications.getNotificationChannelAsync(profile.channelId)) continue;
    await Notifications.setNotificationChannelAsync(profile.channelId, { name: `Óra előtt · ${profile.label}`, importance: Notifications.AndroidImportance.HIGH, sound: 'default', enableVibrate: true, vibrationPattern: [...profile.vibration] });
  }
}
export async function requestReminderPermission(): Promise<void> {
  await createReminderChannels();
  if ((await Notifications.getPermissionsAsync()).granted) return;
  if (!(await Notifications.requestPermissionsAsync()).granted) throw new Error('Engedélyezd az értesítéseket a rendszerbeállításokban.');
}
export async function openReminderChannel(profile: ReminderProfile): Promise<void> {
  if (Platform.OS !== 'android') { await Linking.openSettings(); return; }
  await createReminderChannels();
  const channel = REMINDER_PROFILES.find(item => item.value === profile);
  if (!channel) throw new Error('Ismeretlen jelzőprofil.');
  await Linking.sendIntent('android.settings.CHANNEL_NOTIFICATION_SETTINGS', [
    { key: 'android.provider.extra.APP_PACKAGE', value: Constants.expoConfig?.android?.package ?? 'hu.t42.triton' },
    { key: 'android.provider.extra.CHANNEL_ID', value: channel.channelId },
  ]);
}

/** Android's separate special access controls exact delivery during battery saving. */
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await saveSetting('reminderRearm', true);
  await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM');
}
