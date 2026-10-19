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
