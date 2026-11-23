import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { openLink } from '@/lib/links';
import { WEB_URL } from '@/lib/referral';
import { supabase } from '@/lib/supabase';

export const GOLF_URL = `${WEB_URL}/golf/`;

/**
 * Wichita Mini Golf inside the app. The game lives on the website and needs a sign-in, so the app hands over
 * the member's current access token in the address's #fragment (never sent to a server). The game uses it for
 * the leaderboard and never refreshes it, so the app's own sign-in is left alone. Links that leave the golf
 * pages open in the browser.
 */
export function GolfFrame() {
  const [token, setToken] = useState<string | null>();

  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return setToken(null);
      let { data } = await supabase.auth.getSession();
      let session = data.session;
      // Hand over a token with plenty of time left on it (they last an hour).
      if (session && (session.expires_at ?? 0) * 1000 - Date.now() < 20 * 60 * 1000) {
        ({ data } = await supabase.auth.refreshSession());
        session = data.session ?? session;
      }
      if (live) setToken(session?.access_token ?? null);
    })().catch(() => live && setToken(null));
    return () => {
      live = false;
    };
  }, []);

  if (token === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={Brand.blue} />
      </View>
    );
  }
  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.four }}>
        <T style={{ textAlign: 'center' }}>Sign in to Wichita Life to play mini golf.</T>
      </View>
    );
  }
  return (
    <WebView
      source={{ uri: `${GOLF_URL}#app=${encodeURIComponent(token)}` }}
      style={{ flex: 1, backgroundColor: '#2D7045' }}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      startInLoadingState
      renderLoading={() => (
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#2D7045' }}>
          <ActivityIndicator color={Brand.white} />
        </View>
      )}
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={(req) => {
        if (req.url.startsWith(`${WEB_URL}/golf`) || req.url === 'about:blank') return true;
        openLink(req.url);
        return false;
      }}
    />
  );
}
