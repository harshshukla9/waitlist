import { getDb } from './mongodb';
import { addPoints, markActionCompleted, getUserByPrivyDid, updateLastCheckIn, updateLastDailyPost } from './users';
import {
  isTwitterVerificationEnabled,
  isTwitterTweetVerificationEnabled,
  getTwitterAccountId,
  verifyUserFollowsAccount,
  parseTweetUrl,
  fetchTweet,
  tweetIsQuoteTweet,
  tweetIsRetweet,
  tweetIsReply,
  tweetMentionsHandle,
} from './twitter-verify';

export type CooldownType = 'once' | '24h';

export interface ActionDefinition {
  key: string;
  label: string;
  points: number;
  cooldown: CooldownType;
  category: 'social_once' | 'social_recurring' | 'daily';
  platform?: 'twitter' | 'farcaster' | 'discord' | 'telegram';
  url?: string;
}

export const ACTIONS: ActionDefinition[] = [
  { key: 'follow_twitter', label: 'Follow @abc on Twitter', points: 250, cooldown: 'once', category: 'social_once', platform: 'twitter', url: 'https://twitter.com/intent/follow?screen_name=abc' },
  { key: 'follow_farcaster', label: 'Follow @abc on Farcaster', points: 250, cooldown: 'once', category: 'social_once', platform: 'farcaster', url: 'https://warpcast.com/abc' },
  { key: 'join_discord', label: 'Join Discord', points: 250, cooldown: 'once', category: 'social_once', platform: 'discord', url: 'https://discord.gg/placeholder' },
  { key: 'join_tg', label: 'Join Telegram', points: 250, cooldown: 'once', category: 'social_once', platform: 'telegram', url: 'https://t.me/placeholder' },

  { key: 'qt_twitter', label: 'Quote Tweet', points: 200, cooldown: '24h', category: 'social_recurring', platform: 'twitter' },
  { key: 'qt_farcaster', label: 'Quote Cast', points: 200, cooldown: '24h', category: 'social_recurring', platform: 'farcaster' },
  { key: 'post_twitter', label: 'Post tagging @abc on Twitter', points: 300, cooldown: '24h', category: 'social_recurring', platform: 'twitter' },
  { key: 'post_farcaster', label: 'Post tagging @abc on Farcaster', points: 300, cooldown: '24h', category: 'social_recurring', platform: 'farcaster' },
  { key: 'rt_twitter', label: 'Retweet', points: 150, cooldown: '24h', category: 'social_recurring', platform: 'twitter' },
  { key: 'rt_farcaster', label: 'Recast', points: 150, cooldown: '24h', category: 'social_recurring', platform: 'farcaster' },
  { key: 'comment_twitter', label: 'Comment on Twitter', points: 100, cooldown: '24h', category: 'social_recurring', platform: 'twitter' },
  { key: 'comment_farcaster', label: 'Comment on Farcaster', points: 100, cooldown: '24h', category: 'social_recurring', platform: 'farcaster' },
  { key: 'like_twitter', label: 'Like on Twitter', points: 50, cooldown: '24h', category: 'social_recurring', platform: 'twitter' },
  { key: 'like_farcaster', label: 'Like on Farcaster', points: 50, cooldown: '24h', category: 'social_recurring', platform: 'farcaster' },

  { key: 'daily_checkin', label: 'Daily Check-in', points: 50, cooldown: '24h', category: 'daily' },
  { key: 'daily_post_twitter', label: 'Daily Post on Twitter', points: 250, cooldown: '24h', category: 'daily', platform: 'twitter' },
  { key: 'daily_post_farcaster', label: 'Daily Post on Farcaster', points: 250, cooldown: '24h', category: 'daily', platform: 'farcaster' },
];

export const ACTION_MAP = new Map(ACTIONS.map((a) => [a.key, a]));

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface ClaimResult {
  success: boolean;
  error?: string;
  pointsAwarded?: number;
  totalPoints?: number;
  cooldownEndsAt?: string;
}

/** Options for claim: tweetUrl required for verifiable Twitter post/QT/RT/comment actions when verification is enabled */
export interface ClaimOptions {
  tweetUrl?: string;
}

async function getLastActionLog(privyDid: string, action: string): Promise<Date | null> {
  const db = await getDb();
  const log = await db
    .collection('action_logs')
    .findOne({ privyDid, action }, { sort: { createdAt: -1 } });
  return log ? new Date(log.createdAt) : null;
}

async function logAction(privyDid: string, action: string, points: number): Promise<void> {
  const db = await getDb();
  await db.collection('action_logs').insertOne({
    privyDid,
    action,
    points,
    createdAt: new Date(),
  });
}

const TWITTER_ACTIONS_REQUIRING_TWEET_URL = new Set([
  'qt_twitter',
  'rt_twitter',
  'post_twitter',
  'comment_twitter',
  'daily_post_twitter',
]);

/** Official Twitter handle to check for post_twitter / daily_post_twitter (e.g. @abc). From env TWITTER_USERNAME. */
function getOfficialTwitterHandle(): string {
  const h = process.env.TWITTER_USERNAME ?? 'abc';
  return h.startsWith('@') ? h.slice(1) : h;
}

export async function claimAction(
  privyDid: string,
  actionKey: string,
  options?: ClaimOptions
): Promise<ClaimResult> {
  const actionDef = ACTION_MAP.get(actionKey);
  if (!actionDef) {
    return { success: false, error: 'Unknown action' };
  }

  const user = await getUserByPrivyDid(privyDid);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  if (actionDef.cooldown === 'once') {
    if (user.completedActions.includes(actionKey)) {
      return { success: false, error: 'Action already completed' };
    }
  } else {
    const lastClaim = await getLastActionLog(privyDid, actionKey);
    if (lastClaim) {
      const elapsed = Date.now() - lastClaim.getTime();
      if (elapsed < TWENTY_FOUR_HOURS_MS) {
        const cooldownEndsAt = new Date(lastClaim.getTime() + TWENTY_FOUR_HOURS_MS).toISOString();
        return { success: false, error: 'On cooldown', cooldownEndsAt };
      }
    }
  }

  // --- Twitter verification (when enabled) ---
  if (actionKey === 'follow_twitter' && isTwitterVerificationEnabled()) {
    const accountId = getTwitterAccountId()!;
    const follows = await verifyUserFollowsAccount(user.twitterId, accountId);
    if (!follows) {
      return { success: false, error: 'Follow our X account first, then try again.' };
    }
  }

  if (
    isTwitterTweetVerificationEnabled() &&
    TWITTER_ACTIONS_REQUIRING_TWEET_URL.has(actionKey)
  ) {
    const tweetUrl = options?.tweetUrl?.trim();
    if (!tweetUrl) {
      return { success: false, error: 'Paste your tweet link to verify.' };
    }
    const tweetId = parseTweetUrl(tweetUrl);
    if (!tweetId) {
      return { success: false, error: 'Invalid tweet link. Use a link like https://x.com/username/status/123...' };
    }
    const tweet = await fetchTweet(tweetId);
    if (!tweet) {
      return { success: false, error: 'Could not load that tweet. Check the link or try again later.' };
    }
    if (tweet.author_id !== user.twitterId) {
      return { success: false, error: 'That tweet was not posted by your account.' };
    }
    const handle = getOfficialTwitterHandle();
    switch (actionKey) {
      case 'qt_twitter':
        if (!tweetIsQuoteTweet(tweet)) {
          return { success: false, error: 'That tweet is not a Quote Tweet.' };
        }
        break;
      case 'rt_twitter':
        if (!tweetIsRetweet(tweet)) {
          return { success: false, error: 'That tweet is not a Retweet.' };
        }
        break;
      case 'comment_twitter':
        if (!tweetIsReply(tweet)) {
          return { success: false, error: 'That tweet is not a reply/comment.' };
        }
        break;
      case 'post_twitter':
      case 'daily_post_twitter':
        if (!tweetMentionsHandle(tweet, handle)) {
          return { success: false, error: `Your post must mention @${handle}.` };
        }
        break;
      default:
        break;
    }
  }

  await addPoints(privyDid, actionDef.points);
  await logAction(privyDid, actionKey, actionDef.points);

  if (actionDef.cooldown === 'once') {
    await markActionCompleted(privyDid, actionKey);
  }

  if (actionKey === 'daily_checkin') {
    await updateLastCheckIn(privyDid);
  }
  if (actionKey === 'daily_post_twitter') {
    await updateLastDailyPost(privyDid, 'twitter');
  }
  if (actionKey === 'daily_post_farcaster') {
    await updateLastDailyPost(privyDid, 'farcaster');
  }

  const updatedUser = await getUserByPrivyDid(privyDid);

  return {
    success: true,
    pointsAwarded: actionDef.points,
    totalPoints: updatedUser?.points ?? 0,
  };
}

export async function getActionCooldowns(
  privyDid: string
): Promise<Record<string, { available: boolean; cooldownEndsAt: string | null; completed: boolean }>> {
  const user = await getUserByPrivyDid(privyDid);
  if (!user) return {};

  const db = await getDb();
  const recentLogs = await db
    .collection('action_logs')
    .find({ privyDid })
    .sort({ createdAt: -1 })
    .toArray();

  const lastClaimByAction = new Map<string, Date>();
  for (const log of recentLogs) {
    if (!lastClaimByAction.has(log.action)) {
      lastClaimByAction.set(log.action, new Date(log.createdAt));
    }
  }

  const result: Record<string, { available: boolean; cooldownEndsAt: string | null; completed: boolean }> = {};

  for (const action of ACTIONS) {
    if (action.cooldown === 'once') {
      const completed = user.completedActions.includes(action.key);
      result[action.key] = { available: !completed, cooldownEndsAt: null, completed };
    } else {
      const lastClaim = lastClaimByAction.get(action.key);
      if (!lastClaim) {
        result[action.key] = { available: true, cooldownEndsAt: null, completed: false };
      } else {
        const elapsed = Date.now() - lastClaim.getTime();
        const available = elapsed >= TWENTY_FOUR_HOURS_MS;
        const cooldownEndsAt = available
          ? null
          : new Date(lastClaim.getTime() + TWENTY_FOUR_HOURS_MS).toISOString();
        result[action.key] = { available, cooldownEndsAt, completed: false };
      }
    }
  }

  return result;
}
