import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Share, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Button, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { openLink } from '@/lib/links';
import { WEB_URL } from '@/lib/referral';
import { supabase } from '@/lib/supabase';

export const GOLF_URL = `${WEB_URL}/golf/`;

/**
 * Wichita Mini Golf inside the app. The game lives on the website and needs a sign-in, so the app hands over
 * the member's current access token in the address's #fragment (never sent to a server). The game uses it for
 * the leaderboard and never refreshes it, so the app's own sign-in is left alone. Links that leave the golf
 * pages open in the browser, and "Challenge a friend" opens the phone's share sheet.
 *
 * `path` is the golf page to open, like /golf/3/?c=2&n=Ana%20L. (a shared challenge); /golf/ by default.
 */
export function GolfFrame({ path = '/golf/' }: { path?: string }) {
  const { session } = useAuth();
  const [token, setToken] = useState<string | null>();

  useEffect(() => {
    let live = true;
    (async () => {
      if (!supabase) return setToken(null);
      let { data } = await supabase.auth.getSession();
      let current = data.session;
      // Hand over a token with plenty of time left on it (they last an hour).
      if (current && (current.expires_at ?? 0) * 1000 - Date.now() < 20 * 60 * 1000) {
        ({ data } = await supabase.auth.refreshSession());
        current = data.session ?? current;
      }
      if (live) setToken(current?.access_token ?? null);
    })().catch(() => live && setToken(null));
    return () => {
      live = false;
    };
  }, [session?.user.id]);

  if (token === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={Brand.blue} />
      </View>
    );
  }
  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three }}>
        <T style={{ textAlign: 'center' }} color={Brand.white}>
          Wichita Mini Golf is free for Wichita Life members. Sign in to play.
        </T>
        <Button
          tone="orange"
          label="Sign in to play"
          onPress={() => router.push({ pathname: '/sign-in', params: { reason: 'Sign in to play mini golf' } })}
        />
      </View>
    );
  }
  return (
    <WebView
      source={{ uri: `${WEB_URL}${path.startsWith('/golf') ? path : '/golf/'}#app=${encodeURIComponent(token)}` }}
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
      onMessage={(e) => {
        let msg: { type?: string; text?: string; url?: string; hole?: number; strokes?: number };
        try {
          msg = JSON.parse(e.nativeEvent.data);
        } catch {
          return;
        }
        // Only our own golf pages' share links, and only to the golf pages.
        if (msg.type !== 'share' || typeof msg.text !== 'string' || typeof msg.url !== 'string') return;
        if (!msg.url.startsWith(`${WEB_URL}/golf`)) return;
        track('golf_challenge_shared', { hole: Number(msg.hole) || 0, strokes: Number(msg.strokes) || 0 });
        Share.share(Platform.OS === 'ios' ? { message: msg.text, url: msg.url } : { message: `${msg.text} ${msg.url}` }).catch(() => {});
      }}
    />
  );
}
