import type { ReminderProfile } from '../domain/reminders';

/** Web keeps reminder preferences locally but cannot deliver closed-app notifications. */
export async function reconcileReminders(): Promise<void> {}
export async function requestReminderPermission(): Promise<void> {}
export async function reminderPermissionGranted(): Promise<boolean> { return true; }
export async function openReminderChannel(_profile: ReminderProfile): Promise<void> {
  throw new Error('A jelzőprofilok rendszerbeállításai Androidon érhetők el.');
}

export async function openExactAlarmSettings(): Promise<void> {}
