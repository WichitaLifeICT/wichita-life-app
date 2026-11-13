import { storyPage } from '@/lib/story-page';

/**
 * Web version: the story in a sandboxed frame. It can run its embeds (videos) but, without
 * allow-same-origin, can't reach the app's own page or sign-in. Links open in a new tab.
 */
export function StoryFrame({ html }: { html: string }) {
  return (
    <iframe
      srcDoc={storyPage(html, '<base target="_blank">')}
      title="Wichita Life story"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-presentation"
      style={{ flex: 1, width: '100%', height: '100%', border: 0, background: '#fff' }}
    />
  );
}
