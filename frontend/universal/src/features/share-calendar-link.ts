import { Share } from 'react-native';
export async function shareCalendarLink(url: string): Promise<string> {
  await Share.share({ message: url });
  return '';
}
