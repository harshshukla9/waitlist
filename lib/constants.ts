export const MESSAGE_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30; // 30 day

const rawAppUrl = process.env.NEXT_PUBLIC_URL;

if (!rawAppUrl) {
  throw new Error('NEXT_PUBLIC_URL or NEXT_PUBLIC_VERCEL_URL is not set');
}

export const APP_URL: string = rawAppUrl;
