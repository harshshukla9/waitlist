import { NextResponse } from 'next/server';
import { getUserByReferralCode } from '@/lib/users';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ valid: false, error: 'Missing code parameter' }, { status: 400 });
  }

  const user = await getUserByReferralCode(code.toUpperCase());
  return NextResponse.json({
    valid: !!user,
    username: user?.username ?? null,
  });
}
