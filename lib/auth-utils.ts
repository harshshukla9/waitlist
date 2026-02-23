 export const PRIVY_AUTH_COMPLETE = 'PRIVY_AUTH_COMPLETE';

export function isInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  return window.self !== window.top;
}

/**
 * URL to open for Twitter OAuth in a popup when the app is embedded (e.g. Farcaster).
 * Add this exact URL as an allowed OAuth redirect URL in Privy Dashboard if you use popup flow.
 */
export function getOAuthPopupRedirectUrl(): string {
  const base = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_URL ?? '';
  return `${base}/?oauth_popup=1`;
}

export function isOAuthPopupMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('oauth_popup') === '1';
}

export function isPopupWindow(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.opener);
}
