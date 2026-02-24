import { NextResponse } from 'next/server';
import { getUserByPrivyDid } from '@/lib/users';
import { verifyPrivyAccessToken, getAccessTokenFromRequest } from '@/lib/privy-server';
import { getUserRank, getRewardTier, getLotteryTickets } from '@/lib/leaderboard';
import { getActionCooldowns, ACTIONS } from '@/lib/actions';
import { isTwitterVerificationEnabled, isTwitterTweetVerificationEnabled } from '@/lib/twitter-verify';

export async function GET(req: Request) {
  const accessToken = getAccessTokenFromRequest(req);
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
  }

  let privyDid: string;
  try {
    const claims = await verifyPrivyAccessToken(accessToken);
    privyDid = claims.user_id;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const user = await getUserByPrivyDid(privyDid);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const rank = await getUserRank(privyDid);
  const cooldowns = await getActionCooldowns(privyDid);

  const actions = ACTIONS.map((a) => ({
    key: a.key,
    label: a.label,
    points: a.points,
    cooldown: a.cooldown,
    category: a.category,
    platform: a.platform ?? null,
    url: a.url ?? null,
    status: cooldowns[a.key] ?? { available: true, cooldownEndsAt: null, completed: false },
  }));

  return NextResponse.json({
    twitterVerificationEnabled: isTwitterVerificationEnabled(),
    twitterTweetVerificationEnabled: isTwitterTweetVerificationEnabled(),
    user: {
      privyDid: user.privyDid,
      username: user.username,
      pfpUrl: user.pfpUrl,
      walletAddress: user.walletAddress,
      points: user.points,
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      referralCount: user.referralCount,
      createdAt: user.createdAt,
    },
    rank,
    rewardTier: getRewardTier(rank),
    tickets: getLotteryTickets(user.points),
    actions,
  });
}
