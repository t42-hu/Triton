import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { isDevice } from 'expo-device';
import { getDatabase, readSetting, saveSetting } from './database';
import { syncOwnCalendar, type SyncResult } from './calendar-sync';

import { hasReminders } from './reminders';
import { reconcileReminders } from './reminder-runtime';

const taskName = 'triton-calendar-sync';
const channelId = 'timetable-changes';
Notifications.setNotificationHandler({ handleNotification: async notification => ({ shouldPlaySound: notification.request.content.data?.kind === 'class-reminder', shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });
if (!TaskManager.isTaskDefined(taskName)) TaskManager.defineTask(taskName, runBackground);

/** Local notifications contain only counts, never the private feed URL or class details. */
export async function refreshCalendar(): Promise<SyncResult> {
  const result = await syncOwnCalendar();
  await reconcileReminders();
  if (!result.summary || !await readSetting('changeNotifications', false)) return result;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return result;
    await createChannel();
    await Notifications.scheduleNotificationAsync({ identifier: `triton-${result.revision}`, content: { title: 'Megváltozott az órarended', body: result.summary }, trigger: { channelId } });
  } catch { await saveSetting('notificationError', 'A frissítés sikerült, de az értesítést nem sikerült megjeleníteni.'); }
  return result;
}
async function runBackground(): Promise<BackgroundTask.BackgroundTaskResult> {
  try { return (await refreshCalendar()).status === 'failed' ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success; }
  catch { return BackgroundTask.BackgroundTaskResult.Failed; }
}
async function createChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(channelId, { name: 'Órarendváltozások', importance: Notifications.AndroidImportance.DEFAULT });
}
export async function enableNotifications(enabled: boolean): Promise<void> {
  if (!enabled) { await saveSetting('changeNotifications', false); return; }
  await createChannel();
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Az értesítésekhez engedély szükséges a rendszerbeállításokban.');
  await saveSetting('changeNotifications', true);
  await saveSetting('notificationError', '');
}
/** OS scheduling is optional: foreground sync remains available when background work is restricted. */
export async function configureBackground(): Promise<string> {
  if (Platform.OS === 'ios' && !isDevice) return 'Szimulátoron a háttérfrissítés nem támogatott.';
  if (!await TaskManager.isAvailableAsync()) return 'Háttérfrissítéshez saját natív build szükséges.';
  const subscription = await (await getDatabase()).getFirstAsync(`SELECT c.sourceId FROM source_sync c JOIN sources s ON s.id=c.sourceId JOIN profiles p ON p.id=s.profileId WHERE p.isOwn=1 AND c.autoSync=1 AND c.url IS NOT NULL`);
  const registered = await TaskManager.isTaskRegisteredAsync(taskName);
  if (!subscription && !await hasReminders()) {
    if (registered) await BackgroundTask.unregisterTaskAsync(taskName);
    return '';
  }
  if (await BackgroundTask.getStatusAsync() === BackgroundTask.BackgroundTaskStatus.Restricted) return 'A rendszer korlátozza a háttérfrissítést.';
  if (!registered) await BackgroundTask.registerTaskAsync(taskName, { minimumInterval: 15 });
  return 'Háttérben a rendszer ütemezése szerint frissül.';
}
