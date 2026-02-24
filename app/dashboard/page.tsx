'use client';

import { usePrivy, useConnectWallet, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

type ActionStatus = {
  key: string;
  label: string;
  points: number;
  cooldown: 'once' | '24h';
  category: string;
  platform: string | null;
  url: string | null;
  status: { available: boolean; cooldownEndsAt: string | null; completed: boolean };
};

type MeData = {
  twitterVerificationEnabled?: boolean;
  twitterTweetVerificationEnabled?: boolean;
  user: {
    privyDid: string;
    username: string;
    pfpUrl: string | null;
    walletAddress: string | null;
    points: number;
    referralCode: string;
    referredBy: string | null;
    referralCount: number;
  };
  rank: number;
  rewardTier: string;
  tickets: number;
  actions: ActionStatus[];
};

const TWITTER_ACTIONS_REQUIRING_TWEET_LINK = [
  'qt_twitter',
  'rt_twitter',
  'post_twitter',
  'comment_twitter',
  'daily_post_twitter',
];

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10"
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

function CooldownTimer({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Available now');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(`${h}h ${m}m`);
    };
    update();
    const iv = setInterval(update, 60000);
    return () => clearInterval(iv);
  }, [endsAt]);
  return <span className="text-xs text-white/40">{remaining}</span>;
}

function ConnectWalletSection({ onComplete }: { onComplete: () => void }) {
  const { getAccessToken } = usePrivy();
  const { connectWallet } = useConnectWallet({
    onSuccess: async ({ wallet }) => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) return;
        await fetch('/api/users/update-wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ walletAddress: wallet.address }),
        });
        onComplete();
      } catch (err) {
        console.error('Failed to update wallet:', err);
      }
    },
  });
  const { wallets } = useWallets();
  const connectedWallet = wallets[0];

  return connectedWallet ? (
    <p className="font-mono text-sm text-white">
      {connectedWallet.address.slice(0, 6)}...{connectedWallet.address.slice(-4)}
    </p>
  ) : (
    <button
      type="button"
      onClick={() => connectWallet()}
      className="rounded-lg bg-[#0052FF] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0046e0]"
    >
      Connect Wallet
    </button>
  );
}

export default function DashboardPage() {
  const { user, ready, authenticated, logout, getAccessToken } = usePrivy();
  const router = useRouter();
  const [data, setData] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingAction, setClaimingAction] = useState<string | null>(null);
  const [tweetUrls, setTweetUrls] = useState<Record<string, string>>({});
  const [claimError, setClaimError] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (ready && !authenticated) router.push('/');
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (ready && authenticated) fetchMe();
  }, [ready, authenticated, fetchMe]);

  const handleClaim = async (actionKey: string, tweetUrl?: string) => {
    setClaimError(null);
    setClaimingAction(actionKey);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const body: { action: string; tweetUrl?: string } = { action: actionKey };
      if (tweetUrl?.trim()) body.tweetUrl = tweetUrl.trim();
      const res = await fetch('/api/actions/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        setClaimError(result.error ?? 'Claim failed');
        return;
      }
      setTweetUrls((prev) => ({ ...prev, [actionKey]: '' }));
      await fetchMe();
    } catch (err) {
      console.error('Failed to claim action:', err);
      setClaimError('Something went wrong');
    } finally {
      setClaimingAction(null);
    }
  };

  if (!ready || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <p className="text-white/80">Loading...</p>
      </div>
    );
  }
  if (!authenticated || !user || !data) return null;

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const referralLink = `${appUrl}/?ref=${data.user.referralCode}`;

  const shareText = `Stack points. Win passes. Get Based.\n\nJoin with my referral: ${referralLink}\n\n@abc`;
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  const farcasterShareUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`;

  const onceActions = data.actions.filter((a) => a.category === 'social_once');
  const recurringActions = data.actions.filter((a) => a.category === 'social_recurring');
  const dailyActions = data.actions.filter((a) => a.category === 'daily');

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push('/leaderboard')} className="text-sm text-[#0052FF] hover:underline">
              Leaderboard
            </button>
            <button type="button" onClick={() => logout()} className="text-sm text-white/60 hover:text-white">
              Sign out
            </button>
          </div>
        </div>

        {/* Profile */}
        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
          {data.user.pfpUrl ? (
            <img src={data.user.pfpUrl.replace('_normal', '')} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-xl text-white/50">?</div>
          )}
          <div className="flex-1">
            <p className="font-medium text-white">@{data.user.username}</p>
            <div className="mt-1">
              <ConnectWalletSection onComplete={fetchMe} />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Points', value: data.user.points.toLocaleString() },
            { label: 'Rank', value: `#${data.rank}` },
            { label: 'Tickets', value: String(data.tickets) },
            { label: 'Tier', value: data.rewardTier },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
              <p className="text-xs text-white/50">{s.label}</p>
              <p className="mt-0.5 text-sm font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {claimError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {claimError}
          </div>
        )}

        {/* Daily Check-in */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-white">Daily Check-in</h3>
              <p className="text-xs text-white/50">+50 pts</p>
            </div>
            {(() => {
              const checkin = data.actions.find((a) => a.key === 'daily_checkin');
              if (!checkin) return null;
              return checkin.status.available ? (
                <button
                  type="button"
                  onClick={() => handleClaim('daily_checkin')}
                  disabled={claimingAction === 'daily_checkin'}
                  className="rounded-lg bg-[#0052FF] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0046e0] disabled:opacity-50"
                >
                  {claimingAction === 'daily_checkin' ? '...' : 'Check in'}
                </button>
              ) : (
                <CooldownTimer endsAt={checkin.status.cooldownEndsAt!} />
              );
            })()}
          </div>
        </div>

        {/* One-time Actions */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-medium text-white/70">One-time Actions</h3>
          <div className="space-y-2">
            {onceActions.map((action) => (
              <div key={action.key} className="rounded-lg bg-white/5 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">{action.label}</p>
                    <p className="text-xs text-[#0052FF]">+{action.points} pts</p>
                  </div>
                  {action.status.completed ? (
                    <span className="text-xs text-green-400">Done</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (action.url) window.open(action.url, '_blank');
                        handleClaim(action.key);
                      }}
                      disabled={claimingAction === action.key}
                      className="rounded-lg bg-[#0052FF] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#0046e0] disabled:opacity-50"
                    >
                      {claimingAction === action.key ? '...' : 'Claim'}
                    </button>
                  )}
                </div>
                {action.key === 'follow_twitter' && data.twitterVerificationEnabled && !action.status.completed && (
                  <p className="mt-1.5 text-[10px] text-white/40">We&apos;ll verify you follow us when you claim.</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recurring Social Actions */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-medium text-white/70">Social Actions (Daily)</h3>
          <div className="space-y-2">
            {recurringActions.map((action) => {
              const needsTweetLink = data.twitterTweetVerificationEnabled && TWITTER_ACTIONS_REQUIRING_TWEET_LINK.includes(action.key);
              return (
                <div key={action.key} className="rounded-lg bg-white/5 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">
                        {action.label}
                        {action.platform && (
                          <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                            {action.platform === 'twitter' ? 'X' : 'FC'}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[#0052FF]">+{action.points} pts</p>
                    </div>
                    {action.status.available ? (
                      !needsTweetLink ? (
                        <button
                          type="button"
                          onClick={() => handleClaim(action.key)}
                          disabled={claimingAction === action.key}
                          className="rounded-lg bg-[#0052FF] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#0046e0] disabled:opacity-50"
                        >
                          {claimingAction === action.key ? '...' : 'Claim'}
                        </button>
                      ) : null
                    ) : (
                      <CooldownTimer endsAt={action.status.cooldownEndsAt!} />
                    )}
                  </div>
                  {needsTweetLink && action.status.available && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="url"
                        placeholder="Paste your tweet link (x.com/.../status/...)"
                        value={tweetUrls[action.key] ?? ''}
                        onChange={(e) => setTweetUrls((prev) => ({ ...prev, [action.key]: e.target.value }))}
                        className="min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-white/30"
                      />
                      <button
                        type="button"
                        onClick={() => handleClaim(action.key, tweetUrls[action.key])}
                        disabled={claimingAction === action.key || !tweetUrls[action.key]?.trim()}
                        className="shrink-0 rounded-lg bg-[#0052FF] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#0046e0] disabled:opacity-50"
                      >
                        {claimingAction === action.key ? '...' : 'Verify & Claim'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Content Actions */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-medium text-white/70">Daily Content</h3>
          <div className="space-y-2">
            {dailyActions.filter((a) => a.key !== 'daily_checkin').map((action) => {
              const needsTweetLink = data.twitterTweetVerificationEnabled && action.key === 'daily_post_twitter';
              return (
                <div key={action.key} className="rounded-lg bg-white/5 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{action.label}</p>
                      <p className="text-xs text-[#0052FF]">+{action.points} pts</p>
                    </div>
                    {action.status.available ? (
                      !needsTweetLink ? (
                        <button
                          type="button"
                          onClick={() => handleClaim(action.key)}
                          disabled={claimingAction === action.key}
                          className="rounded-lg bg-[#0052FF] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#0046e0] disabled:opacity-50"
                        >
                          {claimingAction === action.key ? '...' : 'Claim'}
                        </button>
                      ) : null
                    ) : (
                      <CooldownTimer endsAt={action.status.cooldownEndsAt!} />
                    )}
                  </div>
                  {needsTweetLink && action.status.available && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="url"
                        placeholder="Paste your tweet link (must mention @abc)"
                        value={tweetUrls[action.key] ?? ''}
                        onChange={(e) => setTweetUrls((prev) => ({ ...prev, [action.key]: e.target.value }))}
                        className="min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-white/30"
                      />
                      <button
                        type="button"
                        onClick={() => handleClaim(action.key, tweetUrls[action.key])}
                        disabled={claimingAction === action.key || !tweetUrls[action.key]?.trim()}
                        className="shrink-0 rounded-lg bg-[#0052FF] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#0046e0] disabled:opacity-50"
                      >
                        {claimingAction === action.key ? '...' : 'Verify & Claim'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Referral Section */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-medium text-white/70">Referrals</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/50">Your referral code</p>
                <p className="font-mono text-sm font-bold text-white">{data.user.referralCode}</p>
              </div>
              <CopyButton text={data.user.referralCode} label="Copy code" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/50">Referral link</p>
                <p className="max-w-[200px] truncate text-xs text-white/60">{referralLink}</p>
              </div>
              <CopyButton text={referralLink} label="Copy link" />
            </div>
            <div className="border-t border-white/10 pt-2">
              <p className="text-xs text-white/50">
                Friends referred: <span className="font-bold text-white">{data.user.referralCount}</span>
              </p>
              <p className="mt-1 text-[10px] text-white/40">
                1-5: 200pts each | 6-20: 300pts each | 21+: 500pts each
              </p>
            </div>
          </div>
        </div>

        {/* Share */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-medium text-white/70">Share</h3>
          <div className="flex gap-2">
            <a
              href={twitterShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-white/10 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-white/20"
            >
              Share on X
            </a>
            <a
              href={farcasterShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-[#8B5CF6]/20 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-[#8B5CF6]/30"
            >
              Share on Farcaster
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
