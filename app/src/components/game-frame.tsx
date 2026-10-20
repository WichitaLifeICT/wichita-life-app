import { ActivityIndicator, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Brand } from '@/constants/theme';
import { GAMES_URL } from '@/lib/games';
import { openLink } from '@/lib/links';

/** Shows a game page inside the app. Links that leave the games site open in the browser sheet. */
export function GameFrame({ url }: { url: string }) {
  return (
    <WebView
      source={{ uri: url }}
      style={{ flex: 1, backgroundColor: 'transparent' }}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
      renderLoading={() => (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={Brand.blue} />
        </View>
      )}
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={(req) => {
        if (req.url.startsWith(GAMES_URL) || req.url === 'about:blank') return true;
        openLink(req.url);
        return false;
      }}
    />
  );
}
