import { getDb } from './mongodb';

export type WaitlistUser = {
  privyDid: string;
  twitterId: string;
  username: string;
  pfpUrl: string | null;
  walletAddress: string | null;
  points: number;
  referralCode: string;
  referredBy: string | null;
  referralCount: number;
  completedActions: string[];
  lastCheckIn: Date | null;
  lastDailyPost: { twitter: Date | null; farcaster: Date | null };
  createdAt: Date;
};

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function usersCol() {
  return getDb().then((db) => db.collection<WaitlistUser>('users'));
}

export async function getUserByPrivyDid(
  privyDid: string
): Promise<WaitlistUser | null> {
  const col = await usersCol();
  return col.findOne({ privyDid }) as Promise<WaitlistUser | null>;
}

export async function getUserByTwitterId(
  twitterId: string
): Promise<WaitlistUser | null> {
  const col = await usersCol();
  return col.findOne({ twitterId }) as Promise<WaitlistUser | null>;
}

export async function getUserByReferralCode(
  code: string
): Promise<WaitlistUser | null> {
  const col = await usersCol();
  return col.findOne({ referralCode: code }) as Promise<WaitlistUser | null>;
}

export async function createUser(params: {
  privyDid: string;
  twitterId: string;
  username: string;
  pfpUrl: string | null;
  referredByCode?: string;
}): Promise<WaitlistUser> {
  const col = await usersCol();

  const existing = await col.findOne({ privyDid: params.privyDid });
  if (existing) return existing as WaitlistUser;

  let referralCode = generateReferralCode();
  while (await col.findOne({ referralCode })) {
    referralCode = generateReferralCode();
  }

  const user: WaitlistUser = {
    privyDid: params.privyDid,
    twitterId: params.twitterId,
    username: params.username,
    pfpUrl: params.pfpUrl ?? null,
    walletAddress: null,
    points: 0,
    referralCode,
    referredBy: params.referredByCode ?? null,
    referralCount: 0,
    completedActions: [],
    lastCheckIn: null,
    lastDailyPost: { twitter: null, farcaster: null },
    createdAt: new Date(),
  };

  await col.insertOne(user as any);
  return user;
}

export async function updateUserWallet(
  privyDid: string,
  walletAddress: string
): Promise<WaitlistUser | null> {
  const col = await usersCol();
  const result = await col.findOneAndUpdate(
    { privyDid },
    { $set: { walletAddress } },
    { returnDocument: 'after' }
  );
  return (result as WaitlistUser | null) ?? null;
}

export async function addPoints(
  privyDid: string,
  points: number
): Promise<WaitlistUser | null> {
  const col = await usersCol();
  const result = await col.findOneAndUpdate(
    { privyDid },
    { $inc: { points } },
    { returnDocument: 'after' }
  );
  return (result as WaitlistUser | null) ?? null;
}

export async function incrementReferralCount(
  privyDid: string
): Promise<number> {
  const col = await usersCol();
  const result = await col.findOneAndUpdate(
    { privyDid },
    { $inc: { referralCount: 1 } },
    { returnDocument: 'after' }
  );
  return (result as WaitlistUser | null)?.referralCount ?? 0;
}

export async function markActionCompleted(
  privyDid: string,
  action: string
): Promise<void> {
  const col = await usersCol();
  await col.updateOne(
    { privyDid },
    { $addToSet: { completedActions: action } }
  );
}

export async function updateLastCheckIn(privyDid: string): Promise<void> {
  const col = await usersCol();
  await col.updateOne({ privyDid }, { $set: { lastCheckIn: new Date() } });
}

export async function updateLastDailyPost(
  privyDid: string,
  platform: 'twitter' | 'farcaster'
): Promise<void> {
  const col = await usersCol();
  await col.updateOne(
    { privyDid },
    { $set: { [`lastDailyPost.${platform}`]: new Date() } }
  );
}
