import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export type WaitlistUser = {
  privyDid: string;
  twitterId: string;
  username: string;
  pfpUrl: string | null;
  walletAddress: string | null;
  points: number;
  referralCode: string;
  createdAt: string;
};

const USER_PREFIX = 'waitlist:user:';
const USER_BY_TWITTER_PREFIX = 'waitlist:user:twitter:';
const USER_BY_REFERRAL_PREFIX = 'waitlist:user:ref:';

function userKey(privyDid: string) {
  return `${USER_PREFIX}${privyDid}`;
}

function userByTwitterKey(twitterId: string) {
  return `${USER_BY_TWITTER_PREFIX}${twitterId}`;
}

function userByReferralKey(referralCode: string) {
  return `${USER_BY_REFERRAL_PREFIX}${referralCode}`;
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function getUserByPrivyDid(
  privyDid: string
): Promise<WaitlistUser | null> {
  const data = await redis.get<WaitlistUser>(userKey(privyDid));
  return data ?? null;
}

export async function getUserByTwitterId(
  twitterId: string
): Promise<WaitlistUser | null> {
  const privyDid = await redis.get<string>(userByTwitterKey(twitterId));
  if (!privyDid) return null;
  return getUserByPrivyDid(privyDid);
}

export async function createUser(params: {
  privyDid: string;
  twitterId: string;
  username: string;
  pfpUrl: string | null;
  referralCode?: string;
}): Promise<WaitlistUser> {
  const existing = await getUserByPrivyDid(params.privyDid);
  if (existing) return existing;

  let referralCode = params.referralCode ?? generateReferralCode();
  let exists = await redis.get(userByReferralKey(referralCode));
  while (exists) {
    referralCode = generateReferralCode();
    exists = await redis.get(userByReferralKey(referralCode));
  }

  const user: WaitlistUser = {
    privyDid: params.privyDid,
    twitterId: params.twitterId,
    username: params.username,
    pfpUrl: params.pfpUrl ?? null,
    walletAddress: null,
    points: 0,
    referralCode,
    createdAt: new Date().toISOString(),
  };

  const pipe = redis.pipeline();
  pipe.set(userKey(params.privyDid), user);
  pipe.set(userByTwitterKey(params.twitterId), params.privyDid);
  pipe.set(userByReferralKey(referralCode), params.privyDid);
  await pipe.exec();

  return user;
}

export async function updateUserWallet(
  privyDid: string,
  walletAddress: string
): Promise<WaitlistUser | null> {
  const user = await getUserByPrivyDid(privyDid);
  if (!user) return null;

  const updated: WaitlistUser = {
    ...user,
    walletAddress,
  };
  await redis.set(userKey(privyDid), updated);
  return updated;
}
