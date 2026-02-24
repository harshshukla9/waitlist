import { NextResponse } from 'next/server';
import { getUserByPrivyDid } from '@/lib/users';
import { verifyPrivyAccessToken, getAccessTokenFromRequest } from '@/lib/privy-server';
import { getUserRank, getLotteryTickets } from '@/lib/leaderboard';

export async function GET(req: Request) {
  const accessToken = getAccessTokenFromRequest(req);
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let privyDid: string;
  try {
    const claims = await verifyPrivyAccessToken(accessToken);
    privyDid = claims.user_id;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const user = await getUserByPrivyDid(privyDid);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const rank = await getUserRank(privyDid);
  const tickets = getLotteryTickets(user.points);
  const origin = new URL(req.url).origin;

  const cardUrl = `${origin}/api/og/card?username=${encodeURIComponent(user.username)}&pfp=${encodeURIComponent(user.pfpUrl ?? '')}&points=${user.points}&rank=${rank}&tickets=${tickets}`;
  const referralLink = `${origin}/?ref=${user.referralCode}`;

  const twitterText = `Stack points. Win passes. Get Based.\n\nRank #${rank} | ${user.points.toLocaleString()} pts | ${tickets} tickets\n\nJoin with my code: ${user.referralCode}\n${referralLink}\n\n@abc`;
  const farcasterText = `Stack points. Win passes. Get Based.\n\nRank #${rank} | ${user.points.toLocaleString()} pts | ${tickets} tickets\n\nJoin: ${referralLink}\n\n@abc`;

  return NextResponse.json({
    cardUrl,
    referralLink,
    twitter: {
      text: twitterText,
      intentUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}`,
    },
    farcaster: {
      text: farcasterText,
      composeUrl: `https://warpcast.com/~/compose?text=${encodeURIComponent(farcasterText)}&embeds[]=${encodeURIComponent(cardUrl)}`,
    },
  });
}
