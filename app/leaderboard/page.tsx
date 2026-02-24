'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

type LeaderboardEntry = {
  rank: number;
  username: string;
  pfpUrl: string | null;
  points: number;
};

type LeaderboardData = {
  top10: LeaderboardEntry[];
  cutoff100: number;
  cutoff500: number;
  currentUser: {
    username: string;
    pfpUrl: string | null;
    points: number;
    rank: number;
    rewardTier: string;
    tickets: number;
  } | null;
};

export default function LeaderboardPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (authenticated) {
        const token = await getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch('/api/leaderboard', { headers });
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    if (ready) fetchLeaderboard();
  }, [ready, fetchLeaderboard]);

  if (!ready || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <p className="text-white/80">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="text-sm text-[#0052FF] hover:underline"
          >
            Dashboard
          </button>
        </div>

        {data?.currentUser && (
          <div className="rounded-xl border border-[#0052FF]/30 bg-[#0052FF]/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {data.currentUser.pfpUrl ? (
                  <img src={data.currentUser.pfpUrl.replace('_normal', '')} alt="" className="h-10 w-10 rounded-full" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/50">?</div>
                )}
                <div>
                  <p className="font-medium text-white">@{data.currentUser.username}</p>
                  <p className="text-xs text-white/60">{data.currentUser.rewardTier}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-white">#{data.currentUser.rank}</p>
                <p className="text-xs text-white/60">{data.currentUser.points.toLocaleString()} pts</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-white/50">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {data?.top10.map((entry) => (
                <tr key={entry.rank} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3">
                    <span className={`font-bold ${entry.rank <= 3 ? 'text-[#0052FF]' : 'text-white/70'}`}>
                      #{entry.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {entry.pfpUrl ? (
                        <img src={entry.pfpUrl.replace('_normal', '')} alt="" className="h-7 w-7 rounded-full" />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs text-white/50">?</div>
                      )}
                      <span className="text-sm text-white">@{entry.username}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-white">
                    {entry.points.toLocaleString()}
                  </td>
                </tr>
              ))}
              {(!data?.top10 || data.top10.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-sm text-white/50">
                    No players yet. Be the first!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs text-white/50">Rank 100 cutoff</p>
            <p className="text-lg font-bold text-white">{(data?.cutoff100 ?? 0).toLocaleString()} pts</p>
            <p className="mt-1 text-xs text-green-400">$25 Pass</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs text-white/50">Rank 500 cutoff</p>
            <p className="text-lg font-bold text-white">{(data?.cutoff500 ?? 0).toLocaleString()} pts</p>
            <p className="mt-1 text-xs text-yellow-400">$5 Pass</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-2 text-sm font-medium text-white/70">Prize Pool</h3>
          <div className="flex justify-between text-sm">
            <span className="text-white/60">$25 Pass (Top 100)</span>
            <span className="font-medium text-white">25 available</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-white/60">$5 Pass (Rank 101-500)</span>
            <span className="font-medium text-white">100 available</span>
          </div>
          <div className="mt-2 border-t border-white/10 pt-2 text-xs text-white/50">
            Every 500 points = 1 lottery ticket
          </div>
        </div>
      </div>
    </div>
  );
}
