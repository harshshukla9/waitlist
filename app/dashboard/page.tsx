'use client';

import { usePrivy, useConnectWallet, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function ConnectWalletSection() {
  const { getAccessToken } = usePrivy();
  const { connectWallet } = useConnectWallet({
    onSuccess: async (wallet) => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) return;
        await fetch('/api/users/update-wallet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ walletAddress: wallet.address }),
        });
      } catch (err) {
        console.error('Failed to update wallet:', err);
      }
    },
  });

  const { wallets } = useWallets();
  const connectedWallet = wallets[0];

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="mb-3 text-sm font-medium text-white/70">Wallet</h2>
      {connectedWallet ? (
        <p className="font-mono text-sm text-white">
          ✅ {connectedWallet.address.slice(0, 6)}...{connectedWallet.address.slice(-4)}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => connectWallet()}
          className="rounded-lg bg-[#0052FF] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0046e0]"
        >
          Connect Wallet (MetaMask / Rabby / etc.)
        </button>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, ready, authenticated, logout } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <p className="text-white/80">Loading...</p>
      </div>
    );
  }

  if (!authenticated || !user) return null;

  const twitterUsername = user.twitter?.username ?? null;
  const twitterPfp = user.twitter?.profilePictureUrl ?? null;
  const twitterName = user.twitter?.name ?? null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-6 py-10">
      <div className="mx-auto max-w-md space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <button
            type="button"
            onClick={() => logout()}
            className="text-sm text-white/60 hover:text-white"
          >
            Sign out
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-6">
          {twitterPfp ? (
            <img
              src={twitterPfp.replace('_normal', '')}
              alt="Profile"
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl text-white/50">
              ?
            </div>
          )}
          {twitterName && (
            <p className="text-lg font-medium text-white">{twitterName}</p>
          )}
          {twitterUsername && (
            <p className="text-white/70">@{twitterUsername}</p>
          )}
        </div>

        <ConnectWalletSection />
      </div>
    </div>
  );
}
