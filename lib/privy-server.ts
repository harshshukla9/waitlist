import { PrivyClient } from '@privy-io/node';

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

if (!appId) throw new Error('NEXT_PUBLIC_PRIVY_APP_ID is not set');
if (!appSecret) throw new Error('PRIVY_APP_SECRET is not set');

const privy = new PrivyClient({
  appId,
  appSecret,
});

export type VerifiedClaims = {
  app_id: string;
  issuer: string;
  issued_at: number;
  expiration: number;
  session_id: string;
  user_id: string;
};

export async function verifyPrivyAccessToken(
  accessToken: string
): Promise<VerifiedClaims> {
  const claims = await privy.utils().auth().verifyAccessToken(accessToken);
  return claims;
}

export function getAccessTokenFromRequest(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}
