import type { Anchor } from './model';
export const TIME_ZONE = 'Europe/Budapest';
const formatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

/** Formats an instant in the institution's timezone, independently of the device. */
export function wallTime(timestamp: number): string {
  return formatter.format(new Date(timestamp)).replace(' ', 'T');
}

/** Validates a calendar date without allowing JavaScript date rollover. */
export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

/** Converts Budapest wall time; nonexistent DST times fail, repeated times use the earlier instant. */
export function fromWall(value: string): number {
  const normalized = value.length === 10 ? `${value}T00:00:00` : value.slice(0, 19).padEnd(19, ':00');
  const pseudo = Date.parse(`${normalized}Z`);
  if (!Number.isFinite(pseudo) || !validDate(normalized.slice(0, 10))) throw new Error('Érvénytelen dátum vagy időpont.');
  const candidates = [2, 1].map(offset => pseudo - offset * 3600000);
  const match = candidates.find(candidate => wallTime(candidate) === normalized);
  if (match === undefined) throw new Error('Nem létező budapesti időpont (óraátállítás), vagy nem támogatott történelmi dátum.');
  return match;
}

/** Adds calendar days without drifting at daylight-saving boundaries. */
export function addDays(date: string, amount: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);
}
export function monday(date: string): string {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -(weekday + 6) % 7);
}
export function weekAt(date: string, anchor: Anchor): 'A' | 'B' {
  const distance = Math.round((Date.parse(monday(date)) - Date.parse(anchor.date)) / 604800000);
  return Math.abs(distance % 2) === 0 ? anchor.week : anchor.week === 'A' ? 'B' : 'A';
}
export function today(): string { return wallTime(Date.now()).slice(0, 10); }
export function clockTime(timestamp: number): string { return wallTime(timestamp).slice(11, 16); }
export function dateLabel(date: string): string {
  return new Intl.DateTimeFormat('hu-HU', { month: 'short', day: 'numeric', weekday: 'short', timeZone: TIME_ZONE }).format(new Date(fromWall(date)));
}
export function validateRange(from: string, to: string): void {
  if (!validDate(from) || !validDate(to) || from > to) throw new Error('Érvényes kezdő- és záródátum szükséges.');
}
