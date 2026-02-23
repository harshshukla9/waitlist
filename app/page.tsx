'use client';

import { usePrivy, useLoginWithOAuth } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useCallback, useRef } from 'react';
import {
  isInIframe,
  isOAuthPopupMode,
  isPopupWindow,
  getOAuthPopupRedirectUrl,
  PRIVY_AUTH_COMPLETE,
} from '@/lib/auth-utils';

export default function LoginPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { initOAuth } = useLoginWithOAuth({
    onComplete: useCallback(
      async ({
        user: privyUser,
      }: {
        user: { twitter?: { subject: string; username: string | null; profilePictureUrl: string | null } };
      }) => {
        const twitter = privyUser.twitter;
        if (!twitter) return;

        try {
          const accessToken = await getAccessToken();
          if (!accessToken) return;

          await fetch('/api/users/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              twitterId: twitter.subject,
              username: twitter.username ?? '',
              pfpUrl: twitter.profilePictureUrl ?? null,
            }),
          });
        } catch (err) {
          console.error('Failed to create/update user:', err);
        }
      },
      [getAccessToken]
    ),
  });
  const router = useRouter();
  const inIframe = isInIframe();
  const isPopup = isPopupWindow();
  const oauthPopupParam = isOAuthPopupMode();
  const autoTriggered = useRef(false);

  // Popup: when auth completes, notify opener and close
  useEffect(() => {
    if (!ready || !authenticated || !isPopup) return;
    if (typeof window === 'undefined' || !window.opener) return;

    const origin = window.location.origin;
    window.opener.postMessage({ type: PRIVY_AUTH_COMPLETE }, origin);
    window.close();
  }, [ready, authenticated, isPopup]);

  // Redirect to dashboard when authenticated (standalone and iframe after popup auth)
  useEffect(() => {
    if (ready && authenticated && !isPopup) router.push('/dashboard');
  }, [ready, authenticated, isPopup, router]);

  // Iframe: listen for auth complete from popup and refresh so Privy state updates
  useEffect(() => {
    if (!inIframe || typeof window === 'undefined') return;

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === PRIVY_AUTH_COMPLETE) {
        router.refresh();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [inIframe, router]);

  // Popup with oauth_popup=1: auto-trigger OAuth once ready so user doesn't have to click again
  useEffect(() => {
    if (!ready || authenticated || !isPopup || !oauthPopupParam) return;
    if (autoTriggered.current) return;
    autoTriggered.current = true;
    initOAuth({ provider: 'twitter' });
  }, [ready, authenticated, isPopup, oauthPopupParam, initOAuth]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <p className="text-white/80">
          {isPopup && oauthPopupParam ? 'Opening X to sign in...' : 'Loading...'}
        </p>
      </div>
    );
  }

  // Popup waiting for OAuth: show short message (OAuth will redirect away shortly)
  if (isPopup && oauthPopupParam && !authenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#0a0a0a] px-6">
        <p className="text-white/80">Redirecting to X to sign in...</p>
      </div>
    );
  }

  const handleSignIn = () => {
    if (inIframe) {
      const url = getOAuthPopupRedirectUrl();
      window.open(url, 'privy_oauth', 'width=500,height=600,scrollbars=yes');
    } else {
      initOAuth({ provider: 'twitter' });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#0a0a0a] px-6">
      <h1 className="max-w-lg text-center text-3xl font-bold text-white sm:text-4xl">
        Stack points. Win passes. Get Based.
      </h1>
      <button
        type="button"
        onClick={handleSignIn}
        className="rounded-xl bg-[#0052FF] px-8 py-4 font-semibold text-white transition hover:bg-[#0046e0]"
      >
        Sign in with X
      </button>
      {inIframe && (
        <p className="max-w-sm text-center text-sm text-white/50">
          Opens in a new window so you can sign in with X.
        </p>
      )}
    </div>
  );
}
