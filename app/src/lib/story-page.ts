// Shared by the phone and web versions of components/story-frame.

export const STORY_BASE = 'https://wichitalife.beehiiv.com/';

/**
 * Beehiiv's story HTML, made to fit a phone: images and embeds no wider than the screen, a little
 * room at the edges, and text that doesn't resize when the phone turns. `extraHead` lets the web
 * version add its own tags.
 */
export function storyPage(html: string, extraHead = '') {
  const head =
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>html,body{background:#fff}body{margin:0;padding:8px 14px 56px;-webkit-text-size-adjust:100%;overflow-wrap:break-word}' +
    'img,video,table{max-width:100%!important}img{height:auto!important}iframe{max-width:100%!important}</style>' +
    extraHead;
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (m) => m + head)
    : `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${html}</body></html>`;
}
