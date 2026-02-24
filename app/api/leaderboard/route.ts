import { NextResponse } from 'next/server';
import { getLeaderboard, getUserRank, getCutoffPoints, getRewardTier, getLotteryTickets } from '@/lib/leaderboard';
import { verifyPrivyAccessToken, getAccessTokenFromRequest } from '@/lib/privy-server';
import { getUserByPrivyDid } from '@/lib/users';

export async function GET(req: Request) {
  const top10 = await getLeaderboard(10);
  const cutoff100 = await getCutoffPoints(100);
  const cutoff500 = await getCutoffPoints(500);

  let currentUser = null;
  const accessToken = getAccessTokenFromRequest(req);
  if (accessToken) {
    try {
      const claims = await verifyPrivyAccessToken(accessToken);
      const user = await getUserByPrivyDid(claims.user_id);
      if (user) {
        const rank = await getUserRank(claims.user_id);
        currentUser = {
          username: user.username,
          pfpUrl: user.pfpUrl,
          points: user.points,
          rank,
          rewardTier: getRewardTier(rank),
          tickets: getLotteryTickets(user.points),
        };
      }
    } catch {
      // not authenticated, skip
    }
  }

  return NextResponse.json({
    top10,
    cutoff100,
    cutoff500,
    currentUser,
    prizes: {
      pass25: { label: '$25 Pass', count: 25, forTop: 100 },
      pass5: { label: '$5 Pass', count: 100, forTop: 500 },
    },
  });
}
