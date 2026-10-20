/** Web version: the games site in an iframe (it allows being embedded). */
export function GameFrame({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      title="Wichita Life Games"
      style={{ flex: 1, width: '100%', height: '100%', border: 0 }}
      allow="clipboard-write; fullscreen"
    />
  );
}
