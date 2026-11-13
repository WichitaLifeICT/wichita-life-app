import { Linking } from 'react-native';
import { WebView } from 'react-native-webview';

import { openLink } from '@/lib/links';
import { STORY_BASE, storyPage } from '@/lib/story-page';

/** A newsletter story's text. Links in it open in the browser sheet (email links in Mail). */
export function StoryFrame({ html }: { html: string }) {
  return (
    <WebView
      originWhitelist={['*']}
      source={{ html: storyPage(html), baseUrl: STORY_BASE }}
      style={{ flex: 1, backgroundColor: '#fff' }}
      // Scripts on, so embedded videos and posts (YouTube, TikTok) play. The story is our own
      // newsletter, and any link that would leave it opens in the browser sheet instead.
      javaScriptEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={(req) => {
        // The story itself, and anything embedded in it (a video), loads here.
        if (!req.isTopFrame || req.url === 'about:blank' || req.url === STORY_BASE) return true;
        if (/^https?:/i.test(req.url)) openLink(req.url);
        else Linking.openURL(req.url).catch(() => {});
        return false;
      }}
    />
  );
}
