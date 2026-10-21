import { Platform, Share } from 'react-native';

/**
 * Opens the share sheet. On desktop browsers without one, copies the link instead.
 * Returns a short status for the button ("Link copied!"), or undefined when the sheet opened.
 */
export async function shareLink(link: string, message: string): Promise<string | undefined> {
  try {
    if (Platform.OS === 'web' && !navigator.share) {
      await navigator.clipboard.writeText(link);
      return 'Link copied!';
    }
    await Share.share(Platform.OS === 'ios' ? { message, url: link } : { message: `${message} ${link}` });
    return undefined;
  } catch {
    return link;
  }
}
