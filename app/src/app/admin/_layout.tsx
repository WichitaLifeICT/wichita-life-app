import { router, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { Button, Card, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

/** Staff only. The database enforces this too; the gate just keeps members out of empty screens. */
export default function AdminLayout() {
  const theme = useTheme();
  const { session, profile, loading } = useAuth();

  if (loading || (session && !profile)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator color={Brand.blue} />
      </View>
    );
  }
  if (!profile || profile.role === 'member') {
    return (
      <AdminPage title="Staff tools">
        <Card style={{ gap: Spacing.two }}>
          <T variant="cardTitle">Staff only</T>
          <T variant="small">
            {session ? 'This account isn’t on the Wichita Life team.' : 'Sign in with your Wichita Life staff account.'}
          </T>
          {!session ? <Button tone="red" label="Sign in" onPress={() => router.push('/sign-in')} /> : null}
        </Card>
      </AdminPage>
    );
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
