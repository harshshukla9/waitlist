/**
 * Twitter/X verification.
 * - Tweet fetch: TwitterAPI.io (cheap) via TWITTERAPI_IO_API_KEY, or official API v2 via TWITTER_BEARER_TOKEN.
 * - Follow check: official API v2 only (TWITTER_BEARER_TOKEN + TWITTER_ACCOUNT_ID).
 * See: https://docs.twitterapi.io/api-reference/endpoint/get_tweet_by_ids
 */

const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTERAPI_IO_BASE = 'https://api.twitterapi.io';

function getBearerToken(): string | null {
  return process.env.TWITTER_BEARER_TOKEN ?? null;
}

function getTwitterAPIioKey(): string | null {
  return process.env.TWITTERAPI_IO_API_KEY ?? null;
}

export function getTwitterAccountId(): string | null {
  return process.env.TWITTER_ACCOUNT_ID ?? null;
}

/** True if we can verify follow (needs official API). */
export function isTwitterVerificationEnabled(): boolean {
  return !!(getBearerToken() && getTwitterAccountId());
}

/** True if we can verify tweets (TwitterAPI.io or official API). */
export function isTwitterTweetVerificationEnabled(): boolean {
  return !!(getTwitterAPIioKey() || getBearerToken());
}

/** Extract tweet ID from x.com or twitter.com status URL */
export function parseTweetUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  // https://twitter.com/user/status/1234567890 or https://x.com/user/status/1234567890
  const match = trimmed.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i);
  return match ? match[1] : null;
}

async function twitterFetch(endpoint: string, params?: Record<string, string>): Promise<Response> {
  const token = getBearerToken();
  if (!token) throw new Error('Twitter API not configured');
  const url = new URL(endpoint, TWITTER_API_BASE);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Check if the given user (by Twitter numeric ID) follows our brand account.
 * Uses GET /2/users/:id/followers and paginates until we find the user or exhaust pages (cap at 20 pages = 20k followers).
 */
export async function verifyUserFollowsAccount(
  userTwitterId: string,
  accountTwitterId: string
): Promise<boolean> {
  let nextToken: string | undefined;
  const maxPages = 20;
  const maxResults = 1000;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      max_results: String(maxResults),
      'user.fields': 'id',
    };
    if (nextToken) params.pagination_token = nextToken;

    const res = await twitterFetch(
      `/users/${encodeURIComponent(accountTwitterId)}/followers`,
      params
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('Twitter followers API error:', res.status, err);
      return false;
    }

    const data = (await res.json()) as {
      data?: { id: string }[];
      meta?: { next_token?: string };
    };

    const ids = (data.data ?? []).map((u) => u.id);
    if (ids.includes(userTwitterId)) return true;

    nextToken = data.meta?.next_token;
    if (!nextToken) break;
  }

  return false;
}

export type TweetInfo = {
  author_id: string;
  referenced_tweets?: { type: 'retweeted' | 'quoted' | 'replied_to' }[];
  text?: string;
};

/**
 * Fetch a single tweet by ID. Uses TwitterAPI.io if TWITTERAPI_IO_API_KEY is set, else official API v2.
 * Returns author_id and referenced_tweets for verification.
 */
export async function fetchTweet(tweetId: string): Promise<TweetInfo | null> {
  if (getTwitterAPIioKey()) {
    return fetchTweetViaTwitterAPIio(tweetId);
  }
  if (getBearerToken()) {
    return fetchTweetViaOfficialAPI(tweetId);
  }
  return null;
}

/** TwitterAPI.io: GET /twitter/tweets?tweet_ids=id — auth: X-API-Key */
async function fetchTweetViaTwitterAPIio(tweetId: string): Promise<TweetInfo | null> {
  const apiKey = getTwitterAPIioKey();
  if (!apiKey) return null;

  const url = `${TWITTERAPI_IO_BASE}/twitter/tweets?tweet_ids=${encodeURIComponent(tweetId)}`;
  const res = await fetch(url, {
    headers: { 'X-API-Key': apiKey },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    const err = await res.text();
    console.error('TwitterAPI.io error:', res.status, err);
    return null;
  }

  const data = (await res.json()) as {
    tweets?: Array<{
      id: string;
      text?: string;
      isReply?: boolean;
      quoted_tweet?: unknown;
      retweeted_tweet?: unknown;
      author?: { id: string };
    }>;
    status?: string;
    message?: string;
  };

  if (data.status === 'error' || !Array.isArray(data.tweets) || data.tweets.length === 0) {
    return null;
  }

  const tweet = data.tweets[0];
  const authorId = tweet.author?.id;
  if (!authorId) return null;

  const referenced_tweets: { type: 'retweeted' | 'quoted' | 'replied_to' }[] = [];
  if (tweet.retweeted_tweet) referenced_tweets.push({ type: 'retweeted' });
  if (tweet.quoted_tweet) referenced_tweets.push({ type: 'quoted' });
  if (tweet.isReply) referenced_tweets.push({ type: 'replied_to' });

  return {
    author_id: authorId,
    referenced_tweets: referenced_tweets.length ? referenced_tweets : undefined,
    text: tweet.text,
  };
}

/** Official Twitter API v2: GET /2/tweets/:id */
async function fetchTweetViaOfficialAPI(tweetId: string): Promise<TweetInfo | null> {
  const params: Record<string, string> = {
    'tweet.fields': 'author_id,created_at,referenced_tweets',
    expansions: 'author_id',
  };
  const res = await twitterFetch(`/tweets/${encodeURIComponent(tweetId)}`, params);

  if (!res.ok) {
    if (res.status === 404) return null;
    const err = await res.text();
    console.error('Twitter API v2 error:', res.status, err);
    return null;
  }

  const data = (await res.json()) as {
    data?: {
      author_id: string;
      referenced_tweets?: { type: string }[];
      text?: string;
    };
  };

  const tweet = data.data;
  if (!tweet) return null;

  return {
    author_id: tweet.author_id,
    referenced_tweets: tweet.referenced_tweets?.map((r) => ({
      type: r.type as 'retweeted' | 'quoted' | 'replied_to',
    })),
    text: tweet.text,
  };
}

/** Verify tweet is a quote tweet (has quoted reference) */
export function tweetIsQuoteTweet(info: TweetInfo): boolean {
  return info.referenced_tweets?.some((r) => r.type === 'quoted') ?? false;
}

/** Verify tweet is a retweet (has retweeted reference) */
export function tweetIsRetweet(info: TweetInfo): boolean {
  return info.referenced_tweets?.some((r) => r.type === 'retweeted') ?? false;
}

/** Verify tweet is a reply (has replied_to reference) */
export function tweetIsReply(info: TweetInfo): boolean {
  return info.referenced_tweets?.some((r) => r.type === 'replied_to') ?? false;
}

/** Check if tweet text mentions the given handle (e.g. @abc) */
export function tweetMentionsHandle(info: TweetInfo, handle: string): boolean {
  const h = handle.startsWith('@') ? handle.slice(1).toLowerCase() : handle.toLowerCase();
  const text = (info.text ?? '').toLowerCase();
  return text.includes(`@${h}`);
}
