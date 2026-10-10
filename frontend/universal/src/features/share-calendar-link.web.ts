export async function shareCalendarLink(url: string): Promise<string> {
  await navigator.clipboard.writeText(url);
  return 'Link másolva.';
}
