import { getDb } from './mongodb';
import type { WaitlistUser } from './users';

export type LeaderboardEntry = {
  rank: number;
  username: string;
  pfpUrl: string | null;
  points: number;
};

export async function getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
  const db = await getDb();
  const users = await db
    .collection<WaitlistUser>('users')
    .find({}, { projection: { username: 1, pfpUrl: 1, points: 1 } })
    .sort({ points: -1 })
    .limit(limit)
    .toArray();

  return users.map((u, i) => ({
    rank: i + 1,
    username: u.username,
    pfpUrl: u.pfpUrl,
    points: u.points,
  }));
}

export async function getUserRank(privyDid: string): Promise<number> {
  const db = await getDb();
  const user = await db.collection<WaitlistUser>('users').findOne({ privyDid });
  if (!user) return 0;

  const count = await db
    .collection<WaitlistUser>('users')
    .countDocuments({ points: { $gt: user.points } });

  return count + 1;
}

export async function getCutoffPoints(rank: number): Promise<number> {
  const db = await getDb();
  const users = await db
    .collection<WaitlistUser>('users')
    .find({}, { projection: { points: 1 } })
    .sort({ points: -1 })
    .skip(rank - 1)
    .limit(1)
    .toArray();

  return users[0]?.points ?? 0;
}

export function getRewardTier(rank: number): string {
  if (rank === 0) return 'Unranked';
  if (rank <= 100) return '$25 Pass';
  if (rank <= 500) return '$5 Pass';
  return 'Lottery Only';
}

export function getLotteryTickets(points: number): number {
  return Math.floor(points / 500);
}
