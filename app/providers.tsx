'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { Providers as AppProviders } from '@/components/providers';

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
if (!privyAppId) {
  throw new Error('NEXT_PUBLIC_PRIVY_APP_ID is not set');
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ['twitter'],
        externalWallets: {},
        appearance: {
          theme: 'dark',
          accentColor: '#0052FF',
        },
      }}
    >
      <AppProviders>{children}</AppProviders>
    </PrivyProvider>
  );
}
