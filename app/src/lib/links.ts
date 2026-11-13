import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { Brand } from '@/constants/theme';

/** Open articles, tickets and job posts in an in-app browser sheet. */
export function openLink(url: string) {
  return WebBrowser.openBrowserAsync(url, {
    controlsColor: Brand.red,
    toolbarColor: Brand.orange,
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}

/**
 * Opens a newsletter story on the app's own reading screen. Beehiiv's page would ask app readers to
 * subscribe again, since their beehiiv login doesn't carry into the app.
 */
export function openStory(story: { id: string }) {
  router.push({ pathname: '/story/[id]', params: { id: story.id } });
}
