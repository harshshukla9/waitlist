import { NextResponse } from 'next/server';
import { createUser, getUserByPrivyDid, getUserByReferralCode, incrementReferralCount, addPoints } from '@/lib/users';
import { verifyPrivyAccessToken, getAccessTokenFromRequest } from '@/lib/privy-server';
import { z } from 'zod';

const bodySchema = z.object({
  twitterId: z.string(),
  username: z.string(),
  pfpUrl: z.string().nullable().optional(),
  referredByCode: z.string().optional(),
});

function getReferralPoints(currentCount: number): number {
  if (currentCount <= 5) return 200;
  if (currentCount <= 20) return 300;
  return 500;
}

export async function POST(req: Request) {
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

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'Invalid body', details: e }, { status: 400 });
  }

  const existing = await getUserByPrivyDid(privyDid);
  if (existing) {
    return NextResponse.json({ success: true, user: existing, isNew: false });
  }

  let validReferralCode: string | undefined;
  if (body.referredByCode) {
    const referrer = await getUserByReferralCode(body.referredByCode);
    if (referrer && referrer.privyDid !== privyDid) {
      validReferralCode = body.referredByCode;
    }
  }

  const user = await createUser({
    privyDid,
    twitterId: body.twitterId,
    username: body.username,
    pfpUrl: body.pfpUrl ?? null,
    referredByCode: validReferralCode,
  });

  if (validReferralCode) {
    const referrer = await getUserByReferralCode(validReferralCode);
    if (referrer) {
      const newCount = await incrementReferralCount(referrer.privyDid);
      const pointsToAward = getReferralPoints(newCount);
      await addPoints(referrer.privyDid, pointsToAward);
    }
  }

  return NextResponse.json({ success: true, user, isNew: true });
}
