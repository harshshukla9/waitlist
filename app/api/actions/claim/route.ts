import { NextResponse } from 'next/server';
import { verifyPrivyAccessToken, getAccessTokenFromRequest } from '@/lib/privy-server';
import { claimAction } from '@/lib/actions';
import { z } from 'zod';

const bodySchema = z.object({
  action: z.string(),
  tweetUrl: z.string().optional(),
});

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

  const result = await claimAction(privyDid, body.action, {
    tweetUrl: body.tweetUrl,
  });
  const status = result.success ? 200 : result.error === 'On cooldown' ? 429 : 400;
  return NextResponse.json(result, { status });
}
